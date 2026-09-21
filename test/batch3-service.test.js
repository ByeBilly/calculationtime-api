import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ageInDays,
  baseNConvert,
  breakEvenMulti,
  cidrRange,
  contrastRatio,
  cronParser,
  fibonacci,
  hexToRgb,
  intervalOverlap,
  matrixMultiply,
  npv,
  recurringMonthly,
  slugSanitize,
  timeBlocks,
  tipSplit,
  uuidV5,
  vectorMagnitude,
  workdayShift
} from '../src/batch3-service.js';
import { buildServer } from '../src/server.js';

test('batch three schedule utilities calculate deterministic dates and blocks', () => {
  assert.deepEqual(cronParser({ expression: '*/30 9 * * 1', from: '2026-09-21T08:45:00Z', count: 2 }).next_runs, [
    '2026-09-21T09:00:00.000Z',
    '2026-09-21T09:30:00.000Z'
  ]);
  assert.equal(workdayShift({ date: '2026-09-21', days: 5 }).shifted_date, '2026-09-28');
  assert.equal(intervalOverlap({
    a_start: '2026-09-21T09:00:00Z',
    a_end: '2026-09-21T12:00:00Z',
    b_start: '2026-09-21T11:00:00Z',
    b_end: '2026-09-21T13:00:00Z'
  }).overlap_minutes, 60);
  assert.equal(recurringMonthly({ year: 2026, months: 1, ordinal: 3, weekday: 'tuesday' }).occurrences[0], '2026-01-20');
  assert.equal(ageInDays({ birth_date: '2000-01-01', days: 10000 }).milestone_date, '2027-05-19');
  assert.equal(timeBlocks({ minutes: 60 }).count, 24);
});

test('batch three color, network, finance, and math utilities calculate expected values', () => {
  assert.deepEqual(hexToRgb({ hex: '#336699' }).rgb, [51, 102, 153]);
  assert.equal(contrastRatio({ foreground: '#000', background: '#fff' }).ratio, 21);
  assert.equal(cidrRange({ cidr: '192.168.1.0/24' }).usable_hosts, 254);
  assert.equal(slugSanitize({ text: 'Café Invoice #42!' }).slug, 'cafe-invoice-42');
  assert.equal(uuidV5({ name: 'calculationtime.com' }).uuid, '13b7f40c-8d26-524b-b625-a4fad3771e7d');
  assert.equal(npv({ discount_rate_percent: 10, cashflows: [-1000, 600, 600] }).npv, 41.322314);
  assert.equal(breakEvenMulti({ fixed_costs: 1000, products: [{ price: 20, variable_cost: 10, mix: 1 }] }).break_even_units, 100);
  assert.equal(tipSplit({ subtotal: 100, tip_percent: 20, people: 4 }).per_person, 30);
  assert.deepEqual(matrixMultiply({ a: [[1, 2], [3, 4]], b: [[5, 6], [7, 8]] }).result, [[19, 22], [43, 50]]);
  assert.equal(vectorMagnitude({ vector: [3, 4] }).magnitude, 5);
  assert.equal(fibonacci({ n: 10 }).value, 55);
  assert.equal(baseNConvert({ value: 'ff', from_base: 16, to_base: 10 }).converted, '255');
});

test('representative batch three API routes return successful JSON envelopes', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const routes = [
    ['/api/v1/schedule/workday-shift', { date: '2026-09-21', days: 1 }, 'shifted_date'],
    ['/api/v1/color/hex-to-rgb', { hex: '#336699' }, 'rgb'],
    ['/api/v1/network/cidr-range', { cidr: '10.0.0.0/30' }, 'usable_hosts'],
    ['/api/v1/finance/effective-annual-rate', { nominal_rate_percent: 6, compounds_per_year: 12 }, 'effective_annual_rate_percent'],
    ['/api/v1/math/fibonacci', { n: 12 }, 'value']
  ];

  for (const [url, payload, marker] of routes) {
    const response = await app.inject({ method: 'POST', url, payload });
    assert.equal(response.statusCode, 200, url);
    assert.notEqual(response.json()[marker], undefined, url);
  }

  const invalid = await app.inject({ method: 'POST', url: '/api/v1/network/cidr-range', payload: { cidr: '999.1.1.0/24' } });
  await app.close();

  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error.code, 'value_out_of_range');
});
