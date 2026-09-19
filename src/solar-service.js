import { DateTime } from 'luxon';
import { parseNumber } from './geo-service.js';

export function solarPosition(input = {}) {
  const lat = parseNumber(input.lat, 'lat', -90, 90);
  const lon = parseNumber(input.lon, 'lon', -180, 180);
  const at = parseTimestamp(input.at || input.date);
  const dayOfYear = Number(at.toFormat('o'));
  const hour = at.hour + at.minute / 60 + at.second / 3600 + at.millisecond / 3_600_000;
  const gamma = (2 * Math.PI / daysInYear(at.year)) * (dayOfYear - 1 + (hour - 12) / 24);
  const equationOfTime = 229.18 * (
    0.000075
    + 0.001868 * Math.cos(gamma)
    - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma)
    - 0.040849 * Math.sin(2 * gamma)
  );
  const declination = 0.006918
    - 0.399912 * Math.cos(gamma)
    + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma)
    + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma)
    + 0.00148 * Math.sin(3 * gamma);

  const timeOffset = equationOfTime + 4 * lon;
  const trueSolarTime = modulo((hour * 60) + timeOffset, 1440);
  const hourAngleDegrees = trueSolarTime / 4 < 0
    ? trueSolarTime / 4 + 180
    : trueSolarTime / 4 - 180;

  const latRad = toRadians(lat);
  const hourAngle = toRadians(hourAngleDegrees);
  const zenith = Math.acos(
    Math.sin(latRad) * Math.sin(declination)
    + Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle)
  );
  const elevation = 90 - toDegrees(zenith);
  const atmosphericRefraction = refractionCorrection(elevation);
  const apparentElevation = elevation + atmosphericRefraction;
  const azimuth = solarAzimuth(latRad, declination, hourAngle, zenith);

  return {
    input: {
      lat,
      lon,
      at: at.toISO()
    },
    solar_position: {
      azimuth_degrees: round(azimuth, 6),
      elevation_degrees: round(elevation, 6),
      apparent_elevation_degrees: round(apparentElevation, 6),
      zenith_degrees: round(toDegrees(zenith), 6),
      hour_angle_degrees: round(hourAngleDegrees, 6),
      declination_degrees: round(toDegrees(declination), 6),
      equation_of_time_minutes: round(equationOfTime, 6)
    },
    daylight_state: apparentElevation > 0 ? 'sun_above_horizon' : 'sun_below_horizon',
    method: 'noaa_solar_position_approximation',
    limitations: [
      'Solar position is calculated locally using common NOAA-style approximation formulae.',
      'Atmospheric refraction is approximate and weather-independent.',
      'Terrain horizon, buildings, trees, and local obstructions are not included in this endpoint.'
    ]
  };
}

function parseTimestamp(value) {
  if (!value) {
    throw Object.assign(new Error('Missing at'), {
      statusCode: 400,
      code: 'missing_timestamp'
    });
  }

  const raw = String(value).trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? DateTime.fromISO(raw, { zone: 'utc' }).startOf('day')
    : DateTime.fromISO(raw, { zone: 'utc' });

  if (!parsed.isValid) {
    throw Object.assign(new Error('at must be an ISO timestamp like 2026-07-26T12:00:00Z'), {
      statusCode: 400,
      code: 'invalid_timestamp'
    });
  }

  return parsed.toUTC();
}

function daysInYear(year) {
  return DateTime.utc(year).isInLeapYear ? 366 : 365;
}

function solarAzimuth(latRad, declination, hourAngle, zenith) {
  const denominator = Math.sin(zenith) * Math.cos(latRad);
  if (Math.abs(denominator) < 1e-12) return 180;

  const azimuthRad = Math.acos(
    clamp((Math.sin(latRad) * Math.cos(zenith) - Math.sin(declination)) / denominator, -1, 1)
  );
  const azimuth = toDegrees(azimuthRad);
  return hourAngle > 0 ? modulo(azimuth + 180, 360) : modulo(540 - azimuth, 360);
}

function refractionCorrection(elevation) {
  if (elevation > 85) return 0;
  const te = Math.tan(toRadians(elevation));
  let correction;
  if (elevation > 5) {
    correction = 58.1 / te - 0.07 / (te ** 3) + 0.000086 / (te ** 5);
  } else if (elevation > -0.575) {
    correction = 1735
      + elevation * (-518.2 + elevation * (103.4 + elevation * (-12.79 + elevation * 0.711)));
  } else {
    correction = -20.774 / te;
  }
  return correction / 3600;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function modulo(value, mod) {
  return ((value % mod) + mod) % mod;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function round(value, places) {
  return Number(value.toFixed(places));
}
