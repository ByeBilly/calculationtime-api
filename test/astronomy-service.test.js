import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cruxCurrent,
  cruxHourly,
  cruxMidnightRange,
  dayLength,
  equinoxSolstice,
  julianDate,
  moonPhase,
  moonPosition,
  polarNightCheck,
  siderealTime,
  solarNoon,
  sunPosition,
  twilightCalculator
} from '../src/astronomy-service.js';

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

test('advanced astronomy endpoints return deterministic low-cost ephemeris values', () => {
  const noon = solarNoon({ date: '2026-06-21', lat: 48.137154, lon: 11.576124 });
  assert.match(noon.solar_noon.utc_time, /^2026-06-21T/);
  assert.ok(noon.solar_noon.apparent_altitude_degrees > 60);

  const seasons = equinoxSolstice({ year: 2026 });
  assert.equal(seasons.events.length, 4);
  assert.match(seasons.events[0].utc_time, /^2026-03-20T/);

  const moon = moonPhase({ timestamp: '2026-06-21T00:00:00Z' });
  assert.ok(moon.moon.illumination_percent > 40);
  assert.ok(moon.moon.illumination_percent < 41);

  const julian = julianDate({ timestamp: '2000-01-01T12:00:00Z' });
  assert.equal(julian.julian_day, 2451545);
  assert.equal(julian.modified_julian_date, 51544.5);

  const sidereal = siderealTime({ timestamp: '2026-06-21T00:00:00Z', lon: 11.576124 });
  assert.ok(sidereal.sidereal_time.gmst_hours >= 0);
  assert.ok(sidereal.sidereal_time.local_sidereal_hours >= 0);

  const twilight = twilightCalculator({ date: '2026-06-21', lat: 48.137154, lon: 11.576124 });
  assert.match(twilight.twilight.civil.morning_utc, /^2026-06-21T/);
  assert.match(twilight.twilight.nautical.evening_utc, /^2026-06-21T/);

  const sun = sunPosition({ timestamp: '2026-06-21T12:00:00Z', lat: 48.137154, lon: 11.576124 });
  assert.ok(sun.sun.elevation_degrees > 50);

  const moonPositionResult = moonPosition({ timestamp: '2026-06-21T00:00:00Z', lat: 48.137154, lon: 11.576124 });
  assert.ok(moonPositionResult.moon.right_ascension_hours >= 0);
  assert.ok(moonPositionResult.moon.right_ascension_hours <= 24);

  const length = dayLength({ date: '2026-06-21', lat: 48.137154, lon: 11.576124 });
  assert.ok(length.daylight.hours_decimal > 15);
  assert.equal(length.polar_state, 'normal_day');

  const polar = polarNightCheck({ date: '2026-06-21', lat: 80, lon: 0 });
  assert.equal(polar.has_24_hour_daylight, true);
  assert.equal(polar.classification, 'midnight_sun');
});

test('advanced astronomy endpoints validate required inputs', () => {
  assert.throws(
    () => solarNoon({ date: '2026-06-21', lat: 91, lon: 0 }),
    (error) => error.statusCode === 400 && error.code === 'invalid_lat'
  );
  assert.throws(
    () => siderealTime({ timestamp: '2026-06-21T00:00:00Z' }),
    (error) => error.statusCode === 400 && error.code === 'missing_lon'
  );
});
