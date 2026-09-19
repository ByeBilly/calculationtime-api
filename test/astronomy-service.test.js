import test from 'node:test';
import assert from 'node:assert/strict';
import { cruxCurrent, cruxHourly, cruxMidnightRange } from '../src/astronomy-service.js';

test('crux midnight range is zeroed at Parkes local midnight on 2026-03-31', () => {
  const result = cruxMidnightRange({ start_date: '2026-03-31', days: 4 });

  assert.equal(result.calibration.coordinates.latitude_degrees, -32.99);
  assert.equal(result.calibration.coordinates.longitude_degrees, 148.26);
  assert.equal(result.positions.length, 4);
  assert.equal(result.positions[0].date, '2026-03-31');
  assert.equal(result.positions[0].day_index, 0);
  assert.equal(result.positions[0].crux_hand_degrees, 0);
  assert.equal(result.positions[1].day_index, 1);
  assert.ok(Math.abs(result.positions[1].crux_hand_degrees - 0.985647366) < 0.000001);
  assert.ok(Math.abs(result.positions[3].crux_hand_degrees - 2.956942099) < 0.000001);
});

test('crux hourly table advances by the sidereal hourly rate', () => {
  const result = cruxHourly({ date: '2026-03-31' });

  assert.equal(result.count, 24);
  assert.equal(result.positions[0].hour, 0);
  assert.equal(result.positions[0].crux_hand_degrees, 0);
  assert.ok(Math.abs(result.positions[1].crux_hand_degrees - 15.04106864) < 0.000001);
  assert.ok(Math.abs(result.positions[23].crux_hand_degrees - 345.944578726) < 0.000001);
});

test('crux current accepts exact timestamp and reports alignment delta', () => {
  const result = cruxCurrent({ timestamp: '2026-04-01T00:00:00+10:00' });

  assert.ok(Math.abs(result.crux_hand_degrees - 0.985647366) < 0.000001);
  assert.equal(result.parkes_alignment_delta.zero_reference, '2026-03-31T00:00:00+10:00');
  assert.ok(result.sidereal_time.hours > 0);
  assert.equal(result.method, 'parkes_crux_current_sidereal_clock_position');
});

test('crux endpoints reject malformed inputs', () => {
  assert.throws(
    () => cruxMidnightRange({ start_date: '2026-03-31T00:00:00Z', days: 10 }),
    (error) => error.statusCode === 400 && error.code === 'invalid_start_date'
  );
  assert.throws(
    () => cruxHourly({ date: '2026-03-31', timezone: 'Europe/Sydney' }),
    (error) => error.statusCode === 400 && error.code === 'invalid_timezone'
  );
  assert.throws(
    () => cruxCurrent({ timestamp: 'not-a-date' }),
    (error) => error.statusCode === 400 && error.code === 'invalid_timestamp'
  );
});

