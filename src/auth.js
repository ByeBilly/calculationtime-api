import { createHash, timingSafeEqual } from 'node:crypto';

const DEFAULT_RATE_LIMIT_PER_MINUTE = 120;

export function createApiKeyAuth(env = process.env, keyStore = null) {
  const entries = String(env.TIME_API_KEYS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(parseKeyEntry);
  const requireConfiguredKey = boolean(env.REQUIRE_API_KEY, false) || entries.length > 0 || Boolean(keyStore);

  return {
    enabled: requireConfiguredKey,
    configured: entries.length > 0,
    async authenticate(request) {
      const supplied = extractApiKey(request);

      if (!requireConfiguredKey) {
        return {
          customerId: 'local_development',
          keyFingerprint: 'none',
          authenticated: false
        };
      }

      if (!supplied || (entries.length === 0 && !keyStore)) {
        throw Object.assign(new Error('A valid API key is required'), {
          statusCode: 401,
          code: 'unauthorized'
        });
      }

      if (keyStore) {
        const stored = await keyStore.findByKey(supplied);
        if (stored) {
          return {
            ...stored,
            authenticated: true
          };
        }
      }

      const matched = entries.find((entry) => safeEqual(entry.key, supplied));
      if (!matched) {
        throw Object.assign(new Error('A valid API key is required'), {
          statusCode: 401,
          code: 'unauthorized'
        });
      }

      return {
        customerId: matched.customerId,
        planId: matched.planId,
        keyFingerprint: fingerprint(supplied),
        authenticated: true
      };
    }
  };
}

export function createRateLimiter(env = process.env) {
  const defaultLimit = positiveInteger(env.RATE_LIMIT_PER_MINUTE, DEFAULT_RATE_LIMIT_PER_MINUTE);
  const publicLimit = positiveInteger(env.PUBLIC_RATE_LIMIT_PER_MINUTE, 60);
  const customerLimits = parseCustomerLimits(env.TIME_API_CUSTOMER_RATE_LIMITS);
  const buckets = new Map();

  return {
    check(customer, options = {}) {
      const identity = options.identity || customer?.customerId || 'anonymous';
      const limit = positiveInteger(
        customerLimits[identity],
        customer?.rateLimitPerMinute || options.limit || defaultLimit
      );
      return checkBucket({ buckets, identity, limit });
    },
    checkPublic(request) {
      return checkBucket({
        buckets,
        identity: `public:${clientIp(request)}`,
        limit: publicLimit
      });
    },
    publicLimit
  };
}

function checkBucket({ buckets, identity, limit }) {
  if (limit <= 0) {
    return { limit: 0, remaining: 0, reset: nextMinuteEpochSeconds() };
  }

  const minute = Math.floor(Date.now() / 60_000);
  const reset = (minute + 1) * 60;
  const bucketKey = `${identity}:${minute}`;
  const count = (buckets.get(bucketKey) || 0) + 1;
  buckets.set(bucketKey, count);

  if (buckets.size > 10_000) {
    for (const existingKey of buckets.keys()) {
      if (!existingKey.endsWith(`:${minute}`)) buckets.delete(existingKey);
    }
  }

  const remaining = Math.max(0, limit - count);
  if (count > limit) {
    const retryAfterSeconds = Math.max(1, reset - Math.floor(Date.now() / 1000));
    throw Object.assign(new Error('Rate limit exceeded'), {
      statusCode: 429,
      code: 'rate_limited',
      rateLimit: { limit, remaining: 0, reset, retryAfterSeconds }
    });
  }

  return { limit, remaining, reset };
}

function clientIp(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || request.ip || 'unknown';
}

function nextMinuteEpochSeconds() {
  return (Math.floor(Date.now() / 60_000) + 1) * 60;
}

function extractApiKey(request) {
  const authorization = request.headers.authorization || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const direct = request.headers['x-api-key'] || '';
  return String(bearer || direct || '').trim();
}

function parseKeyEntry(entry) {
  const firstColon = entry.indexOf(':');
  if (firstColon === -1) {
    return {
      key: entry,
      customerId: `key_${fingerprint(entry)}`,
      planId: 'default'
    };
  }

  const customerId = entry.slice(0, firstColon).trim();
  const key = entry.slice(firstColon + 1).trim();
  return {
    key,
    customerId: customerId || `key_${fingerprint(key)}`,
    planId: 'default'
  };
}

function parseCustomerLimits(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeEqual(expected, supplied) {
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function fingerprint(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function boolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}
