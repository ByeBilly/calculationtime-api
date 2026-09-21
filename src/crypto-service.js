import { createHash } from 'node:crypto';

const MAX_TEXT_BYTES = 1_000_000;

export function hashPayload(algorithm, input = {}) {
  if (!['md5', 'sha256', 'sha512'].includes(algorithm)) {
    throw badRequest('unsupported hash algorithm', 'unsupported_algorithm');
  }
  const payload = textPayload(input);
  return {
    input: {
      algorithm,
      encoding: payload.encoding,
      byte_length: payload.buffer.length
    },
    digest_hex: createHash(algorithm).update(payload.buffer).digest('hex'),
    method: `node_crypto_${algorithm}_hash`
  };
}

export function base64Encode(input = {}) {
  const payload = textPayload(input);
  return {
    input: {
      encoding: payload.encoding,
      byte_length: payload.buffer.length
    },
    base64: payload.buffer.toString('base64'),
    method: 'node_buffer_base64_encode'
  };
}

export function base64Decode(input = {}) {
  const raw = requiredString(input.base64 ?? input.value, 'base64');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(raw) || raw.length % 4 !== 0) {
    throw badRequest('base64 must be a valid standard Base64 string', 'invalid_base64');
  }
  const buffer = Buffer.from(raw, 'base64');
  if (buffer.length > MAX_TEXT_BYTES) throw badRequest(`decoded payload must be ${MAX_TEXT_BYTES} bytes or less`, 'payload_too_large');
  return {
    input: {
      byte_length: buffer.length
    },
    text: buffer.toString('utf8'),
    method: 'node_buffer_base64_decode'
  };
}

function textPayload(input) {
  const encoding = String(input.encoding ?? 'utf8').toLowerCase();
  if (!['utf8', 'hex', 'base64'].includes(encoding)) {
    throw badRequest('encoding must be utf8, hex, or base64', 'invalid_encoding');
  }
  const value = requiredString(input.text ?? input.value ?? input.payload, 'text');
  const buffer = Buffer.from(value, encoding);
  if (buffer.length > MAX_TEXT_BYTES) throw badRequest(`payload must be ${MAX_TEXT_BYTES} bytes or less`, 'payload_too_large');
  return { buffer, encoding };
}

function requiredString(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw badRequest(`${name} is required`, 'missing_value');
  return value;
}

function badRequest(message, code) {
  return Object.assign(new Error(message), {
    statusCode: 400,
    code
  });
}
