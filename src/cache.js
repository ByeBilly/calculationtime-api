const DEFAULT_TTL_SECONDS = 300;

export async function createCache({ env = process.env, logger = console } = {}) {
  const mode = String(env.TIME_API_CACHE || 'memory').toLowerCase();
  const ttlSeconds = positiveInteger(env.TIME_API_CACHE_TTL_SECONDS, DEFAULT_TTL_SECONDS);

  if (mode === 'off' || mode === 'disabled' || mode === 'none') {
    return new NullCache();
  }

  if (mode === 'redis') {
    const redisCache = await createRedisCache({ env, logger, ttlSeconds });
    if (redisCache) return redisCache;
  }

  return new MemoryCache({ ttlSeconds });
}

export function stableCacheKey(namespace, input, version = 'v1') {
  return `${version}:${namespace}:${stableStringify(input)}`;
}

class NullCache {
  constructor() {
    this.name = 'off';
  }

  async get() {
    return undefined;
  }

  async set() {}
}

class MemoryCache {
  constructor({ ttlSeconds }) {
    this.name = 'memory';
    this.ttlMs = ttlSeconds * 1000;
    this.items = new Map();
  }

  async get(key) {
    const item = this.items.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiresAt) {
      this.items.delete(key);
      return undefined;
    }
    return item.value;
  }

  async set(key, value, ttlSeconds) {
    const ttlMs = positiveInteger(ttlSeconds, this.ttlMs / 1000) * 1000;
    this.items.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });

    if (this.items.size > 10_000) {
      const now = Date.now();
      for (const [itemKey, item] of this.items.entries()) {
        if (now > item.expiresAt) this.items.delete(itemKey);
      }
    }
  }
}

async function createRedisCache({ env, logger, ttlSeconds }) {
  if (!env.REDIS_URL) {
    logger?.warn?.({ cache_mode: 'redis' }, 'Redis cache requested but REDIS_URL is not configured');
    return undefined;
  }

  let createClient;
  try {
    ({ createClient } = await import('redis'));
  } catch {
    logger?.warn?.({ cache_mode: 'redis' }, 'Redis package is not installed; using memory cache');
    return undefined;
  }

  try {
    const client = createClient({ url: env.REDIS_URL });
    client.on('error', (error) => {
      logger?.warn?.({ error: error.message }, 'Redis cache error');
    });
    await client.connect();
    return new RedisCache({ client, ttlSeconds });
  } catch (error) {
    logger?.warn?.({ error: error.message }, 'Redis cache unavailable; using memory cache');
    return undefined;
  }
}

class RedisCache {
  constructor({ client, ttlSeconds }) {
    this.name = 'redis';
    this.client = client;
    this.ttlSeconds = ttlSeconds;
  }

  async get(key) {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : undefined;
  }

  async set(key, value, ttlSeconds = this.ttlSeconds) {
    await this.client.set(key, JSON.stringify(value), {
      EX: positiveInteger(ttlSeconds, this.ttlSeconds)
    });
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}
