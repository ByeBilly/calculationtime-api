import test from 'node:test';
import assert from 'node:assert/strict';
import { bmi, bmr, macroSplit, paceCalculator, tdee } from '../src/health-service.js';

test('calculates health and pace endpoints', () => {
  const bmiResult = bmi({ unit: 'metric', weight_kg: 70, height_cm: 175 });
  assert.equal(bmiResult.bmi, 22.86);
  assert.equal(bmiResult.category, 'normal');

  const bmrResult = bmr({ unit: 'metric', weight_kg: 70, height_cm: 175, age: 35, sex: 'male' });
  assert.equal(bmrResult.bmr_calories_per_day, 1623.75);

  const tdeeResult = tdee({ unit: 'metric', weight_kg: 70, height_cm: 175, age: 35, sex: 'male', activity_level: 'moderate' });
  assert.ok(tdeeResult.tdee_calories_per_day > 2500);

  const macros = macroSplit({ calories: 2000, protein_percent: 30, carbs_percent: 40, fat_percent: 30 });
  assert.equal(macros.grams.protein, 150);
  assert.equal(macros.grams.carbs, 200);
  assert.equal(macros.grams.fat, 66.67);

  const pace = paceCalculator({ distance: 5, unit: 'km', minutes: 25 });
  assert.equal(pace.pace_per_km.label, '5:00');
  assert.ok(pace.speed_kph > 11.9);
});

test('health endpoints reject malformed inputs', () => {
  assert.throws(
    () => macroSplit({ calories: 2000, protein_percent: 30, carbs_percent: 30, fat_percent: 30 }),
    (error) => error.statusCode === 400 && error.code === 'invalid_macro_total'
  );
  assert.throws(
    () => bmr({ unit: 'metric', weight_kg: 70, height_cm: 175, age: 35, sex: 'unknown' }),
    (error) => error.statusCode === 400 && error.code === 'invalid_enum'
  );
});
