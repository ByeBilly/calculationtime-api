import test from 'node:test';
import assert from 'node:assert/strict';
import { addToDate, businessDays, dateDifference } from '../src/date-service.js';

test('calculates date difference', () => {
  const result = dateDifference({
    start: '2026-07-12',
    end: '2026-08-01'
  });

  assert.equal(result.days, 20);
  assert.equal(result.inclusive_days, 21);
});

test('adds duration to date', () => {
  const result = addToDate({
    start: '2026-07-12',
    months: 1,
    days: 5
  });

  assert.equal(result.result_date, '2026-08-17');
  assert.equal(result.weekday, 'Monday');
});

test('calculates business days with holidays', () => {
  const result = businessDays({
    start: '2026-07-13',
    end: '2026-07-17',
    holidays: ['2026-07-15']
  });

  assert.equal(result.business_days, 3);
});
