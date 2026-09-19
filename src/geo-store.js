import pg from 'pg';
import { boundingBox, distanceBetweenPoints, parseNumber } from './geo-service.js';

const { Pool } = pg;

export function createGeoStore(env = process.env) {
  const connectionString = env.GEOGRID_DATABASE_URL || env.TIME_API_DATABASE_URL || env.DATABASE_URL || '';
  if (!connectionString) return null;

  const pool = new Pool({
    connectionString,
    max: Number(env.GEO_DB_POOL_MAX || 4),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000
  });

  return {
    async nearby(input) {
      const center = {
        lat: parseNumber(input.lat, 'lat', -90, 90),
        lon: parseNumber(input.lon, 'lon', -180, 180)
      };
      const radiusKm = parseNumber(input.radius_km ?? input.radiusKm, 'radius_km', 0, 20039);
      const limit = Math.min(parsePositiveInteger(input.limit ?? 50, 'limit'), 500);
      const source = input.source ? String(input.source) : null;
      const category = input.category ? String(input.category) : null;
      const box = boundingBox({ ...center, radius_km: radiusKm }).bounds;
      const candidates = await pool.query(
        `
          select id, external_id, name, lat, lon, source, category, metadata, created_at
          from geogrid.geo_points
          where lat between $1 and $2
            and (
              $3::numeric <= $4::numeric
              and lon between $3 and $4
              or $3::numeric > $4::numeric
              and (lon >= $3 or lon <= $4)
            )
            and ($5::text is null or source = $5)
            and ($6::text is null or category = $6)
          limit 5000
        `,
        [box.min_lat, box.max_lat, box.min_lon, box.max_lon, source, category]
      );

      const results = candidates.rows
        .map((point) => {
          const distance = distanceBetweenPoints({
            from_lat: center.lat,
            from_lon: center.lon,
            to_lat: point.lat,
            to_lon: point.lon
          });
          return {
            id: point.id,
            external_id: point.external_id,
            name: point.name,
            point: {
              lat: Number(point.lat),
              lon: Number(point.lon)
            },
            source: point.source,
            category: point.category,
            metadata: point.metadata,
            distance: distance.distance,
            bearing: distance.bearing,
            created_at: point.created_at
          };
        })
        .filter((point) => point.distance.kilometers <= radiusKm)
        .sort((a, b) => a.distance.kilometers - b.distance.kilometers)
        .slice(0, limit);

      return {
        input: {
          center,
          radius_km: radiusKm,
          limit,
          source,
          category
        },
        bounding_box: box,
        count: results.length,
        results,
        method: 'bounding_box_prefilter_haversine_sort',
        limitations: [
          'Uses a spherical Earth Haversine calculation for exact candidate sorting.',
          'Bounding box is a cheap prefilter and may include candidates outside the requested radius before exact filtering.'
        ]
      };
    },
    async close() {
      await pool.end();
    }
  };
}

function parsePositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw Object.assign(new Error(`${name} must be a positive integer`), {
      statusCode: 400,
      code: 'invalid_integer'
    });
  }
  return parsed;
}
