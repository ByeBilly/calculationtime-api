import test from 'node:test';
import assert from 'node:assert/strict';
import { boundingBox, distanceBetweenPoints, midpointBetweenPoints } from '../src/geo-service.js';

test('calculates Munich to Berlin distance and bearing', () => {
  const result = distanceBetweenPoints({
    from_lat: 48.137154,
    from_lon: 11.576124,
    to_lat: 52.52,
    to_lon: 13.405
  });

  assert.equal(result.bearing.compass, 'NNE');
  assert.ok(result.distance.kilometers > 500);
  assert.ok(result.distance.kilometers < 510);
});

test('calculates midpoint', () => {
  const result = midpointBetweenPoints({
    from_lat: 48.137154,
    from_lon: 11.576124,
    to_lat: 52.52,
    to_lon: 13.405
  });

  assert.ok(result.midpoint.lat > 50);
  assert.ok(result.midpoint.lat < 51);
  assert.ok(result.midpoint.lon > 12);
  assert.ok(result.midpoint.lon < 13);
});

test('calculates bounding box', () => {
  const result = boundingBox({
    lat: 48.137154,
    lon: 11.576124,
    radius_km: 50
  });

  assert.ok(result.bounds.min_lat < 48.137154);
  assert.ok(result.bounds.max_lat > 48.137154);
  assert.ok(result.bounds.min_lon < 11.576124);
  assert.ok(result.bounds.max_lon > 11.576124);
});
