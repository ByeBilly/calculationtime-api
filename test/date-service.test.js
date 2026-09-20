import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addToDate,
  ageBreakdown,
  businessDays,
  businessDaysAdd,
  calendarRange,
  countdownPrecise,
  dateDifference,
  daysInMonth,
  epochConverter,
  isoWeek,
  leapYearCheck,
  quarterCalculator,
  timezoneOffset
} from '../src/date-service.js';

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

test('phase 2 date math endpoints produce deterministic values', () => {
  assert.equal(
    businessDaysAdd({ start: '2026-07-13', business_days: 5, holidays: ['2026-07-15'] }).result_date,
    '2026-07-21'
  );

  const week = isoWeek({ date: '2026-01-01' });
  assert.equal(week.iso_week.week_number, 1);
  assert.equal(week.iso_week.weekday, 4);

  const age = ageBreakdown({ birth_date: '2000-01-01', as_of: '2026-01-02T03:04:05Z' });
  assert.equal(age.age.years, 26);
  assert.equal(age.age.days, 1);
  assert.ok(age.totals.seconds > 820000000);

  const countdown = countdownPrecise({ start: '2026-09-21T00:00:00Z', end: '2027-01-01T12:30:15Z' });
  assert.equal(countdown.direction, 'forward');
  assert.equal(countdown.delta.months, 3);
  assert.equal(countdown.delta.days, 11);

  const epoch = epochConverter({ epoch: 946684800, unit: 'seconds' });
  assert.equal(epoch.iso_utc, '2000-01-01T00:00:00.000Z');
  assert.equal(epoch.date, '2000-01-01');

  const quarter = quarterCalculator({ date: '2026-09-21', fiscal_start_month: 4 });
  assert.equal(quarter.calendar_quarter.quarter, 3);
  assert.equal(quarter.fiscal_quarter.quarter, 2);

  const leap = leapYearCheck({ year: 1900 });
  assert.equal(leap.gregorian.is_leap_year, false);
  assert.equal(leap.julian.is_leap_year, true);

  const month = daysInMonth({ year: 2028, month: 2 });
  assert.equal(month.days_in_month, 29);

  const offset = timezoneOffset({ timestamp: '2026-09-21T00:00:00Z', offset: '+10:00' });
  assert.equal(offset.local_timestamp, '2026-09-21T10:00:00.000+10:00');

  const range = calendarRange({ start: '2026-09-21', days: 3 });
  assert.equal(range.count, 3);
  assert.equal(range.dates[0].weekday_name, 'Monday');
});

test('phase 2 date math endpoints validate bad input', () => {
  assert.throws(
    () => businessDaysAdd({ start: '2026-07-13', business_days: 1, weekend_days: [0] }),
    (error) => error.statusCode === 400 && error.code === 'invalid_weekend_days'
  );
  assert.throws(
    () => daysInMonth({ year: 2026, month: 13 }),
    (error) => error.statusCode === 400 && error.code === 'invalid_month'
  );
  assert.throws(
    () => timezoneOffset({ offset: 'Europe/Berlin' }),
    (error) => error.statusCode === 400 && error.code === 'invalid_offset'
  );
});
