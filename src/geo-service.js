const EARTH_RADIUS_KM = 6371.0088;
const KM_PER_MILE = 1.609344;

export function parseNumber(value, name, min, max) {
  if (value === undefined || value === null || value === '') {
    throw Object.assign(new Error(`Missing ${name}`), {
      statusCode: 400,
      code: 'missing_value'
    });
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw Object.assign(new Error(`${name} must be a finite number`), {
      statusCode: 400,
      code: 'invalid_number'
    });
  }

  if (parsed < min || parsed > max) {
    throw Object.assign(new Error(`${name} must be between ${min} and ${max}`), {
      statusCode: 400,
      code: 'value_out_of_range'
    });
  }

  return parsed;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function normalizeBearing(degrees) {
  return (degrees + 360) % 360;
}

function parsePoint(input, prefix = '') {
  return {
    lat: parseNumber(input[`${prefix}lat`] ?? input.lat, `${prefix}lat`, -90, 90),
    lon: parseNumber(input[`${prefix}lon`] ?? input.lon, `${prefix}lon`, -180, 180)
  };
}

export function distanceBetweenPoints(input) {
  const from = parsePoint(input, 'from_');
  const to = parsePoint(input, 'to_');
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLon = toRadians(to.lon - from.lon);

  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const centralAngle = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = EARTH_RADIUS_KM * centralAngle;

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  const initialBearing = normalizeBearing(toDegrees(Math.atan2(y, x)));

  return {
    input: { from, to },
    distance: {
      kilometers: km,
      miles: km / KM_PER_MILE,
      meters: km * 1000,
      nautical_miles: km / 1.852
    },
    bearing: {
      initial_degrees: initialBearing,
      compass: compassPoint(initialBearing)
    },
    method: 'haversine_sphere',
    earth_radius_km: EARTH_RADIUS_KM
  };
}

export function batchDistanceBetweenPoints(input) {
  const pairs = Array.isArray(input.pairs) ? input.pairs : [];
  if (pairs.length === 0 || pairs.length > 500) {
    throw Object.assign(new Error('pairs must contain 1 to 500 coordinate pair objects'), {
      statusCode: 400,
      code: 'invalid_batch'
    });
  }

  const results = pairs.map((pair, index) => ({
    index,
    ...distanceBetweenPoints(pair)
  }));

  return {
    input: {
      count: pairs.length
    },
    count: results.length,
    results,
    method: 'haversine_sphere_batch',
    limitations: [
      'Uses a spherical Earth Haversine calculation.',
      'For survey-grade geodesy, use a future ellipsoidal precision mode.'
    ]
  };
}

export function midpointBetweenPoints(input) {
  const from = parsePoint(input, 'from_');
  const to = parsePoint(input, 'to_');
  const lat1 = toRadians(from.lat);
  const lon1 = toRadians(from.lon);
  const lat2 = toRadians(to.lat);
  const deltaLon = toRadians(to.lon - from.lon);

  const bx = Math.cos(lat2) * Math.cos(deltaLon);
  const by = Math.cos(lat2) * Math.sin(deltaLon);
  const lat3 = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2)
  );
  const lon3 = lon1 + Math.atan2(by, Math.cos(lat1) + bx);

  return {
    input: { from, to },
    midpoint: {
      lat: toDegrees(lat3),
      lon: ((toDegrees(lon3) + 540) % 360) - 180
    },
    method: 'great_circle_midpoint'
  };
}

export function boundingBox(input) {
  const center = parsePoint(input);
  const radiusKm = parseNumber(input.radius_km ?? input.radiusKm, 'radius_km', 0, 20039);
  const latRad = toRadians(center.lat);
  const deltaLat = toDegrees(radiusKm / EARTH_RADIUS_KM);
  const deltaLon = Math.abs(Math.cos(latRad)) < 1e-12
    ? 180
    : toDegrees(radiusKm / EARTH_RADIUS_KM / Math.cos(latRad));

  return {
    input: { center, radius_km: radiusKm },
    bounds: {
      min_lat: Math.max(-90, center.lat - deltaLat),
      max_lat: Math.min(90, center.lat + deltaLat),
      min_lon: normalizeLongitude(center.lon - deltaLon),
      max_lon: normalizeLongitude(center.lon + deltaLon)
    },
    method: 'spherical_approximation'
  };
}

function normalizeLongitude(lon) {
  return ((lon + 540) % 360) - 180;
}

function compassPoint(degrees) {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return points[Math.round(degrees / 22.5) % 16];
}
