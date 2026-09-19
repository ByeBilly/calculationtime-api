import { parseNumber } from './geo-service.js';

const DEFAULT_ELEVATION_API_BASE = 'https://api.open-meteo.com/v1/elevation';

export async function elevationForCoordinate(input = {}, { env = process.env, fetchImpl = fetch } = {}) {
  const lat = parseNumber(input.lat, 'lat', -90, 90);
  const lon = parseNumber(input.lon, 'lon', -180, 180);
  const baseUrl = env.ELEVATION_API_BASE || DEFAULT_ELEVATION_API_BASE;
  const url = new URL(baseUrl);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));

  const response = await fetchImpl(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': env.TIME_API_USER_AGENT || 'CalculationTime-OpenData-Geospatial-API/0.1'
    }
  });

  if (!response.ok) {
    throw Object.assign(new Error(`Elevation provider returned HTTP ${response.status}`), {
      statusCode: 502,
      code: 'elevation_provider_error'
    });
  }

  const data = await response.json();
  const elevationMeters = extractElevation(data);

  return {
    input: {
      lat,
      lon
    },
    elevation: {
      meters: elevationMeters,
      feet: round(elevationMeters * 3.280839895, 3)
    },
    provider: {
      name: 'Open-Meteo Elevation API',
      source: 'Copernicus DEM GLO-90',
      url: 'https://open-meteo.com/en/docs/elevation-api'
    },
    method: 'open_meteo_copernicus_dem_glo_90',
    limitations: [
      'Elevation is derived from a digital elevation model and is not survey-grade.',
      'Resolution is suitable for open-data geospatial estimates, not property boundary or construction decisions.',
      'Returned elevation describes terrain surface, not building or tree height.'
    ]
  };
}

function extractElevation(data) {
  const value = Array.isArray(data?.elevation) ? data.elevation[0] : data?.elevation;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw Object.assign(new Error('Elevation provider response did not include a usable elevation value'), {
      statusCode: 502,
      code: 'invalid_elevation_provider_response'
    });
  }
  return round(parsed, 3);
}

function round(value, places) {
  return Number(value.toFixed(places));
}
