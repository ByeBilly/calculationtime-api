import { DateTime } from 'luxon';
import { businessDays, parseDate } from './date-service.js';

const DATASET_VERSION = 'holidays-beta-2026-07-13';

export function holidaysForYear(input) {
  const country = normalizeCountry(input.country);
  const year = parseYear(input.year);
  const holidays = generateHolidays(country, year);

  return {
    input: {
      country: country.requested,
      normalized_country: country.normalized,
      subdivision: country.subdivision,
      year
    },
    count: holidays.length,
    holidays,
    dataset_version: DATASET_VERSION,
    method: 'rule_generated_public_holidays_beta',
    limitations: country.limitations
  };
}

export function nextHoliday(input) {
  const country = normalizeCountry(input.country);
  const from = parseDate(input.from || DateTime.utc().toISODate(), 'from');
  const years = [from.year, from.year + 1];
  const upcoming = years
    .flatMap((year) => generateHolidays(country, year))
    .filter((holiday) => DateTime.fromISO(holiday.date, { zone: 'utc' }) >= from)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    input: {
      country: country.requested,
      normalized_country: country.normalized,
      subdivision: country.subdivision,
      from: from.toISODate()
    },
    holiday: upcoming[0] || null,
    dataset_version: DATASET_VERSION,
    method: 'rule_generated_next_public_holiday_beta',
    limitations: country.limitations
  };
}

export function isBusinessDayInJurisdiction(input) {
  const country = normalizeCountry(input.country);
  const date = parseDate(input.date, 'date');
  const holidays = generateHolidays(country, date.year);
  const matchedHoliday = holidays.find((holiday) => holiday.date === date.toISODate());
  const isWeekend = date.weekday > 5;

  return {
    input: {
      date: date.toISODate(),
      country: country.requested,
      normalized_country: country.normalized,
      subdivision: country.subdivision
    },
    is_business_day: !isWeekend && !matchedHoliday,
    is_weekend: isWeekend,
    holiday: matchedHoliday || null,
    dataset_version: DATASET_VERSION,
    method: 'weekend_plus_rule_generated_public_holidays_beta',
    limitations: country.limitations
  };
}

export function businessDaysInJurisdiction(input) {
  const country = normalizeCountry(input.country);
  const start = parseDate(input.start, 'start');
  const end = parseDate(input.end, 'end');
  const minYear = Math.min(start.year, end.year);
  const maxYear = Math.max(start.year, end.year);
  const holidays = [];

  for (let year = minYear; year <= maxYear; year += 1) {
    holidays.push(...generateHolidays(country, year).map((holiday) => holiday.date));
  }

  const result = businessDays({
    start: start.toISODate(),
    end: end.toISODate(),
    holidays
  });

  return {
    ...result,
    input: {
      ...result.input,
      country: country.requested,
      normalized_country: country.normalized,
      subdivision: country.subdivision
    },
    holiday_count: holidays.length,
    dataset_version: DATASET_VERSION,
    method: 'business_days_with_rule_generated_public_holidays_beta',
    limitations: country.limitations
  };
}

function generateHolidays(country, year) {
  if (country.normalized === 'US') return usFederalHolidays(year);
  if (country.normalized === 'GB') return ukEnglandWalesHolidays(year);
  if (country.normalized === 'AU') return auNationalHolidays(year);
  throw Object.assign(new Error('Unsupported holiday country'), {
    statusCode: 400,
    code: 'unsupported_country'
  });
}

function normalizeCountry(value) {
  const requested = String(value || '').trim().toUpperCase();
  if (!requested) {
    throw Object.assign(new Error('Missing country'), {
      statusCode: 400,
      code: 'missing_country'
    });
  }

  if (requested === 'US' || requested === 'USA') {
    return {
      requested,
      normalized: 'US',
      subdivision: 'federal',
      limitations: [
        'US beta lane covers federal public holidays only.',
        'State holidays and local closures are not included yet.'
      ]
    };
  }

  if (requested === 'UK' || requested === 'GB' || requested === 'GB-ENG' || requested === 'GB-WLS') {
    return {
      requested,
      normalized: 'GB',
      subdivision: 'england_wales',
      limitations: [
        'UK beta lane currently follows England and Wales bank-holiday rules.',
        'Scotland and Northern Ireland variants are not included yet.'
      ]
    };
  }

  if (requested === 'AU' || requested === 'AUS') {
    return {
      requested,
      normalized: 'AU',
      subdivision: 'national',
      limitations: [
        'AU beta lane covers national public-holiday rules only.',
        'State and territory holidays such as Labour Day variants are not included yet.'
      ]
    };
  }

  throw Object.assign(new Error('country must be AU, UK/GB, or US'), {
    statusCode: 400,
    code: 'unsupported_country'
  });
}

function parseYear(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
    throw Object.assign(new Error('year must be an integer between 1900 and 2100'), {
      statusCode: 400,
      code: 'invalid_year'
    });
  }
  return parsed;
}

function usFederalHolidays(year) {
  const fixed = [
    holiday("New Year's Day", date(year, 1, 1), true),
    holiday('Juneteenth National Independence Day', date(year, 6, 19), true),
    holiday('Independence Day', date(year, 7, 4), true),
    holiday('Veterans Day', date(year, 11, 11), true),
    holiday('Christmas Day', date(year, 12, 25), true)
  ];
  const moving = [
    holiday('Martin Luther King Jr. Day', nthWeekdayOfMonth(year, 1, 1, 3)),
    holiday("Washington's Birthday", nthWeekdayOfMonth(year, 2, 1, 3)),
    holiday('Memorial Day', lastWeekdayOfMonth(year, 5, 1)),
    holiday('Labor Day', nthWeekdayOfMonth(year, 9, 1, 1)),
    holiday('Columbus Day', nthWeekdayOfMonth(year, 10, 1, 2)),
    holiday('Thanksgiving Day', nthWeekdayOfMonth(year, 11, 4, 4))
  ];
  return sortHolidays([...fixed, ...moving]);
}

function ukEnglandWalesHolidays(year) {
  const easter = easterSunday(year);
  const fixedCandidates = [
    { name: "New Year's Day", date: date(year, 1, 1) },
    { name: 'Christmas Day', date: date(year, 12, 25) },
    { name: 'Boxing Day', date: date(year, 12, 26) }
  ];
  const fixed = substituteSequential(fixedCandidates);
  const moving = [
    holiday('Good Friday', easter.minus({ days: 2 })),
    holiday('Easter Monday', easter.plus({ days: 1 })),
    holiday('Early May Bank Holiday', nthWeekdayOfMonth(year, 5, 1, 1)),
    holiday('Spring Bank Holiday', lastWeekdayOfMonth(year, 5, 1)),
    holiday('Summer Bank Holiday', lastWeekdayOfMonth(year, 8, 1))
  ];
  return sortHolidays([...fixed, ...moving]);
}

function auNationalHolidays(year) {
  const easter = easterSunday(year);
  const fixedCandidates = [
    { name: "New Year's Day", date: date(year, 1, 1) },
    { name: 'Australia Day', date: date(year, 1, 26) },
    { name: 'Anzac Day', date: date(year, 4, 25) },
    { name: 'Christmas Day', date: date(year, 12, 25) },
    { name: 'Boxing Day', date: date(year, 12, 26) }
  ];
  const fixed = substituteSequential(fixedCandidates);
  const moving = [
    holiday('Good Friday', easter.minus({ days: 2 })),
    holiday('Easter Monday', easter.plus({ days: 1 }))
  ];
  return sortHolidays([...fixed, ...moving]);
}

function holiday(name, actualDate, observeFixedWeekend = false) {
  const observed = observeFixedWeekend ? observedFridayMonday(actualDate) : actualDate;
  return {
    name,
    date: observed.toISODate(),
    actual_date: actualDate.toISODate(),
    observed: observed.toISODate() !== actualDate.toISODate(),
    type: 'public_holiday'
  };
}

function substituteSequential(items) {
  const used = new Set();
  return items.map((item) => {
    let observed = item.date;
    while (observed.weekday > 5 || used.has(observed.toISODate())) {
      observed = observed.plus({ days: 1 });
    }
    used.add(observed.toISODate());
    return {
      name: item.name,
      date: observed.toISODate(),
      actual_date: item.date.toISODate(),
      observed: observed.toISODate() !== item.date.toISODate(),
      type: 'public_holiday'
    };
  });
}

function observedFridayMonday(day) {
  if (day.weekday === 6) return day.minus({ days: 1 });
  if (day.weekday === 7) return day.plus({ days: 1 });
  return day;
}

function nthWeekdayOfMonth(year, month, weekday, nth) {
  let cursor = date(year, month, 1);
  while (cursor.weekday !== weekday) cursor = cursor.plus({ days: 1 });
  return cursor.plus({ days: 7 * (nth - 1) });
}

function lastWeekdayOfMonth(year, month, weekday) {
  let cursor = date(year, month, DateTime.utc(year, month).daysInMonth);
  while (cursor.weekday !== weekday) cursor = cursor.minus({ days: 1 });
  return cursor;
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return date(year, month, day);
}

function date(year, month, day) {
  return DateTime.utc(year, month, day).startOf('day');
}

function sortHolidays(holidays) {
  return holidays.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}
