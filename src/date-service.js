import { DateTime } from 'luxon';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(value, name) {
  if (!value) {
    throw Object.assign(new Error(`Missing ${name}`), {
      statusCode: 400,
      code: 'missing_date'
    });
  }

  const parsed = DateTime.fromISO(String(value), { zone: 'utc' });
  if (!parsed.isValid || !ISO_DATE.test(String(value).slice(0, 10))) {
    throw Object.assign(new Error(`${name} must be an ISO date like 2026-07-12`), {
      statusCode: 400,
      code: 'invalid_date'
    });
  }

  return parsed.startOf('day');
}

export function dateDifference(input) {
  const start = parseDate(input.start, 'start');
  const end = parseDate(input.end, 'end');
  const signedDays = Math.trunc(end.diff(start, 'days').days);
  const absoluteDays = Math.abs(signedDays);

  return {
    input: {
      start: start.toISODate(),
      end: end.toISODate()
    },
    days: signedDays,
    absolute_days: absoluteDays,
    inclusive_days: absoluteDays + 1,
    weeks: signedDays / 7,
    direction: signedDays === 0 ? 'same_day' : signedDays > 0 ? 'forward' : 'backward'
  };
}

export function batchDateDifference(input) {
  const ranges = Array.isArray(input.ranges) ? input.ranges : [];
  if (ranges.length === 0 || ranges.length > 1000) {
    throw Object.assign(new Error('ranges must contain 1 to 1000 date range objects'), {
      statusCode: 400,
      code: 'invalid_batch'
    });
  }

  const results = ranges.map((range, index) => ({
    index,
    ...dateDifference(range)
  }));

  return {
    input: {
      count: ranges.length
    },
    count: results.length,
    results,
    method: 'calendar_day_difference_batch',
    limitations: [
      'Calendar day differences use ISO dates at UTC day boundaries.',
      'Jurisdiction-specific holidays are handled by business-day and future holiday endpoints, not this raw date-difference endpoint.'
    ]
  };
}

export function addToDate(input) {
  const start = parseDate(input.start, 'start');
  const duration = {
    years: integer(input.years ?? 0, 'years'),
    months: integer(input.months ?? 0, 'months'),
    weeks: integer(input.weeks ?? 0, 'weeks'),
    days: integer(input.days ?? 0, 'days')
  };
  const result = start.plus(duration);

  return {
    input: {
      start: start.toISODate(),
      ...duration
    },
    result_date: result.toISODate(),
    weekday: result.weekdayLong
  };
}

export function businessDays(input) {
  const start = parseDate(input.start, 'start');
  const end = parseDate(input.end, 'end');
  const holidays = new Set((input.holidays || []).map((date) => parseDate(date, 'holiday').toISODate()));
  const direction = end >= start ? 1 : -1;
  let cursor = start;
  let count = 0;

  while (direction > 0 ? cursor < end : cursor > end) {
    cursor = cursor.plus({ days: direction });
    if (isBusinessDay(cursor, holidays)) count += direction;
  }

  return {
    input: {
      start: start.toISODate(),
      end: end.toISODate(),
      holidays: [...holidays]
    },
    business_days: count,
    absolute_business_days: Math.abs(count),
    direction: count === 0 ? 'same_day_or_no_business_days' : count > 0 ? 'forward' : 'backward',
    weekend_definition: 'Saturday and Sunday excluded'
  };
}

function integer(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw Object.assign(new Error(`${name} must be an integer`), {
      statusCode: 400,
      code: 'invalid_integer'
    });
  }
  return parsed;
}

function isBusinessDay(date, holidays) {
  return date.weekday <= 5 && !holidays.has(date.toISODate());
}
