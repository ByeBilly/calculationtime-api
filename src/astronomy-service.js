import { DateTime } from 'luxon';
import * as Astronomy from 'astronomy-engine';

const CRUX_PARKES = {
  latitude_degrees: -32.99,
  longitude_degrees: 148.26,
  elevation_meters: 415
};
const CRUX_ZERO_DATE = '2026-03-31';
const CRUX_DEFAULT_TIMEZONE = '+10:00';
const SIDEREAL_DEGREES_PER_SOLAR_HOUR = 360.9856473662862 / 24;
const SIDEREAL_DEGREES_PER_SOLAR_DAY = SIDEREAL_DEGREES_PER_SOLAR_HOUR * 24;
const DAILY_MIDNIGHT_ADVANCE_DEGREES = SIDEREAL_DEGREES_PER_SOLAR_DAY % 360;

const BODIES = [
  Astronomy.Body.Sun,
  Astronomy.Body.Moon,
  Astronomy.Body.Mercury,
  Astronomy.Body.Venus,
  Astronomy.Body.Earth,
  Astronomy.Body.Mars,
  Astronomy.Body.Jupiter,
  Astronomy.Body.Saturn,
  Astronomy.Body.Uranus,
  Astronomy.Body.Neptune,
  Astronomy.Body.Pluto
];

const PLANET_BODIES = new Set([
  Astronomy.Body.Mercury,
  Astronomy.Body.Venus,
  Astronomy.Body.Earth,
  Astronomy.Body.Mars,
  Astronomy.Body.Jupiter,
  Astronomy.Body.Saturn,
  Astronomy.Body.Uranus,
  Astronomy.Body.Neptune,
  Astronomy.Body.Pluto
]);

export function ephemerisForDate(input = {}) {
  const at = parseAstronomyDate(input.date || input.at);
  const observer = new Astronomy.Observer(0, 0, 0);

  return {
    input: {
      date: at.toISO()
    },
    bodies: BODIES.map((body) => bodyTelemetry(body, at.toJSDate(), observer)),
    method: 'astronomy-engine_vsop87_geocentric_and_heliocentric_vectors',
    units: {
      distance: 'astronomical_units',
      right_ascension: 'sidereal_hours',
      declination: 'degrees',
      ecliptic_longitude: 'degrees',
      ecliptic_latitude: 'degrees',
      vectors: 'astronomical_units'
    },
    limitations: [
      'Planetary positions are mathematical ephemeris calculations, not observational weather or visibility forecasts.',
      'Right ascension and declination are geocentric apparent coordinates for an equator/equinox of date calculation.',
      'Observer-specific horizon altitude, azimuth, rise, and set times require a future location-aware endpoint.'
    ]
  };
}

export function cruxMidnightRange(input = {}) {
  const startDate = parseIsoDate(input.start_date ?? input.startDate ?? CRUX_ZERO_DATE, 'start_date');
  const days = integer(input.days ?? 365, 'days', 1, 3660);
  const timezone = parseTimezoneOffset(input.timezone ?? CRUX_DEFAULT_TIMEZONE);

  const rows = [];
  for (let offset = 0; offset < days; offset += 1) {
    const localMidnight = startDate.plus({ days: offset }).startOf('day');
    const timestamp = localMidnight.toISODate();
    const dayIndex = Math.round(localMidnight.diff(cruxZeroLocalDate(), 'days').days);
    rows.push({
      date: timestamp,
      local_midnight: withTimezone(timestamp, '00:00:00', timezone).toISO(),
      day_index: dayIndex,
      crux_hand_degrees: cruxAngleForLocalDateTime(withTimezone(timestamp, '00:00:00', timezone)),
      midnight_sidereal_advance_degrees: round(positiveModulo(dayIndex * DAILY_MIDNIGHT_ADVANCE_DEGREES, 360), 9)
    });
  }

  return {
    input: {
      start_date: startDate.toISODate(),
      days,
      timezone: timezone.label
    },
    calibration: cruxCalibration(),
    count: rows.length,
    positions: rows,
    method: 'parkes_crux_hand_sidereal_clock_zeroed_2026_03_31_local_midnight'
  };
}

export function cruxHourly(input = {}) {
  const date = parseIsoDate(requiredValue(input.date, 'date'), 'date');
  const timezone = parseTimezoneOffset(input.timezone ?? CRUX_DEFAULT_TIMEZONE);
  const rows = [];

  for (let hour = 0; hour < 24; hour += 1) {
    const localTime = withTimezone(date.toISODate(), `${String(hour).padStart(2, '0')}:00:00`, timezone);
    const elapsedHours = elapsedSolarHoursSinceCruxZero(localTime);
    rows.push({
      hour,
      local_time: localTime.toISO(),
      utc_time: localTime.toUTC().toISO(),
      elapsed_solar_hours: round(elapsedHours, 9),
      crux_hand_degrees: cruxAngleForLocalDateTime(localTime),
      sidereal_hours: siderealHoursForAngle(cruxAngleForLocalDateTime(localTime))
    });
  }

  return {
    input: {
      date: date.toISODate(),
      timezone: timezone.label
    },
    calibration: cruxCalibration(),
    count: rows.length,
    positions: rows,
    method: 'parkes_crux_hourly_sidereal_clock_breakdown'
  };
}

export function cruxCurrent(input = {}) {
  const timestamp = input.timestamp ? parseTimestamp(input.timestamp, 'timestamp') : DateTime.utc();
  const timezone = parseTimezoneOffset(input.timezone ?? CRUX_DEFAULT_TIMEZONE);
  const localTime = timestamp.setZone(timezone.label);
  const angle = cruxAngleForLocalDateTime(localTime);
  const zeroDelta = positiveModulo(angle, 360);

  return {
    input: {
      timestamp: timestamp.toUTC().toISO(),
      timezone: timezone.label
    },
    parkes_observatory: CRUX_PARKES,
    calibration: cruxCalibration(),
    local_time: localTime.toISO(),
    utc_time: timestamp.toUTC().toISO(),
    crux_hand_degrees: angle,
    sidereal_time: {
      hours: siderealHoursForAngle(angle),
      degrees: angle
    },
    parkes_alignment_delta: {
      from_zero_degrees: round(zeroDelta, 9),
      from_zero_sidereal_hours: siderealHoursForAngle(zeroDelta),
      zero_reference: `${CRUX_ZERO_DATE}T00:00:00${CRUX_DEFAULT_TIMEZONE}`
    },
    method: 'parkes_crux_current_sidereal_clock_position'
  };
}

function bodyTelemetry(body, date, observer) {
  const geocentric = Astronomy.GeoVector(body, date, true);
  const heliocentric = Astronomy.HelioVector(body, date);
  const equator = Astronomy.Equator(body, date, observer, true, true);
  const ecliptic = Astronomy.Ecliptic(geocentric);

  return {
    id: String(body).toLowerCase(),
    name: body,
    kind: PLANET_BODIES.has(body) ? 'planet' : body === Astronomy.Body.Moon ? 'moon' : 'star',
    geocentric: {
      distance_au: round(equator.dist, 9),
      vector: vector(geocentric),
      right_ascension_hours: round(equator.ra, 9),
      declination_degrees: round(equator.dec, 9),
      ecliptic_longitude_degrees: round(ecliptic.elon, 9),
      ecliptic_latitude_degrees: round(ecliptic.elat, 9)
    },
    heliocentric: {
      distance_au: round(distance(heliocentric), 9),
      vector: vector(heliocentric)
    }
  };
}

function parseAstronomyDate(value) {
  if (!value) {
    throw Object.assign(new Error('Missing date'), {
      statusCode: 400,
      code: 'missing_date'
    });
  }

  const raw = String(value).trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? DateTime.fromISO(raw, { zone: 'utc' }).startOf('day')
    : DateTime.fromISO(raw, { zone: 'utc' });

  if (!parsed.isValid) {
    throw Object.assign(new Error('date must be an ISO date or timestamp like 2029-10-21 or 2029-10-21T00:00:00Z'), {
      statusCode: 400,
      code: 'invalid_date'
    });
  }

  const year = parsed.year;
  if (year < 1900 || year > 2100) {
    throw Object.assign(new Error('date must be between 1900-01-01 and 2100-12-31 for this beta endpoint'), {
      statusCode: 400,
      code: 'date_out_of_range'
    });
  }

  return parsed.toUTC();
}

function cruxAngleForLocalDateTime(localTime) {
  return round(positiveModulo(elapsedSolarHoursSinceCruxZero(localTime) * SIDEREAL_DEGREES_PER_SOLAR_HOUR, 360), 9);
}

function elapsedSolarHoursSinceCruxZero(localTime) {
  return localTime.toUTC().diff(cruxZeroLocalDate().toUTC(), 'hours').hours;
}

function cruxZeroLocalDate() {
  return DateTime.fromISO(`${CRUX_ZERO_DATE}T00:00:00${CRUX_DEFAULT_TIMEZONE}`);
}

function cruxCalibration() {
  return {
    observatory: 'Parkes Observatory',
    coordinates: CRUX_PARKES,
    zero_reference_local: `${CRUX_ZERO_DATE}T00:00:00${CRUX_DEFAULT_TIMEZONE}`,
    zero_angle_degrees: 0,
    sidereal_degrees_per_solar_hour: round(SIDEREAL_DEGREES_PER_SOLAR_HOUR, 12),
    sidereal_degrees_per_solar_day: round(SIDEREAL_DEGREES_PER_SOLAR_DAY, 12),
    midnight_advance_degrees_per_solar_day: round(DAILY_MIDNIGHT_ADVANCE_DEGREES, 12),
    note: 'Crux hand angle is clockwise on the project clock face, zeroed at Parkes local midnight on 2026-03-31.'
  };
}

function parseIsoDate(value, label) {
  const raw = String(value || '').trim();
  const parsed = DateTime.fromISO(raw, { zone: 'utc' });
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && parsed.isValid) {
    return parsed.startOf('day');
  }
  throw Object.assign(new Error(`${label} must be an ISO calendar date like 2026-03-31`), {
    statusCode: 400,
    code: `invalid_${label}`
  });
}

function parseTimestamp(value, label) {
  const parsed = DateTime.fromISO(String(value).trim(), { zone: 'utc' });
  if (parsed.isValid) return parsed.toUTC();
  throw Object.assign(new Error(`${label} must be an ISO timestamp like 2026-03-31T00:00:00+10:00`), {
    statusCode: 400,
    code: `invalid_${label}`
  });
}

function parseTimezoneOffset(value) {
  const raw = String(value || '').trim().toUpperCase();
  const normalized = raw === 'UTC+10' ? '+10:00' : raw === 'UTC' ? '+00:00' : raw;
  if (!/^[+-]\d{2}:\d{2}$/.test(normalized)) {
    throw Object.assign(new Error('timezone must be an offset like +10:00 or +09:30'), {
      statusCode: 400,
      code: 'invalid_timezone'
    });
  }
  const [hours, minutes] = normalized.slice(1).split(':').map(Number);
  const totalMinutes = (hours * 60 + minutes) * (normalized.startsWith('-') ? -1 : 1);
  if (Math.abs(totalMinutes) > 14 * 60) {
    throw Object.assign(new Error('timezone offset must be between -14:00 and +14:00'), {
      statusCode: 400,
      code: 'invalid_timezone'
    });
  }
  return {
    label: normalized,
    minutes: totalMinutes
  };
}

function withTimezone(date, time, timezone) {
  return DateTime.fromISO(`${date}T${time}${timezone.label}`, { setZone: true });
}

function integer(value, label, min, max) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= min && parsed <= max) return parsed;
  throw Object.assign(new Error(`${label} must be an integer between ${min} and ${max}`), {
    statusCode: 400,
    code: `invalid_${label}`
  });
}

function requiredValue(value, label) {
  if (value !== undefined && value !== null && String(value).trim()) return value;
  throw Object.assign(new Error(`${label} is required`), {
    statusCode: 400,
    code: `missing_${label}`
  });
}

function siderealHoursForAngle(angle) {
  return round(positiveModulo(angle, 360) / 15, 9);
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function vector(value) {
  return {
    x: round(value.x, 9),
    y: round(value.y, 9),
    z: round(value.z, 9)
  };
}

function distance(value) {
  return Math.sqrt(value.x ** 2 + value.y ** 2 + value.z ** 2);
}

function round(value, places) {
  return Number(value.toFixed(places));
}
