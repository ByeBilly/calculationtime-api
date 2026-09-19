import test from 'node:test';
import assert from 'node:assert/strict';
import { getTimeForCoordinate } from '../src/time-service.js';

test('returns Europe/Berlin for Munich', () => {
  const result = getTimeForCoordinate({
    lat: 48.137154,
    lon: 11.576124,
    at: '2026-07-12T12:00:00Z'
  });

  assert.equal(result.timezone, 'Europe/Berlin');
  assert.equal(result.utc_offset, '+02:00');
  assert.equal(result.is_dst, true);
});

test('returns Australia/Sydney for Sydney', () => {
  const result = getTimeForCoordinate({
    lat: -33.8688,
    lon: 151.2093,
    at: '2026-07-12T12:00:00Z'
  });

  assert.equal(result.timezone, 'Australia/Sydney');
  assert.equal(result.utc_offset, '+10:00');
});

test('returns America/New_York for New York with DST', () => {
  const result = getTimeForCoordinate({
    lat: 40.7128,
    lon: -74.006,
    at: '2026-07-12T12:00:00Z'
  });

  assert.equal(result.timezone, 'America/New_York');
  assert.equal(result.utc_offset, '-04:00');
  assert.equal(result.is_dst, true);
});

test('rejects out-of-range coordinates', () => {
  assert.throws(() => getTimeForCoordinate({ lat: 91, lon: 0 }), /lat must be between/);
  assert.throws(() => getTimeForCoordinate({ lat: 0, lon: 181 }), /lon must be between/);
});
