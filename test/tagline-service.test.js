import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyTagline, secondsUntilNextUtcMidnight, seededIndex, utcDateString } from '../src/tagline-service.js';

test('UTC date string uses the global calendar day', () => {
  assert.equal(utcDateString('2026-07-29T23:59:59.000Z'), '2026-07-29');
  assert.equal(utcDateString('2026-07-30T00:00:00.000Z'), '2026-07-30');
});

test('seeded index is deterministic for the same date', () => {
  assert.equal(seededIndex('2026-07-29', 40), seededIndex('2026-07-29', 40));
  assert.notEqual(seededIndex('2026-07-29', 40), seededIndex('2026-07-30', 40));
});

test('daily tagline returns the same result throughout a UTC date', async () => {
  const early = await dailyTagline(new Date('2026-07-29T00:00:01.000Z'));
  const late = await dailyTagline(new Date('2026-07-29T23:59:59.000Z'));

  assert.deepEqual(early, late);
  assert.equal(early.date, '2026-07-29');
  assert.equal(typeof early.tagline, 'string');
  assert.equal(typeof early.category, 'string');
});

test('daily tagline changes at UTC midnight when the seed changes', async () => {
  const today = await dailyTagline(new Date('2026-07-29T23:59:59.000Z'));
  const tomorrow = await dailyTagline(new Date('2026-07-30T00:00:00.000Z'));

  assert.notDeepEqual(today, tomorrow);
  assert.equal(tomorrow.date, '2026-07-30');
});

test('cache ttl is capped by next UTC midnight', () => {
  assert.equal(secondsUntilNextUtcMidnight(new Date('2026-07-29T23:59:30.000Z')), 30);
  assert.equal(secondsUntilNextUtcMidnight(new Date('2026-07-29T12:00:00.000Z')), 43_200);
});
