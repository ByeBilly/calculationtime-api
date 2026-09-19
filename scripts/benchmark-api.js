const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:4110';
const ITERATIONS = positiveInteger(process.env.BENCH_ITERATIONS, 10);
const API_KEY = process.env.TIME_API_BENCH_KEY || process.env.TIME_API_KEY || '';

const scenarios = [
  {
    name: 'coordinate_current_time_lookup',
    method: 'GET',
    path: '/v1/time?lat=48.137154&lon=11.576124'
  },
  {
    name: 'explicit_timestamp_timezone_conversion',
    method: 'GET',
    path: '/v1/time?lat=48.137154&lon=11.576124&at=2026-07-12T12:00:00Z'
  },
  {
    name: 'date_difference',
    method: 'GET',
    path: '/v1/date/difference?start=2026-07-12&end=2026-08-01'
  },
  {
    name: 'business_day_calculation',
    method: 'POST',
    path: '/v1/date/business-days',
    body: {
      start: '2026-07-13',
      end: '2026-07-17',
      holidays: ['2026-07-15']
    }
  },
  {
    name: 'geospatial_distance',
    method: 'GET',
    path: '/v1/geo/distance?from_lat=48.137154&from_lon=11.576124&to_lat=52.52&to_lon=13.405'
  }
];

const results = [];

for (const scenario of scenarios) {
  const timings = [];
  for (let index = 0; index < ITERATIONS; index += 1) {
    const started = performance.now();
    const response = await fetch(`${BASE_URL}${scenario.path}`, {
      method: scenario.method,
      headers: headers(scenario),
      body: scenario.body ? JSON.stringify(scenario.body) : undefined
    });
    const duration = performance.now() - started;
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`${scenario.name} failed with HTTP ${response.status}: ${body}`);
    }

    timings.push(duration);
  }

  timings.sort((a, b) => a - b);
  results.push({
    name: scenario.name,
    iterations: ITERATIONS,
    min_ms: round(timings[0]),
    median_ms: round(timings[Math.floor(timings.length / 2)]),
    p95_ms: round(timings[Math.floor(timings.length * 0.95)]),
    max_ms: round(timings[timings.length - 1])
  });
}

console.log(JSON.stringify({
  base_url: BASE_URL,
  iterations_per_scenario: ITERATIONS,
  scenarios: results
}, null, 2));

function headers(scenario) {
  const values = {};
  if (scenario.body) values['content-type'] = 'application/json';
  if (API_KEY) values['x-api-key'] = API_KEY;
  return values;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
