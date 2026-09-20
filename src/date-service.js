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

export function businessDaysAdd(input) {
  const start = parseDate(input.start ?? input.date, 'start');
  const amount = integer(input.business_days ?? input.days ?? 0, 'business_days');
  const weekendDays = parseWeekendDays(input.weekend_days ?? [6, 7]);
  const holidays = new Set((input.holidays || []).map((date) => parseDate(date, 'holiday').toISODate()));
  const direction = amount >= 0 ? 1 : -1;
  let remaining = Math.abs(amount);
  let cursor = start;

  while (remaining > 0) {
    cursor = cursor.plus({ days: direction });
    if (isConfiguredBusinessDay(cursor, weekendDays, holidays)) remaining -= 1;
  }

  return {
    input: {
      start: start.toISODate(),
      business_days: amount,
      weekend_days: [...weekendDays],
      holidays: [...holidays]
    },
    result_date: cursor.toISODate(),
    weekday: cursor.weekdayLong,
    direction: amount === 0 ? 'same_day' : amount > 0 ? 'forward' : 'backward',
    method: 'iterative_business_day_add_configurable_weekend'
  };
}

export function isoWeek(input) {
  const date = parseDate(input.date, 'date');
  return {
    input: { date: date.toISODate() },
    iso_week: {
      week_year: date.weekYear,
      week_number: date.weekNumber,
      weekday: date.weekday,
      weekday_name: date.weekdayLong
    },
    method: 'iso_8601_week_calendar'
  };
}

export function ageBreakdown(input) {
  const birth = parseDate(input.birth_date ?? input.start, 'birth_date');
  const asOf = input.as_of ? parseTimestamp(input.as_of, 'as_of') : DateTime.utc();
  const birthInstant = birth.startOf('day');
  if (asOf < birthInstant) {
    throw Object.assign(new Error('as_of must be on or after birth_date'), {
      statusCode: 400,
      code: 'invalid_as_of'
    });
  }
  const calendar = asOf.diff(birthInstant, ['years', 'months', 'days', 'hours', 'minutes', 'seconds']).toObject();
  const totalSeconds = Math.floor(asOf.diff(birthInstant, 'seconds').seconds);

  return {
    input: {
      birth_date: birth.toISODate(),
      as_of: asOf.toUTC().toISO()
    },
    age: {
      years: Math.trunc(calendar.years || 0),
      months: Math.trunc(calendar.months || 0),
      days: Math.trunc(calendar.days || 0),
      hours: Math.trunc(calendar.hours || 0),
      minutes: Math.trunc(calendar.minutes || 0),
      seconds: Math.trunc(calendar.seconds || 0)
    },
    totals: {
      days: Math.floor(totalSeconds / 86400),
      weeks: Math.floor(totalSeconds / 604800),
      seconds: totalSeconds
    },
    method: 'luxon_calendar_duration_breakdown'
  };
}

export function countdownPrecise(input) {
  const start = parseTimestamp(input.start, 'start');
  const end = parseTimestamp(input.end, 'end');
  const direction = end >= start ? 'forward' : 'backward';
  const from = direction === 'forward' ? start : end;
  const to = direction === 'forward' ? end : start;
  const calendar = to.diff(from, ['years', 'months', 'days', 'hours', 'minutes', 'seconds']).toObject();
  const signedSeconds = Math.trunc(end.diff(start, 'seconds').seconds);

  return {
    input: {
      start: start.toUTC().toISO(),
      end: end.toUTC().toISO()
    },
    direction,
    delta: {
      years: Math.trunc(calendar.years || 0),
      months: Math.trunc(calendar.months || 0),
      days: Math.trunc(calendar.days || 0),
      hours: Math.trunc(calendar.hours || 0),
      minutes: Math.trunc(calendar.minutes || 0),
      seconds: Math.trunc(calendar.seconds || 0)
    },
    totals: {
      seconds: signedSeconds,
      absolute_seconds: Math.abs(signedSeconds),
      milliseconds: end.toMillis() - start.toMillis()
    },
    method: 'luxon_precise_calendar_countdown'
  };
}

export function epochConverter(input) {
  const raw = required(input.epoch ?? input.timestamp, 'epoch');
  const unit = String(input.unit || 'auto').toLowerCase();
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    throw Object.assign(new Error('epoch must be a finite number'), {
      statusCode: 400,
      code: 'invalid_epoch'
    });
  }
  const milliseconds = unit === 'seconds' || (unit === 'auto' && Math.abs(numeric) < 100000000000)
    ? numeric * 1000
    : numeric;
  const date = DateTime.fromMillis(milliseconds, { zone: 'utc' });
  if (!date.isValid) {
    throw Object.assign(new Error('epoch is outside supported JavaScript Date range'), {
      statusCode: 400,
      code: 'invalid_epoch'
    });
  }

  return {
    input: { epoch: numeric, unit },
    unix_seconds: Math.floor(milliseconds / 1000),
    unix_milliseconds: Math.trunc(milliseconds),
    iso_utc: date.toISO(),
    rfc_2822: date.toRFC2822(),
    http: date.toHTTP(),
    date: date.toISODate(),
    method: 'unix_epoch_conversion_utc'
  };
}

export function quarterCalculator(input) {
  const date = parseDate(input.date, 'date');
  const fiscalStartMonth = integer(input.fiscal_start_month ?? 1, 'fiscal_start_month');
  if (fiscalStartMonth < 1 || fiscalStartMonth > 12) {
    throw Object.assign(new Error('fiscal_start_month must be between 1 and 12'), {
      statusCode: 400,
      code: 'invalid_fiscal_start_month'
    });
  }
  const fiscalMonthIndex = ((date.month - fiscalStartMonth + 12) % 12) + 1;
  const quarter = Math.floor((date.month - 1) / 3) + 1;
  const fiscalQuarter = Math.floor((fiscalMonthIndex - 1) / 3) + 1;
  const quarterStart = DateTime.utc(date.year, (quarter - 1) * 3 + 1, 1);
  const quarterEnd = quarterStart.plus({ months: 3 }).minus({ days: 1 });
  const fiscalQuarterStartMonth = ((fiscalStartMonth - 1 + (fiscalQuarter - 1) * 3) % 12) + 1;
  const fiscalQuarterStartYear = date.month < fiscalStartMonth && fiscalQuarterStartMonth >= fiscalStartMonth ? date.year - 1 : date.year;
  const fiscalQuarterStart = DateTime.utc(fiscalQuarterStartYear, fiscalQuarterStartMonth, 1);
  const fiscalQuarterEnd = fiscalQuarterStart.plus({ months: 3 }).minus({ days: 1 });

  return {
    input: { date: date.toISODate(), fiscal_start_month: fiscalStartMonth },
    calendar_quarter: quarterPayload(date, quarter, quarterStart, quarterEnd),
    fiscal_quarter: quarterPayload(date, fiscalQuarter, fiscalQuarterStart, fiscalQuarterEnd),
    method: 'calendar_and_fiscal_quarter_progress'
  };
}

export function leapYearCheck(input) {
  const year = integer(input.year, 'year');
  const gregorian = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const julian = year % 4 === 0;
  return {
    input: { year },
    gregorian: {
      is_leap_year: gregorian,
      proof: gregorian ? 'divisible by 4 and not excluded by Gregorian century rules' : 'not divisible under Gregorian leap-year rules'
    },
    julian: {
      is_leap_year: julian,
      proof: julian ? 'divisible by 4' : 'not divisible by 4'
    },
    method: 'gregorian_and_julian_leap_year_rules'
  };
}

export function daysInMonth(input) {
  const year = integer(input.year, 'year');
  const month = integer(input.month, 'month');
  if (month < 1 || month > 12) {
    throw Object.assign(new Error('month must be between 1 and 12'), {
      statusCode: 400,
      code: 'invalid_month'
    });
  }
  const date = DateTime.utc(year, month, 1);
  return {
    input: { year, month },
    days_in_month: date.daysInMonth,
    month_name: date.monthLong,
    is_leap_year: date.isInLeapYear,
    method: 'gregorian_days_in_month'
  };
}

export function timezoneOffset(input) {
  const offset = parseOffset(input.offset ?? input.timezone ?? '+00:00');
  const timestamp = input.timestamp ? parseTimestamp(input.timestamp, 'timestamp') : DateTime.utc();
  const shifted = timestamp.toUTC().plus({ minutes: offset.minutes });
  return {
    input: {
      timestamp: timestamp.toUTC().toISO(),
      offset: offset.label
    },
    offset_minutes: offset.minutes,
    offset_hours: offset.minutes / 60,
    local_timestamp: `${shifted.toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS")}${offset.label}`,
    date_shift_days: Math.trunc(shifted.startOf('day').diff(timestamp.toUTC().startOf('day'), 'days').days),
    method: 'fixed_utc_offset_conversion_no_dst'
  };
}

export function calendarRange(input) {
  const start = parseDate(input.start, 'start');
  const days = integer(input.days ?? 30, 'days');
  if (days < 1 || days > 366) {
    throw Object.assign(new Error('days must be between 1 and 366'), {
      statusCode: 400,
      code: 'invalid_days'
    });
  }
  const weekendDays = parseWeekendDays(input.weekend_days ?? [6, 7]);
  const rows = Array.from({ length: days }, (_, index) => {
    const date = start.plus({ days: index });
    return {
      index,
      date: date.toISODate(),
      weekday: date.weekday,
      weekday_name: date.weekdayLong,
      is_weekend: weekendDays.has(date.weekday),
      iso_week: date.weekNumber,
      iso_week_year: date.weekYear
    };
  });
  return {
    input: { start: start.toISODate(), days, weekend_days: [...weekendDays] },
    count: rows.length,
    dates: rows,
    method: 'deterministic_calendar_range'
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

function required(value, name) {
  if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  throw Object.assign(new Error(`${name} is required`), {
    statusCode: 400,
    code: `missing_${name}`
  });
}

function parseTimestamp(value, name) {
  const raw = required(value, name);
  const parsed = DateTime.fromISO(String(raw), { zone: 'utc' });
  if (parsed.isValid) return parsed.toUTC();
  throw Object.assign(new Error(`${name} must be an ISO timestamp`), {
    statusCode: 400,
    code: `invalid_${name}`
  });
}

function parseWeekendDays(value) {
  const days = Array.isArray(value) ? value : String(value).split(',').map((day) => day.trim());
  const parsed = new Set(days.map((day) => integer(day, 'weekend_days')));
  if (parsed.size === 0 || [...parsed].some((day) => day < 1 || day > 7)) {
    throw Object.assign(new Error('weekend_days must use ISO weekdays 1-7'), {
      statusCode: 400,
      code: 'invalid_weekend_days'
    });
  }
  return parsed;
}

function isBusinessDay(date, holidays) {
  return date.weekday <= 5 && !holidays.has(date.toISODate());
}

function isConfiguredBusinessDay(date, weekendDays, holidays) {
  return !weekendDays.has(date.weekday) && !holidays.has(date.toISODate());
}

function quarterPayload(date, quarter, start, end) {
  const elapsedDays = Math.floor(date.diff(start, 'days').days) + 1;
  const totalDays = Math.floor(end.diff(start, 'days').days) + 1;
  return {
    quarter,
    start_date: start.toISODate(),
    end_date: end.toISODate(),
    elapsed_days: elapsedDays,
    total_days: totalDays,
    progress_percent: Number((elapsedDays / totalDays * 100).toFixed(6))
  };
}

function parseOffset(value) {
  const raw = String(value || '').trim().toUpperCase();
  const normalized = raw === 'UTC' ? '+00:00' : raw.replace(/^UTC/, '');
  if (!/^[+-]\d{2}:\d{2}$/.test(normalized)) {
    throw Object.assign(new Error('offset must look like +10:00 or -05:30'), {
      statusCode: 400,
      code: 'invalid_offset'
    });
  }
  const [hours, minutes] = normalized.slice(1).split(':').map(Number);
  const total = (hours * 60 + minutes) * (normalized.startsWith('-') ? -1 : 1);
  if (Math.abs(total) > 14 * 60) {
    throw Object.assign(new Error('offset must be between -14:00 and +14:00'), {
      statusCode: 400,
      code: 'invalid_offset'
    });
  }
  return { label: normalized, minutes: total };
}
