import test from 'node:test';
import assert from 'node:assert/strict';
import { unitConversion } from '../src/conversion-service.js';

test('converts zero-cost unit groups with static multipliers', () => {
  assert.equal(unitConversion('length', { value: 1, from: 'mile', to: 'kilometer' }).result, 1.609344);
  assert.equal(unitConversion('weight', { value: 1, from: 'stone', to: 'pound' }).result, 14);
  assert.equal(unitConversion('temperature', { value: 32, from: 'fahrenheit', to: 'celsius' }).result, 0);
  assert.equal(unitConversion('area', { value: 1, from: 'hectare', to: 'acre' }).result, 2.471053814672);
  assert.equal(unitConversion('volume', { value: 1, from: 'gallon', to: 'liter' }).result, 3.785411784);
  assert.equal(unitConversion('pressure', { value: 1, from: 'atmosphere', to: 'psi' }).result, 14.695948775514);
  assert.equal(unitConversion('energy', { value: 1, from: 'kilowatt_hour', to: 'joule' }).result, 3600000);
  assert.equal(unitConversion('power', { value: 1, from: 'horsepower', to: 'watt' }).result, 745.69987158227);
  assert.equal(unitConversion('data_storage', { value: 1, from: 'gigabyte', to: 'megabyte' }).result, 1000);
});

test('conversion utilities reject invalid unit names', () => {
  assert.throws(
    () => unitConversion('length', { value: 1, from: 'banana', to: 'meter' }),
    (error) => error.statusCode === 400 && error.code === 'invalid_from_unit'
  );
});
