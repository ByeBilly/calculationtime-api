import test from 'node:test';
import assert from 'node:assert/strict';
import {
  circleGeometry,
  arithmeticProgression,
  circleSector,
  combinatorics,
  coneGeometry,
  cylinderGeometry,
  exponentEval,
  geometricProgression,
  gcdLcm,
  kineticEnergy,
  logarithmEval,
  matrixDeterminant,
  ohmLaw,
  percentError,
  percentageChange,
  potentialEnergy,
  projectileRange,
  proportionSolver,
  pythagoreanSolve,
  quadraticSolver,
  sphereGeometry,
  statisticsSummary,
  torusGeometry,
  triangleHeron
} from '../src/math-service.js';

test('calculates algebra and geometry utilities', () => {
  assert.deepEqual(quadraticSolver({ a: 1, b: -3, c: 2 }).roots.values, [2, 1]);
  assert.equal(pythagoreanSolve({ a: 3, b: 4 }).sides.c, 5);
  assert.equal(triangleHeron({ a: 3, b: 4, c: 5 }).area, 6);
  assert.equal(circleGeometry({ radius: 10, angle_degrees: 90 }).arc_length, 15.707963267949);
  assert.equal(sphereGeometry({ radius: 3 }).volume, 113.097335529233);
  assert.equal(cylinderGeometry({ radius: 3, height: 10 }).volume, 282.743338823081);
});

test('calculates statistics, percentages, integer, and matrix utilities', () => {
  const stats = statisticsSummary({ values: [1, 2, 2, 4, 9] });
  assert.equal(stats.mean, 3.6);
  assert.equal(stats.median, 2);
  assert.deepEqual(stats.mode, [2]);
  assert.equal(stats.quartiles.iqr, 5);
  assert.equal(percentageChange({ baseline: 80, current: 100 }).percentage_change, 25);
  assert.equal(percentError({ true_value: 100, measured_value: 96 }).percent_error, 4);
  assert.equal(gcdLcm({ values: [12, 18, 30] }).gcd, 6);
  assert.equal(gcdLcm({ values: [12, 18, 30] }).lcm, 180);
  assert.equal(matrixDeterminant({ matrix: [[1, 2], [3, 4]] }).determinant, -2);
  assert.equal(matrixDeterminant({ matrix: [[6, 1, 1], [4, -2, 5], [2, 8, 7]] }).determinant, -306);
});

test('calculates proportion, logarithm, exponent, and combinatorics utilities', () => {
  assert.equal(proportionSolver({ a: 2, b: 5, c: 8 }).x, 20);
  assert.equal(logarithmEval({ value: 1000, base: 10 }).logarithm, 3);
  assert.equal(exponentEval({ base: 27, exponent: 2, root: 3 }).root_value, 3);
  assert.equal(combinatorics({ n: 10, r: 3 }).permutations, 720);
  assert.equal(combinatorics({ n: 10, r: 3 }).combinations, 120);
});

test('calculates engineering and progression batch-two utilities', () => {
  assert.equal(ohmLaw({ voltage: 12, resistance: 4 }).values.current_amps, 3);
  assert.equal(projectileRange({ velocity: 10, angle_degrees: 45 }).max_height, 2.549290532445);
  assert.equal(kineticEnergy({ mass: 2, velocity: 3 }).kinetic_energy_joules, 9);
  assert.equal(potentialEnergy({ mass: 2, height: 10, gravity: 9.8 }).potential_energy_joules, 196);
  assert.equal(circleSector({ radius: 10, angle_degrees: 90 }).sector_area, 78.539816339745);
  assert.equal(coneGeometry({ radius: 3, height: 4 }).slant_height, 5);
  assert.equal(torusGeometry({ major_radius: 5, minor_radius: 2 }).volume, 394.784176043574);
  assert.equal(arithmeticProgression({ first: 2, difference: 3, n: 10 }).sum_n_terms, 155);
  assert.equal(geometricProgression({ first: 2, ratio: 3, n: 5 }).sum_n_terms, 242);
});

test('math utilities reject malformed inputs cleanly', () => {
  assert.throws(
    () => quadraticSolver({ a: 0, b: 1, c: 1 }),
    (error) => error.statusCode === 400 && error.code === 'invalid_quadratic'
  );
  assert.throws(
    () => triangleHeron({ a: 1, b: 2, c: 3 }),
    (error) => error.statusCode === 400 && error.code === 'invalid_triangle'
  );
  assert.throws(
    () => matrixDeterminant({ matrix: [[1, 2, 3], [4, 5, 6]] }),
    (error) => error.statusCode === 400 && error.code === 'invalid_matrix'
  );
});
