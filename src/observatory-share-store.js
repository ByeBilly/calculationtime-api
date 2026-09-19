import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const DEFAULT_TTL_DAYS = 30;
const MAX_TTL_DAYS = 365;
const POSTERS = new Set(['moment', 'journey', 'certificate', 'capture', 'datasheet']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

export function createObservatoryShareStore(env = process.env) {
  const filePath = env.OBSERVATORY_SHARE_STORE_PATH || '/var/lib/time-coordinate-api/observatory-shares.json';
  return createJsonShareStore({ filePath });
}

export function createMemoryShareStore({ now = () => new Date(), tokenFactory = defaultTokenFactory } = {}) {
  const records = new Map();
  return createStoreAdapter({
    now,
    tokenFactory,
    async readAll() {
      return Object.fromEntries(records);
    },
    async writeAll(data) {
      records.clear();
      for (const [token, record] of Object.entries(data)) records.set(token, record);
    }
  });
}

function createJsonShareStore({ filePath, now = () => new Date(), tokenFactory = defaultTokenFactory }) {
  return createStoreAdapter({
    now,
    tokenFactory,
    async readAll() {
      try {
        return JSON.parse(await readFile(filePath, 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return {};
        throw error;
      }
    },
    async writeAll(data) {
      await mkdir(dirname(filePath), { recursive: true });
      const tempPath = `${filePath}.${process.pid}.tmp`;
      await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
      await rename(tempPath, filePath);
    }
  });
}

function createStoreAdapter({ now, tokenFactory, readAll, writeAll }) {
  return {
    async create(payload) {
      const cleanPayload = sanitizePayload(payload);
      const createdAt = now();
      const expiresAt = new Date(createdAt.getTime() + cleanPayload.ttl_days * 86_400_000);
      const data = pruneExpired(await readAll(), createdAt);

      let token = tokenFactory();
      while (data[token]) token = tokenFactory();

      data[token] = {
        token,
        payload: cleanPayload,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString()
      };
      await writeAll(data);

      return {
        token,
        payload: cleanPayload,
        expires_at: expiresAt.toISOString()
      };
    },
    async get(token) {
      if (!TOKEN_RE.test(String(token || ''))) return null;
      const checkedAt = now();
      const data = await readAll();
      const record = data[token];
      if (!record) return null;
      if (new Date(record.expires_at).getTime() <= checkedAt.getTime()) {
        delete data[token];
        await writeAll(data);
        return null;
      }
      return record;
    }
  };
}

function sanitizePayload(input = {}) {
  const poster = String(input.poster || '');
  if (!POSTERS.has(poster)) {
    throw badRequest('poster must be one of: moment, journey, certificate, capture, datasheet', 'invalid_poster');
  }

  const date = requiredDate(input.date, 'date');
  const payload = { poster, date, ttl_days: ttlDays(input.ttl_days) };

  if (input.date2 !== undefined && input.date2 !== null && input.date2 !== '') {
    payload.date2 = requiredDate(input.date2, 'date2');
  }
  if (input.location !== undefined) payload.location = sanitizeLocation(input.location);
  if (input.time !== undefined && input.time !== null && input.time !== '') payload.time = String(input.time).slice(0, 64);

  return payload;
}

function requiredDate(value, field) {
  const date = String(value || '');
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw badRequest(`${field} must be a YYYY-MM-DD date`, 'invalid_date');
  }
  return date;
}

function sanitizeLocation(location) {
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    throw badRequest('location must be an object with name, lat, and lng', 'invalid_location');
  }
  const name = String(location.name || '').trim().slice(0, 120);
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (!name || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw badRequest('location must include name, lat -90..90, and lng -180..180', 'invalid_location');
  }
  return { name, lat, lng };
}

function ttlDays(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_TTL_DAYS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_TTL_DAYS) {
    throw badRequest(`ttl_days must be an integer from 1 to ${MAX_TTL_DAYS}`, 'invalid_ttl');
  }
  return parsed;
}

function pruneExpired(data, checkedAt) {
  const checkedTime = checkedAt.getTime();
  return Object.fromEntries(
    Object.entries(data).filter(([, record]) => new Date(record.expires_at).getTime() > checkedTime)
  );
}

function defaultTokenFactory() {
  return randomBytes(16).toString('base64url');
}

function badRequest(message, code) {
  return Object.assign(new Error(message), { statusCode: 400, code });
}
