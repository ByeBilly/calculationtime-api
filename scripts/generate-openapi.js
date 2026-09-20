import { writeFile } from 'node:fs/promises';

const protectedErrors = {
  400: { description: 'Invalid request input' },
  401: { description: 'A valid API key is required' },
  402: { description: 'API credit balance is exhausted' },
  403: { description: 'Customer account is suspended or trial has expired' },
  429: { description: 'Rate limit exceeded' }
};

const anyObject = {
  type: 'object',
  additionalProperties: true
};

const routes = [
  publicRoute('get', '/', 'Markdown API documentation'),
  publicRoute('get', '/health', 'Low-level service health'),
  publicRoute('get', '/openapi.json', 'OpenAPI contract for live routes'),
  publicRoute('get', '/v1/status', 'Public measured service status and endpoint inventory'),
  publicRoute('get', '/v1/time/utc', 'Current UTC timestamp and clock-model metadata'),
  publicRoute('get', '/api/v1/utility/tagline', 'Deterministic daily CalculationTime tagline'),
  billableGet('/v1/time', 'Get local time for one coordinate', ['lat', 'lon', 'at']),
  billablePost('/v1/time/batch', 'Get local time for up to 100 coordinates', 1, {
    points: [{ lat: 48.137154, lon: 11.576124 }],
    at: '2026-07-29T12:00:00Z'
  }),
  billableGet('/v1/date/difference', 'Calendar day difference', ['start', 'end']),
  billablePost('/v1/date/difference/batch', 'Batch calendar day differences', 1, {
    ranges: [{ start: '2026-07-12', end: '2026-08-01' }]
  }),
  billableGet('/v1/date/add', 'Add calendar units to a date', ['date', 'days', 'months', 'years']),
  billablePost('/v1/date/business-days', 'Business-day count with supplied holidays', 1, {
    start: '2026-07-13',
    end: '2026-07-17',
    holidays: ['2026-07-15']
  }),
  billablePost('/v1/date/business-days/jurisdiction', 'Business-day count for a supported jurisdiction', 1, {
    start: '2026-07-13',
    end: '2026-07-17',
    jurisdiction: 'US'
  }),
  billablePost('/v1/date/business-days-add', 'Add or subtract configurable business days', 1, {
    start: '2026-07-13',
    business_days: 10,
    weekend_days: [6, 7],
    holidays: ['2026-07-20']
  }),
  billablePost('/v1/date/iso-week', 'ISO week number, week-year, and weekday', 1, {
    date: '2026-01-01'
  }),
  billablePost('/v1/date/age-breakdown', 'Exact age duration breakdown from birth date to timestamp', 1, {
    birth_date: '1990-05-15',
    as_of: '2026-09-21T00:00:00Z'
  }),
  billablePost('/v1/date/countdown-precise', 'Precise calendar delta between timestamps', 1, {
    start: '2026-09-21T00:00:00Z',
    end: '2027-01-01T12:30:15Z'
  }),
  billablePost('/v1/date/epoch-converter', 'Unix epoch seconds or milliseconds to ISO/RFC strings', 1, {
    epoch: 1789941600,
    unit: 'seconds'
  }),
  billablePost('/v1/date/quarter-calculator', 'Calendar and fiscal quarter with progress percentage', 1, {
    date: '2026-09-21',
    fiscal_start_month: 4
  }),
  billablePost('/v1/date/leap-year-check', 'Gregorian and Julian leap-year proof check', 1, {
    year: 2028
  }),
  billablePost('/v1/date/days-in-month', 'Days in a Gregorian month', 1, {
    year: 2028,
    month: 2
  }),
  billablePost('/v1/date/timezone-offset', 'Fixed UTC offset conversion without DST lookup', 1, {
    timestamp: '2026-09-21T00:00:00Z',
    offset: '+10:00'
  }),
  billablePost('/v1/date/calendar-range', 'Generate a deterministic date range with weekday and ISO week facts', 1, {
    start: '2026-09-21',
    days: 14,
    weekend_days: [6, 7]
  }),
  billableGet('/v1/holidays', 'Holidays for a jurisdiction and year', ['jurisdiction', 'year']),
  billableGet('/v1/holidays/next', 'Next holiday for a jurisdiction', ['jurisdiction', 'from']),
  billableGet('/v1/holidays/is-business-day', 'Business-day check for one date', ['jurisdiction', 'date']),
  billableGet('/v1/geo/distance', 'Distance between two coordinates', ['lat1', 'lon1', 'lat2', 'lon2']),
  billablePost('/v1/geo/distance/batch', 'Batch distance calculations', 1, {
    pairs: [{ from: { lat: 48.137154, lon: 11.576124 }, to: { lat: 51.5072, lon: -0.1276 } }]
  }),
  billableGet('/v1/geo/midpoint', 'Midpoint between two coordinates', ['lat1', 'lon1', 'lat2', 'lon2']),
  billableGet('/v1/geo/bounding-box', 'Bounding box around a coordinate', ['lat', 'lon', 'radius_km']),
  billableGet('/v1/geo/elevation', 'Elevation for one coordinate', ['lat', 'lon']),
  billableGet('/v1/geo/nearby', 'Nearby stored geo points', ['lat', 'lon', 'radius_km']),
  billableGet('/v1/solar/position', 'Solar position for date and coordinate', ['lat', 'lon', 'at']),
  billableGet('/v1/astronomy/ephemeris', 'Astronomy ephemeris for a date', ['date']),
  billablePost('/v1/astronomy/crux-midnight', 'Crux clock hand midnight sidereal positions from Parkes Observatory calibration', 2, {
    start_date: '2026-03-31',
    days: 365,
    timezone: '+10:00'
  }),
  billablePost('/v1/astronomy/crux-hourly', 'Crux clock hand hourly sidereal breakdown for one local date', 5, {
    date: '2026-03-31',
    timezone: '+10:00'
  }),
  billablePost('/v1/astronomy/crux-current', 'Current Crux clock hand position and Parkes alignment delta', 2, {
    timestamp: '2026-04-01T00:00:00+10:00'
  }),
  billablePost('/v1/astronomy/solar-noon', 'Solar transit/noon timestamp for a coordinate and date', 1, {
    date: '2026-06-21',
    lat: 48.137154,
    lon: 11.576124
  }),
  billablePost('/v1/astronomy/equinox-solstice', 'Equinox and solstice timestamps for a year', 1, {
    year: 2026
  }),
  billablePost('/v1/astronomy/moon-phase', 'Moon illumination, age, and phase name for a timestamp', 1, {
    timestamp: '2026-06-21T00:00:00Z'
  }),
  billablePost('/v1/astronomy/julian-date', 'Gregorian timestamp to Julian Day and Modified Julian Date', 1, {
    timestamp: '2026-06-21T00:00:00Z'
  }),
  billablePost('/v1/astronomy/sidereal-time', 'Greenwich and local sidereal time for a timestamp and longitude', 1, {
    timestamp: '2026-06-21T00:00:00Z',
    lon: 11.576124
  }),
  billablePost('/v1/astronomy/twilight-calculator', 'Civil, nautical, and astronomical twilight crossings', 1, {
    date: '2026-06-21',
    lat: 48.137154,
    lon: 11.576124
  }),
  billablePost('/v1/astronomy/sun-position', 'Sun right ascension, declination, azimuth, and elevation', 1, {
    timestamp: '2026-06-21T12:00:00Z',
    lat: 48.137154,
    lon: 11.576124
  }),
  billablePost('/v1/astronomy/moon-position', 'Moon right ascension, declination, azimuth, and elevation', 1, {
    timestamp: '2026-06-21T00:00:00Z',
    lat: 48.137154,
    lon: 11.576124
  }),
  billablePost('/v1/astronomy/day-length', 'Daylight duration between sunrise and sunset', 1, {
    date: '2026-06-21',
    lat: 48.137154,
    lon: 11.576124
  }),
  billablePost('/v1/astronomy/polar-night-check', 'Check midnight sun or polar night state for a latitude/date', 1, {
    date: '2026-06-21',
    lat: 80,
    lon: 0
  }),
  billablePost('/v1/finance/margin-markup', 'Gross margin, markup, selling price, and cost variance', 1, {
    cost: 80,
    selling_price: 125,
    actual_cost: 92
  }),
  billablePost('/v1/finance/loan-amortization', 'Fixed-rate loan amortization schedule', 5, {
    principal: 250000,
    annual_interest_rate_percent: 6.25,
    term_months: 360
  }),
  billablePost('/v1/finance/tax-extraction', 'Tax add-on and inclusive reverse extraction', 2, {
    amounts: [{ label: 'VAT inclusive', amount: 120, tax_rate_percent: 20, mode: 'inclusive' }]
  }),
  billablePost('/v1/finance/freelancer-rate', 'Freelancer hourly and daily rate target', 2, {
    target_annual_income: 80000,
    annual_expenses: 20000,
    tax_overhead_percent: 25,
    billable_weeks: 40,
    billable_hours_per_week: 25
  }),
  billablePost('/v1/stats/summary', 'Descriptive statistics for a numeric dataset', 3, { values: [1, 2, 2, 4, 9] }),
  billablePost('/v1/payroll/decimal-hours', 'Clock time to decimal hours and overtime conversion', 1, {
    hours: 1,
    minutes: 30,
    overtime_multiplier: 1.5
  }),
  billablePost('/v1/tradie/job-margin', 'Tradie job margin from labour, materials, subcontractors, overhead, and quote', 2, {
    labour_hours: 16,
    labour_rate: 45,
    materials_cost: 380,
    subcontractor_cost: 250,
    overhead_percent: 12,
    quoted_price: 2200
  }),
  billablePost('/v1/tradie/vat-return-summary', 'Tradie VAT return summary from sales and purchases', 3, {
    sales: [{ amount: 1200, tax_rate_percent: 20, mode: 'inclusive' }],
    purchases: [{ amount: 300, tax_rate_percent: 20, mode: 'exclusive' }]
  }),
  billablePost('/v1/tradie/cis-deduction', 'UK CIS-style deduction model for labour and materials', 2, {
    gross_labour: 1000,
    materials: 200,
    deduction_rate_percent: 20
  }),
  billablePost('/v1/tradie/mileage-claim', 'Mileage claim and unreimbursed/reimbursed excess calculation', 1, {
    miles: 120,
    rate_per_mile: 0.45,
    reimbursed_amount: 20
  }),
  billablePost('/v1/tradie/tool-depreciation', 'Straight-line tool and equipment depreciation schedule', 3, {
    purchase_price: 1200,
    salvage_value: 200,
    useful_life_years: 5
  }),
  billablePost('/v1/tradie/invoice-aging', 'Receivables aging buckets for unpaid invoices', 3, {
    as_of: '2026-09-19',
    invoices: [{ invoice_id: 'INV-1', due_date: '2026-08-01', amount: 400 }]
  }),
  protectedGet('/v1/canary', 'Protected monitoring canary for API-key path checks'),
  protectedGet('/v1/account/profile', 'Authenticated customer profile'),
  protectedGet('/v1/account/usage', 'Authenticated customer usage summary'),
  protectedGet('/v1/account/limits', 'Authenticated customer plan and batch limits'),
  protectedGet('/v1/account/credits', 'Authenticated customer credit balance'),
  adminGet('/v1/admin/customers', 'Admin customer list and usage summary', ['limit', 'include_inactive']),
  adminGet('/v1/admin/customers/{customer_id}', 'Admin customer detail', [], ['customer_id']),
  adminPost('/v1/admin/customers', 'Admin create or update customer', {
    customer_id: 'taxserve-demo',
    display_name: 'Tax Serve Demo',
    rate_limit_per_minute: 240,
    status: 'active'
  }),
  adminPost('/v1/admin/customers/{customer_id}/credits', 'Admin append credit ledger event', {
    delta: 1000000,
    reason: 'trial grant',
    reference: 'manual:onboarding',
    metadata: { trial_ends_at: '2027-09-19T00:00:00.000Z' }
  }, ['customer_id']),
  adminGet('/v1/admin/customers/{customer_id}/credits', 'Admin customer credit ledger', ['limit'], ['customer_id']),
  adminGet('/v1/admin/customers/{customer_id}/webhooks', 'Admin list customer webhooks', [], ['customer_id']),
  adminPut('/v1/admin/customers/{customer_id}/webhooks', 'Admin register or update customer webhook', {
    event_type: 'calculation.heavy.completed',
    destination_url: 'https://integrator.example/webhooks/calculationtime',
    status: 'active'
  }, ['customer_id']),
  publicPost('/v1/observatory/share', 'Create private Observatory share token', {
    poster: 'moment',
    date: '2026-08-01',
    ttl_days: 7
  }),
  publicRoute('get', '/v1/observatory/share/{token}', 'Resolve private Observatory share token', ['token'])
];

const paths = {};
for (const route of routes) {
  paths[route.path] ||= {};
  paths[route.path][route.method] = route.operation;
}

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'CalculationTime API',
    version: '0.1.0',
    description: 'CalculationTime v1 API for time, date, holiday, geospatial, solar, astronomy, finance, payroll, statistics, tradie accounting, tenant account, admin, and webhook-management workflows.'
  },
  servers: [
    { url: 'https://api.calculationtime.com' },
    { url: 'http://127.0.0.1:4110' }
  ],
  paths,
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      BearerAuth: { type: 'http', scheme: 'bearer' },
      AdminKeyAuth: { type: 'apiKey', in: 'header', name: 'X-Admin-Key' }
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' }
            }
          }
        }
      }
    }
  },
  'x-webhooks': {
    'calculation.heavy.completed': {
      description: 'Optional tenant webhook fired after successful heavy billable calculations.',
      eligible_routes: [
        '/v1/finance/loan-amortization',
        '/v1/finance/tax-extraction',
        '/v1/stats/summary',
        '/v1/tradie/vat-return-summary',
        '/v1/tradie/tool-depreciation',
        '/v1/tradie/invoice-aging'
      ],
      payload_fields: ['event_id', 'event_type', 'event_group', 'service', 'api_version', 'occurred_at', 'customer_id', 'route', 'method', 'status_code', 'duration_ms', 'credit_cost']
    }
  }
};

await writeFile(new URL('../docs/openapi.json', import.meta.url), `${JSON.stringify(spec, null, 2)}\n`);

function publicRoute(method, path, summary, pathParams = []) {
  return {
    method,
    path,
    operation: operation(summary, { security: [], parameters: pathParameters(pathParams) })
  };
}

function publicPost(path, summary, example) {
  return {
    method: 'post',
    path,
    operation: operation(summary, { security: [], requestBody: jsonBody(example) })
  };
}

function protectedGet(path, summary, queryParams = [], pathParams = []) {
  return {
    method: 'get',
    path,
    operation: operation(summary, {
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      parameters: [...pathParameters(pathParams), ...queryParameters(queryParams)],
      responses: protectedResponses()
    })
  };
}

function billableGet(path, summary, queryParams = [], creditCost = 1) {
  const route = protectedGet(path, summary, queryParams);
  route.operation['x-credit-cost'] = creditCost;
  return route;
}

function billablePost(path, summary, creditCost, example) {
  return {
    method: 'post',
    path,
    operation: operation(summary, {
      security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
      requestBody: jsonBody(example),
      responses: protectedResponses(),
      extra: { 'x-credit-cost': creditCost }
    })
  };
}

function adminGet(path, summary, queryParams = [], pathParams = []) {
  return {
    method: 'get',
    path,
    operation: operation(summary, {
      security: [{ AdminKeyAuth: [] }],
      parameters: [...pathParameters(pathParams), ...queryParameters(queryParams)],
      responses: protectedResponses()
    })
  };
}

function adminPost(path, summary, example, pathParams = []) {
  return adminWrite('post', path, summary, example, pathParams);
}

function adminPut(path, summary, example, pathParams = []) {
  return adminWrite('put', path, summary, example, pathParams);
}

function adminWrite(method, path, summary, example, pathParams) {
  return {
    method,
    path,
    operation: operation(summary, {
      security: [{ AdminKeyAuth: [] }],
      parameters: pathParameters(pathParams),
      requestBody: jsonBody(example),
      responses: protectedResponses(201)
    })
  };
}

function operation(summary, { security, parameters = [], requestBody, responses = { 200: { description: 'Successful response' } }, extra = {} }) {
  const op = {
    summary,
    responses,
    security,
    ...extra
  };
  if (parameters.length) op.parameters = parameters;
  if (requestBody) op.requestBody = requestBody;
  return op;
}

function protectedResponses(successCode = 200) {
  return {
    [successCode]: { description: 'Successful response' },
    ...protectedErrors
  };
}

function jsonBody(example) {
  return {
    required: true,
    content: {
      'application/json': {
        schema: anyObject,
        example
      }
    }
  };
}

function queryParameters(names) {
  return names.map((name) => ({
    name,
    in: 'query',
    required: false,
    schema: { type: 'string' }
  }));
}

function pathParameters(names) {
  return names.map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' }
  }));
}
