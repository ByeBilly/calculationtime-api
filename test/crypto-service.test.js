import test from 'node:test';
import assert from 'node:assert/strict';
import { base64Decode, base64Encode, hashPayload } from '../src/crypto-service.js';

test('hashes small payloads with native Node crypto', () => {
  assert.equal(hashPayload('md5', { text: 'abc' }).digest_hex, '900150983cd24fb0d6963f7d28e17f72');
  assert.equal(hashPayload('sha256', { text: 'abc' }).digest_hex, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(hashPayload('sha512', { text: 'abc' }).digest_hex.startsWith('ddaf35a193617aba'), true);
});

test('encodes and decodes Base64 payloads', () => {
  assert.equal(base64Encode({ text: 'calculationtime' }).base64, 'Y2FsY3VsYXRpb250aW1l');
  assert.equal(base64Decode({ base64: 'Y2FsY3VsYXRpb250aW1l' }).text, 'calculationtime');
});

test('rejects invalid Base64 input cleanly', () => {
  assert.throws(
    () => base64Decode({ base64: 'not valid!' }),
    (error) => error.statusCode === 400 && error.code === 'invalid_base64'
  );
});
