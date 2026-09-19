import { DateTime } from 'luxon';
import tzLookup from '@photostructure/tz-lookup';

const MAX_LAT = 90;
const MAX_LON = 180;

export function parseCoordinate(value, name) {
  if (value === undefined || value === null || value === '') {
    throw Object.assign(new Error(`Missing ${name}`), {
      statusCode: 400,
      code: 'missing_coordinate'
    });
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw Object.assign(new Error(`${name} must be a finite number`), {
      statusCode: 400,
      code: 'invalid_coordinate'
    });
  }

  if (name === 'lat' && (parsed < -MAX_LAT || parsed > MAX_LAT)) {
    throw Object.assign(new Error('lat must be between -90 and 90'), {
      statusCode: 400,
      code: 'coordinate_out_of_range'
    });
  }

  if (name === 'lon' && (parsed < -MAX_LON || parsed > MAX_LON)) {
    throw Object.assign(new Error('lon must be between -180 and 180'), {
      statusCode: 400,
      code: 'coordinate_out_of_range'
    });
  }

  return parsed;
}

export function parseInstant(value) {
  if (value === undefined || value === null || value === '') {
    return DateTime.utc();
  }

  if (/^-?\d+$/.test(String(value))) {
    const numeric = Number(value);
    const millis = Math.abs(numeric) < 10_000_000_000 ? numeric * 1000 : numeric;
    const fromEpoch = DateTime.fromMillis(millis, { zone: 'utc' });
    if (fromEpoch.isValid) return fromEpoch;
  }

  const fromIso = DateTime.fromISO(String(value), { zone: 'utc' });
  if (!fromIso.isValid) {
    throw Object.assign(new Error('at must be an ISO-8601 timestamp, epoch seconds, or epoch milliseconds'), {
      statusCode: 400,
      code: 'invalid_instant'
    });
  }

  return fromIso.toUTC();
}

export function getTimeForCoordinate({ lat, lon, at }) {
  const latitude = parseCoordinate(lat, 'lat');
  const longitude = parseCoordinate(lon, 'lon');
  const instantUtc = parseInstant(at);
  const timezone = tzLookup(latitude, longitude);
  const local = instantUtc.setZone(timezone);

  if (!local.isValid) {
    throw Object.assign(new Error(`Unable to calculate local time for timezone ${timezone}`), {
      statusCode: 500,
      code: 'time_calculation_failed'
    });
  }

  return {
    input: {
      lat: latitude,
      lon: longitude,
      at: instantUtc.toISO({ suppressMilliseconds: false })
    },
    timezone,
    local_time: local.toISO({ suppressMilliseconds: false }),
    local_date: local.toISODate(),
    local_time_24h: local.toFormat('HH:mm:ss'),
    utc_time: instantUtc.toISO({ suppressMilliseconds: false }),
    utc_offset: local.toFormat('ZZ'),
    utc_offset_minutes: local.offset,
    abbreviation: local.offsetNameShort,
    is_dst: local.isInDST,
    weekday: local.weekdayLong,
    unix_seconds: Math.floor(local.toSeconds()),
    source: {
      timezone_boundary_engine: '@photostructure/tz-lookup',
      timezone_standard: 'IANA timezone identifier',
      time_rules_engine: 'Node.js Intl/Luxon using server tzdb'
    }
  };
}
