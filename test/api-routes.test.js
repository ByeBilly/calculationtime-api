import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { createMemoryShareStore } from '../src/observatory-share-store.js';

test('local health remains public and reports private foundation state', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const response = await app.inject('/health');
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().service, 'time-coordinate-api');
  assert.equal(response.json().api_key_required, false);
  assert.equal(response.json().cache, 'memory');
});

test('daily tagline endpoint is public, lightweight, and edge cacheable', async () => {
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_KEYS: 'customer_a:test-key',
      TIME_API_CACHE: 'memory'
    },
    logger: false
  });
  const response = await app.inject('/api/v1/utility/tagline');
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['cache-control'], /^public, max-age=\d+, s-maxage=\d+, stale-while-revalidate=3600$/);
  assert.match(response.headers['cdn-cache-control'], /^public, max-age=\d+$/);
  assert.match(response.headers['vercel-cdn-cache-control'], /^public, s-maxage=\d+$/);
  assert.match(response.json().date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(typeof response.json().tagline, 'string');
  assert.equal(typeof response.json().category, 'string');
});

test('CORS allows CalculationTime origins without wildcard access', async () => {
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_KEYS: 'customer_a:test-key',
      TIME_API_CACHE: 'memory'
    },
    logger: false
  });
  const allowed = await app.inject({
    method: 'OPTIONS',
    url: '/v1/time',
    headers: {
      origin: 'https://www.calculationtime.com',
      'access-control-request-method': 'GET'
    }
  });
  const rejectedOrigin = await app.inject({
    method: 'OPTIONS',
    url: '/v1/time',
    headers: {
      origin: 'https://example.com',
      'access-control-request-method': 'GET'
    }
  });
  await app.close();

  assert.equal(allowed.statusCode, 204);
  assert.equal(allowed.headers['access-control-allow-origin'], 'https://www.calculationtime.com');
  assert.equal(allowed.headers['access-control-allow-methods'], 'GET,POST,OPTIONS');
  assert.equal(rejectedOrigin.statusCode, 204);
  assert.equal(rejectedOrigin.headers['access-control-allow-origin'], undefined);
});

test('CORS can be opened for public API consumers by configuration', async () => {
  const app = await buildServer({
    env: {
      CORS_ORIGINS: '*',
      TIME_API_CACHE: 'memory'
    },
    logger: false
  });
  const response = await app.inject({
    method: 'OPTIONS',
    url: '/openapi.json',
    headers: {
      origin: 'https://developer.example',
      'access-control-request-method': 'GET'
    }
  });
  await app.close();

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers['access-control-allow-origin'], '*');
  assert.equal(response.headers['access-control-allow-methods'], 'GET,POST,OPTIONS');
  assert.equal(response.headers['access-control-allow-headers'], 'Authorization,Content-Type,X-API-Key,X-Admin-Key');
});

test('OPTIONS preflight does not consume public rate limit', async () => {
  const app = await buildServer({
    env: {
      PUBLIC_RATE_LIMIT_PER_MINUTE: '1',
      TIME_API_CACHE: 'memory'
    },
    logger: false
  });
  const preflight = await app.inject({
    method: 'OPTIONS',
    url: '/v1/status',
    headers: {
      origin: 'https://www.calculationtime.com',
      'access-control-request-method': 'GET'
    }
  });
  const firstGet = await app.inject('/v1/status');
  const secondGet = await app.inject('/v1/status');
  await app.close();

  assert.equal(preflight.statusCode, 204);
  assert.equal(firstGet.statusCode, 200);
  assert.equal(firstGet.headers['x-ratelimit-limit'], '1');
  assert.equal(firstGet.headers['x-ratelimit-remaining'], '0');
  assert.equal(secondGet.statusCode, 429);
  assert.equal(secondGet.headers['x-ratelimit-limit'], '1');
  assert.equal(secondGet.headers['x-ratelimit-remaining'], '0');
  assert.ok(Number(secondGet.headers['x-ratelimit-reset']) > 0);
  assert.ok(Number(secondGet.headers['retry-after']) > 0);
  assert.equal(secondGet.json().error.code, 'rate_limited');
});

test('public UTC and status proof routes match advertised contract', async () => {
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_KEYS: 'customer_a:test-key',
      TIME_API_CACHE: 'memory'
    },
    logger: false
  });
  const utc = await app.inject('/v1/time/utc');
  const status = await app.inject('/v1/status');
  await app.close();

  assert.equal(utc.statusCode, 200);
  assert.match(utc.json().utc_time, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(utc.json().accuracy_model.sla_claimed, false);
  assert.equal(status.statusCode, 200);
  assert.equal(status.json().ok, true);
  assert.equal(status.json().sla_claimed, false);
  assert.ok(status.json().endpoint_families.some((family) => family.family === 'geospatial'));
  assert.equal(status.json().monitoring.protected_canary, '/v1/canary');
  assert.ok(status.json().endpoint_families.some((family) => family.family === 'observatory'));
  assert.ok(status.json().endpoint_families.some((family) => family.family === 'account'));
  assert.equal(status.json().endpoint_families.some((family) => family.family === 'admin'), false);
});

test('public OpenAPI omits internal admin routes and removed MD5 route', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const response = await app.inject('/openapi.json');
  await app.close();

  assert.equal(response.statusCode, 200);
  const paths = response.json().paths;
  assert.equal(paths['/api/v1/crypto/hash-md5'], undefined);
  assert.equal(Object.keys(paths).some((path) => path.startsWith('/v1/admin/')), false);
  assert.equal(response.json().components.securitySchemes.AdminKeyAuth, undefined);
});

test('public reference data routes return cacheable JSON without authentication', async () => {
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_KEYS: 'customer_a:test-key',
      TIME_API_CACHE: 'memory'
    },
    logger: false
  });
  const requests = [
    ['/v1/data/countries?q=australia', 'iso_alpha2'],
    ['/v1/data/timezones?q=Australia/Sydney&at=2026-09-21T00:00:00Z', 'time_zone'],
    ['/v1/data/elements?q=oxygen', 'symbol'],
    ['/v1/data/constants?q=planck', 'symbol'],
    ['/v1/data/materials/density?q=steel', 'density'],
    ['/v1/data/http-status?q=429', 'phrase'],
    ['/v1/data/mime-types?extension=json', 'mime_type'],
    ['/v1/data/unicode-blocks?q=currency', 'name'],
    ['/v1/data/constellations?q=crux', 'abbreviation'],
    ['/v1/data/stars/bright?q=sirius', 'constellation'],
    ['/v1/data/meteor-showers?q=perseids', 'radiant_constellation'],
    ['/api/v1/data/countries?q=australia', 'iso_alpha2'],
    ['/api/v1/data/materials/density?q=steel', 'density'],
    ['/api/v1/data/mime-types?extension=json', 'mime_type']
  ];

  for (const [url, marker] of requests) {
    const response = await app.inject(url);
    assert.equal(response.statusCode, 200, url);
    assert.equal(Array.isArray(response.json().data), true, url);
    assert.ok(response.json().data.length > 0, url);
    assert.notEqual(response.json().data[0][marker], undefined, url);
  }
  const status = await app.inject('/v1/status');
  await app.close();

  const dataFamily = status.json().endpoint_families.find((family) => family.family === 'data');
  assert.equal(dataFamily.routes.length, 11);
});

test('account credits endpoint requires authentication', async () => {
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_KEYS: 'customer_a:test-key',
      TIME_API_CACHE: 'memory'
    },
    logger: false
  });
  const response = await app.inject('/v1/account/credits');
  await app.close();

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'unauthorized');
});

test('account credits endpoint reports local development when no persistent store exists', async () => {
  const app = await buildServer({
    env: {
      TIME_API_KEYS: 'customer_a:test-key',
      TIME_API_CACHE: 'memory'
    },
    logger: false
  });
  const response = await app.inject({
    url: '/v1/account/credits',
    headers: { 'x-api-key': 'test-key' }
  });
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().customer_id, 'customer_a');
  assert.equal(response.json().credits.configured, false);
  assert.equal(response.json().credits.balance, null);
});

test('account credits endpoint returns database-backed account and balance', async () => {
  const keyStore = {
    async findByKey() {
      return {
        customerId: 'customer_a',
        planId: 'database',
        rateLimitPerMinute: 240,
        keyFingerprint: 'ct_live_test',
        authenticated: true
      };
    },
    async getAccountCredits(customerId) {
      assert.equal(customerId, 'customer_a');
      return {
        customer_id: 'customer_a',
        display_name: 'Customer A',
        status: 'active',
        plan: { rate_limit_per_minute: 240 },
        usage: { requests_this_month: 17 },
        credits: {
          configured: true,
          balance: 1000,
          unit: 'api_credit',
          last_credit_event_at: '2026-09-01T08:00:00.000Z'
        }
      };
    },
    async recordUsage() {}
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const response = await app.inject({
    url: '/v1/account/credits',
    headers: { authorization: 'Bearer any-test-key' }
  });
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().customer_id, 'customer_a');
  assert.equal(response.json().usage.requests_this_month, 17);
  assert.equal(response.json().credits.balance, 1000);
});

test('account profile endpoint reports authenticated local key capability state', async () => {
  const app = await buildServer({
    env: {
      TIME_API_KEYS: 'customer_a:test-key',
      TIME_API_CACHE: 'memory'
    },
    logger: false
  });
  const response = await app.inject({
    url: '/v1/account/profile',
    headers: { 'x-api-key': 'test-key' }
  });
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().customer_id, 'customer_a');
  assert.equal(response.json().capabilities.account_database, false);
  assert.equal(response.json().capabilities.usage_breakdown, false);
});

test('account usage endpoint reports honest local fallback without persistent usage data', async () => {
  const app = await buildServer({
    env: {
      TIME_API_KEYS: 'customer_a:test-key',
      TIME_API_CACHE: 'memory'
    },
    logger: false
  });
  const response = await app.inject({
    url: '/v1/account/usage',
    headers: { 'x-api-key': 'test-key' }
  });
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().customer_id, 'customer_a');
  assert.equal(response.json().usage.configured, false);
  assert.equal(response.json().usage.requests_this_month, null);
  assert.deepEqual(response.json().usage.by_route, []);
});

test('account limits endpoint reports local configured rate and batch limits', async () => {
  const app = await buildServer({
    env: {
      TIME_API_KEYS: 'customer_a:test-key',
      TIME_API_CACHE: 'memory'
    },
    logger: false
  });
  const response = await app.inject({
    url: '/v1/account/limits',
    headers: { 'x-api-key': 'test-key' }
  });
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().customer_id, 'customer_a');
  assert.equal(response.json().limits.configured, false);
  assert.equal(response.json().limits.batch_limits.time_batch_points, 100);
});

test('account profile, usage, and limits return database-backed account data', async () => {
  const keyStore = {
    async findByKey() {
      return {
        customerId: 'customer_a',
        planId: 'database',
        rateLimitPerMinute: 240,
        keyFingerprint: 'ct_live_test',
        authenticated: true
      };
    },
    async getAccountProfile(customerId) {
      assert.equal(customerId, 'customer_a');
      return {
        customer_id: 'customer_a',
        display_name: 'Customer A',
        status: 'active',
        authentication: { plan_id: 'database' },
        plan: { rate_limit_per_minute: 240 },
        capabilities: {
          account_database: true,
          credit_ledger: true,
          usage_breakdown: true
        }
      };
    },
    async getAccountUsage(customerId) {
      assert.equal(customerId, 'customer_a');
      return {
        customer_id: 'customer_a',
        display_name: 'Customer A',
        status: 'active',
        usage: {
          configured: true,
          window: 'current_month',
          requests_this_month: 23,
          successful_requests_this_month: 21,
          error_requests_this_month: 2,
          first_request_at: '2026-09-01T08:00:00.000Z',
          last_request_at: '2026-09-10T00:00:00.000Z',
          by_route: [
            {
              route: '/v1/time',
              method: 'GET',
              requests: 12,
              errors: 0,
              average_duration_ms: 9
            }
          ]
        }
      };
    },
    async getAccountLimits(customerId) {
      assert.equal(customerId, 'customer_a');
      return {
        customer_id: 'customer_a',
        display_name: 'Customer A',
        status: 'active',
        limits: {
          configured: true,
          rate_limit_per_minute: 240,
          batch_limits: {
            time_batch_points: 100,
            date_difference_ranges: 100,
            geo_distance_pairs: 100
          }
        }
      };
    },
    async recordUsage() {}
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const profile = await app.inject({
    url: '/v1/account/profile',
    headers: { authorization: 'Bearer any-test-key' }
  });
  const usage = await app.inject({
    url: '/v1/account/usage',
    headers: { authorization: 'Bearer any-test-key' }
  });
  const limits = await app.inject({
    url: '/v1/account/limits',
    headers: { authorization: 'Bearer any-test-key' }
  });
  await app.close();

  assert.equal(profile.statusCode, 200);
  assert.equal(profile.json().capabilities.credit_ledger, true);
  assert.equal(usage.statusCode, 200);
  assert.equal(usage.json().usage.requests_this_month, 23);
  assert.equal(usage.json().usage.by_route[0].route, '/v1/time');
  assert.equal(limits.statusCode, 200);
  assert.equal(limits.json().limits.rate_limit_per_minute, 240);
});

test('admin endpoints stay unavailable unless a separate admin key is configured', async () => {
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_KEYS: 'customer_a:test-key',
      TIME_API_CACHE: 'memory'
    },
    logger: false
  });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/admin/customers',
    headers: { 'x-api-key': 'test-key' },
    payload: {
      customer_id: 'customer_b',
      display_name: 'Customer B',
      rate_limit_per_minute: 120
    }
  });
  await app.close();

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, 'admin_key_unavailable');
});

test('admin endpoints reject customer API keys when admin key is configured', async () => {
  const app = await buildServer({
    env: {
      TIME_API_ADMIN_KEY: 'admin-test-key',
      TIME_API_KEYS: 'customer_a:test-key',
      TIME_API_CACHE: 'memory'
    },
    logger: false
  });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/admin/customers',
    headers: { 'x-api-key': 'test-key' },
    payload: {
      customer_id: 'customer_b',
      display_name: 'Customer B',
      rate_limit_per_minute: 120
    }
  });
  await app.close();

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'unauthorized');
});

test('admin customer creation and credit ledger endpoints delegate to persistent store', async () => {
  const calls = [];
  const keyStore = {
    async listCustomers(options) {
      calls.push(['listCustomers', options]);
      return {
        count: 1,
        customers: [
          {
            customer_id: 'customer_b',
            display_name: 'Customer B',
            status: 'active',
            credit_balance: 500,
            requests_this_month: 12,
            trial_ends_at: '2026-12-17T07:00:00.000Z'
          }
        ]
      };
    },
    async getCustomerDetail(customerId) {
      calls.push(['getCustomerDetail', customerId]);
      return {
        customer_id: customerId,
        display_name: 'Customer B',
        status: 'active',
        credit_balance: 500,
        trial_ends_at: '2026-12-17T07:00:00.000Z',
        usage: { requests_this_month: 12 },
        api_keys: []
      };
    },
    async createOrUpdateCustomer(customer) {
      calls.push(['createOrUpdateCustomer', customer]);
      return {
        customer_id: customer.slug,
        display_name: customer.displayName,
        status: customer.status,
        rate_limit_per_minute: customer.rateLimitPerMinute,
        created_at: '2026-09-17T07:00:00.000Z',
        updated_at: '2026-09-17T07:00:00.000Z'
      };
    },
    async grantCredits(customerId, grant) {
      calls.push(['grantCredits', customerId, grant]);
      return {
        customer_id: customerId,
        display_name: 'Customer B',
        balance: 500,
        unit: 'api_credit',
        event: {
          id: 1,
          delta: grant.delta,
          reason: grant.reason,
          reference: grant.reference,
          metadata: grant.metadata,
          created_at: '2026-09-17T07:01:00.000Z',
          created_by: 'api_admin'
        }
      };
    },
    async listCreditLedger(customerId, options) {
      calls.push(['listCreditLedger', customerId, options]);
      return {
        customer_id: customerId,
        display_name: 'Customer B',
        balance: 500,
        unit: 'api_credit',
        events: [
          {
            id: 1,
            delta: 500,
            reason: 'launch grant',
            reference: 'manual:launch',
            metadata: {},
            created_at: '2026-09-17T07:01:00.000Z',
            created_by: 'api_admin'
          }
        ]
      };
    },
    async recordUsage() {}
  };
  const app = await buildServer({
    env: {
      TIME_API_ADMIN_KEY: 'admin-test-key',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const created = await app.inject({
    method: 'POST',
    url: '/v1/admin/customers',
    headers: { 'x-admin-key': 'admin-test-key' },
    payload: {
      customer_id: 'customer_b',
      display_name: 'Customer B',
      rate_limit_per_minute: 180
    }
  });
  const granted = await app.inject({
    method: 'POST',
    url: '/v1/admin/customers/customer_b/credits',
    headers: { 'x-admin-key': 'admin-test-key' },
    payload: {
      delta: 500,
      reason: 'launch grant',
      reference: 'manual:launch',
      metadata: { source: 'test' }
    }
  });
  const ledger = await app.inject({
    url: '/v1/admin/customers/customer_b/credits?limit=10',
    headers: { 'x-admin-key': 'admin-test-key' }
  });
  const list = await app.inject({
    url: '/v1/admin/customers?limit=10',
    headers: { 'x-admin-key': 'admin-test-key' }
  });
  const detail = await app.inject({
    url: '/v1/admin/customers/customer_b',
    headers: { 'x-admin-key': 'admin-test-key' }
  });
  await app.close();

  assert.equal(created.statusCode, 201);
  assert.equal(created.json().customer_id, 'customer_b');
  assert.equal(created.json().rate_limit_per_minute, 180);
  assert.equal(granted.statusCode, 201);
  assert.equal(granted.json().balance, 500);
  assert.equal(ledger.statusCode, 200);
  assert.equal(ledger.json().events.length, 1);
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().customers[0].credit_balance, 500);
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().customer_id, 'customer_b');
  assert.equal(calls[0][0], 'createOrUpdateCustomer');
  assert.equal(calls[1][0], 'grantCredits');
  assert.equal(calls[2][0], 'listCreditLedger');
  assert.equal(calls[3][0], 'listCustomers');
  assert.equal(calls[4][0], 'getCustomerDetail');
});

test('admin webhook endpoints delegate to persistent store', async () => {
  const calls = [];
  const keyStore = {
    async listCustomerWebhooks(customerId) {
      calls.push(['listCustomerWebhooks', customerId]);
      return {
        customer_id: customerId,
        display_name: 'Customer B',
        webhooks: [
          {
            id: '1',
            event_type: 'calculation.heavy.completed',
            destination_url: 'https://integrator.example/webhooks/calculationtime',
            status: 'active',
            created_at: '2026-09-19T10:00:00.000Z',
            updated_at: '2026-09-19T10:00:00.000Z'
          }
        ]
      };
    },
    async upsertCustomerWebhook(customerId, input) {
      calls.push(['upsertCustomerWebhook', customerId, input]);
      return {
        customer_id: customerId,
        display_name: 'Customer B',
        webhook: {
          id: '1',
          event_type: input.event_type,
          destination_url: input.destination_url,
          status: input.status,
          created_at: '2026-09-19T10:00:00.000Z',
          updated_at: '2026-09-19T10:00:00.000Z'
        }
      };
    },
    async recordUsage() {}
  };
  const app = await buildServer({
    env: {
      TIME_API_ADMIN_KEY: 'admin-test-key',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const upserted = await app.inject({
    method: 'PUT',
    url: '/v1/admin/customers/customer_b/webhooks',
    headers: { 'x-admin-key': 'admin-test-key' },
    payload: {
      event_type: 'calculation.heavy.completed',
      destination_url: 'https://integrator.example/webhooks/calculationtime',
      status: 'active'
    }
  });
  const listed = await app.inject({
    url: '/v1/admin/customers/customer_b/webhooks',
    headers: { 'x-admin-key': 'admin-test-key' }
  });
  await app.close();

  assert.equal(upserted.statusCode, 201);
  assert.equal(upserted.json().webhook.event_type, 'calculation.heavy.completed');
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.json().webhooks[0].destination_url, 'https://integrator.example/webhooks/calculationtime');
  assert.equal(calls[0][0], 'upsertCustomerWebhook');
  assert.equal(calls[1][0], 'listCustomerWebhooks');
});

test('heavy successful billable calculations dispatch optional tenant webhooks', async () => {
  const delivered = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    delivered.push({
      url,
      headers: options.headers,
      payload: JSON.parse(options.body)
    });
    return { ok: true, status: 204 };
  };
  const keyStore = {
    async findByKey() {
      return {
        customerId: 'customer_a',
        planId: 'database',
        rateLimitPerMinute: 240,
        keyFingerprint: 'ct_live_test',
        authenticated: true
      };
    },
    async checkBillableAccess() {
      return { customer_id: 'customer_a', balance: 1000, trial_ends_at: '2027-09-19T00:00:00.000Z' };
    },
    async debitBillableRequest() {},
    async recordUsage() {},
    async listWebhookDestinations(customerId, options) {
      assert.equal(customerId, 'customer_a');
      assert.equal(options.eventType, 'calculation.heavy.completed');
      return [{ url: 'https://integrator.example/webhooks/calculationtime', timeout_ms: 1000 }];
    }
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/finance/loan-amortization',
    headers: { 'x-api-key': 'any-test-key' },
    payload: { principal: 1000, annual_interest_rate_percent: 12, term_months: 12 }
  });
  await new Promise((resolve) => setTimeout(resolve, 25));
  await app.close();
  globalThis.fetch = originalFetch;

  assert.equal(response.statusCode, 200);
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].url, 'https://integrator.example/webhooks/calculationtime');
  assert.equal(delivered[0].payload.event_type, 'calculation.heavy.loan_amortization.completed');
  assert.equal(delivered[0].payload.route, '/v1/finance/loan-amortization');
  assert.equal(delivered[0].payload.credit_cost, 5);
  assert.equal(delivered[0].payload.customer_id, 'customer_a');
});

test('observatory share endpoint stores and resolves a private share token', async () => {
  const shareStore = createMemoryShareStore({
    now: () => new Date('2026-08-01T10:00:00Z'),
    tokenFactory: () => 'abcdefghijklmnopqrstu1'
  });
  const app = await buildServer({
    env: { TIME_API_CACHE: 'memory' },
    observatoryShareStore: shareStore,
    logger: false
  });
  const created = await app.inject({
    method: 'POST',
    url: '/v1/observatory/share',
    payload: {
      poster: 'moment',
      date: '2026-08-01',
      location: { name: 'Munich', lat: 48.137154, lng: 11.576124 },
      time: '12:00',
      ttl_days: 7
    }
  });
  const resolved = await app.inject('/v1/observatory/share/abcdefghijklmnopqrstu1');
  await app.close();

  assert.equal(created.statusCode, 201);
  assert.equal(created.headers['x-robots-tag'], 'noindex, nofollow');
  assert.equal(created.json().token, 'abcdefghijklmnopqrstu1');
  assert.equal(created.json().share_url, 'https://calculationtime.com/observatory/share/abcdefghijklmnopqrstu1/');
  assert.equal(created.json().expires_at, '2026-08-08T10:00:00.000Z');
  assert.equal(resolved.statusCode, 200);
  assert.equal(resolved.headers['x-robots-tag'], 'noindex, nofollow');
  assert.equal(resolved.json().poster, 'moment');
  assert.equal(resolved.json().location.name, 'Munich');
});

test('observatory share endpoint returns 404 for invalid token', async () => {
  const app = await buildServer({
    env: { TIME_API_CACHE: 'memory' },
    observatoryShareStore: createMemoryShareStore(),
    logger: false
  });
  const response = await app.inject('/v1/observatory/share/not-a-real-token');
  await app.close();

  assert.equal(response.statusCode, 404);
  assert.equal(response.headers['x-robots-tag'], 'noindex, nofollow');
  assert.equal(response.json().error.code, 'share_not_found');
});

test('observatory share endpoint expires old tokens', async () => {
  let clock = new Date('2026-08-01T10:00:00Z');
  const shareStore = createMemoryShareStore({
    now: () => clock,
    tokenFactory: () => 'abcdefghijklmnopqrstu2'
  });
  const app = await buildServer({
    env: { TIME_API_CACHE: 'memory' },
    observatoryShareStore: shareStore,
    logger: false
  });
  const created = await app.inject({
    method: 'POST',
    url: '/v1/observatory/share',
    payload: {
      poster: 'datasheet',
      date: '2026-08-01',
      ttl_days: 1
    }
  });
  clock = new Date('2026-08-02T10:00:01Z');
  const expired = await app.inject('/v1/observatory/share/abcdefghijklmnopqrstu2');
  await app.close();

  assert.equal(created.statusCode, 201);
  assert.equal(expired.statusCode, 404);
  assert.equal(expired.json().error.code, 'share_not_found');
});

test('protected canary supports private external monitoring keys', async () => {
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_KEYS: 'monitoring:test-key',
      TIME_API_CACHE: 'memory'
    },
    logger: false
  });
  const rejected = await app.inject('/v1/canary');
  const accepted = await app.inject({
    url: '/v1/canary',
    headers: { 'x-api-key': 'test-key' }
  });
  await app.close();

  assert.equal(rejected.statusCode, 401);
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.json().canary, 'protected_endpoint_reachable');
  assert.equal(accepted.json().customer_id, 'monitoring');
});

test('coordinate current time lookup works without caching now responses', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const response = await app.inject('/v1/time?lat=48.137154&lon=11.576124');
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['x-cache'], undefined);
  assert.equal(response.json().timezone, 'Europe/Berlin');
});

test('explicit timestamp coordinate conversion is deterministic and cacheable', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const path = '/v1/time?lat=48.137154&lon=11.576124&at=2026-07-12T12:00:00Z';
  const first = await app.inject(path);
  const second = await app.inject(path);
  await app.close();

  assert.equal(first.statusCode, 200);
  assert.equal(first.headers['x-cache'], 'MISS');
  assert.equal(second.headers['x-cache'], 'HIT');
  assert.equal(second.json().local_time, '2026-07-12T14:00:00.000+02:00');
});

test('date difference endpoint preserves response contract', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const response = await app.inject('/v1/date/difference?start=2026-07-12&end=2026-08-01');
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().days, 20);
  assert.equal(response.json().inclusive_days, 21);
});

test('date difference batch endpoint returns indexed results', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/date/difference/batch',
    payload: {
      ranges: [
        { start: '2026-07-12', end: '2026-08-01' },
        { start: '2026-08-01', end: '2026-07-12' }
      ]
    }
  });
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().count, 2);
  assert.equal(response.json().results[0].days, 20);
  assert.equal(response.json().results[1].days, -20);
  assert.equal(response.json().method, 'calendar_day_difference_batch');
});

test('business-day endpoint preserves response contract', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/date/business-days',
    payload: {
      start: '2026-07-13',
      end: '2026-07-17',
      holidays: ['2026-07-15']
    }
  });
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().business_days, 3);
});

test('holiday endpoint returns beta jurisdiction holidays with observed dates', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const response = await app.inject('/v1/holidays?country=US&year=2026');
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().input.normalized_country, 'US');
  assert.equal(response.json().dataset_version, 'holidays-beta-2026-07-13');
  assert.ok(response.json().holidays.some((holiday) => holiday.name === 'Thanksgiving Day' && holiday.date === '2026-11-26'));
});

test('holiday business-day endpoint merges jurisdiction holidays into business-day math', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/date/business-days/jurisdiction',
    payload: {
      country: 'UK',
      start: '2026-12-24',
      end: '2026-12-29'
    }
  });
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().input.normalized_country, 'GB');
  assert.equal(response.json().business_days, 1);
  assert.equal(response.json().method, 'business_days_with_rule_generated_public_holidays_beta');
});

test('phase 2 date routes expose pure math endpoint suite with one-credit costs', async () => {
  const debits = [];
  const keyStore = {
    async findByKey() {
      return {
        customerId: 'customer_a',
        planId: 'database',
        rateLimitPerMinute: 240,
        keyFingerprint: 'ct_live_test',
        authenticated: true
      };
    },
    async checkBillableAccess(_customerId, options) {
      return { balance: 1000, required: options.creditCost };
    },
    async debitBillableRequest(_customerId, event) {
      debits.push([event.route, event.creditCost]);
    },
    async recordUsage() {}
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const headers = { 'x-api-key': 'test-key' };
  const requests = [
    ['/v1/date/business-days-add', { start: '2026-07-13', business_days: 5, holidays: ['2026-07-15'] }, 'result_date'],
    ['/v1/date/iso-week', { date: '2026-01-01' }, 'iso_week'],
    ['/v1/date/age-breakdown', { birth_date: '2000-01-01', as_of: '2026-01-02T03:04:05Z' }, 'age'],
    ['/v1/date/countdown-precise', { start: '2026-09-21T00:00:00Z', end: '2027-01-01T12:30:15Z' }, 'delta'],
    ['/v1/date/epoch-converter', { epoch: 946684800, unit: 'seconds' }, 'iso_utc'],
    ['/v1/date/quarter-calculator', { date: '2026-09-21', fiscal_start_month: 4 }, 'calendar_quarter'],
    ['/v1/date/leap-year-check', { year: 1900 }, 'gregorian'],
    ['/v1/date/days-in-month', { year: 2028, month: 2 }, 'days_in_month'],
    ['/v1/date/timezone-offset', { timestamp: '2026-09-21T00:00:00Z', offset: '+10:00' }, 'local_timestamp'],
    ['/v1/date/calendar-range', { start: '2026-09-21', days: 3 }, 'dates']
  ];

  for (const [url, payload, marker] of requests) {
    const response = await app.inject({ method: 'POST', url, headers, payload });
    assert.equal(response.statusCode, 200, url);
    assert.notEqual(response.json()[marker], undefined, url);
  }
  await app.close();

  for (const [url] of requests) {
    assert.equal(debits.some(([route, cost]) => route === url && cost === 1), true, url);
  }
});

test('status advertises phase 2 date route inventory', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const response = await app.inject('/v1/status');
  await app.close();

  const date = response.json().endpoint_families.find((family) => family.family === 'date');
  assert.ok(date.routes.includes('POST /v1/date/business-days-add'));
  assert.ok(date.routes.includes('POST /v1/date/calendar-range'));
});

test('holiday is-business-day endpoint identifies public holidays', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const response = await app.inject('/v1/holidays/is-business-day?country=AU&date=2026-01-26');
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().is_business_day, false);
  assert.equal(response.json().holiday.name, 'Australia Day');
});

test('astronomy ephemeris endpoint returns cacheable planet telemetry', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const path = '/v1/astronomy/ephemeris?date=2029-10-21';
  const first = await app.inject(path);
  const second = await app.inject(path);
  await app.close();

  assert.equal(first.statusCode, 200);
  assert.equal(first.headers['x-cache'], 'MISS');
  assert.equal(second.headers['x-cache'], 'HIT');
  assert.equal(first.json().input.date, '2029-10-21T00:00:00.000Z');
  assert.equal(first.json().method, 'astronomy-engine_vsop87_geocentric_and_heliocentric_vectors');
  assert.equal(first.json().bodies.length, 11);

  const mars = first.json().bodies.find((body) => body.id === 'mars');
  assert.equal(mars.kind, 'planet');
  assert.ok(mars.geocentric.distance_au > 1);
  assert.ok(mars.geocentric.right_ascension_hours >= 0);
  assert.ok(mars.geocentric.right_ascension_hours <= 24);
  assert.ok(mars.heliocentric.distance_au > 1);
});

test('astronomy ephemeris endpoint validates date input', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const response = await app.inject('/v1/astronomy/ephemeris?date=2500-01-01');
  await app.close();

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'date_out_of_range');
});

test('crux astronomy routes return sidereal positions and weighted credit costs', async () => {
  const debits = [];
  const keyStore = {
    async findByKey() {
      return {
        customerId: 'customer_a',
        planId: 'database',
        rateLimitPerMinute: 240,
        keyFingerprint: 'ct_live_test',
        authenticated: true
      };
    },
    async checkBillableAccess(_customerId, options) {
      return { balance: 1000, required: options.creditCost };
    },
    async debitBillableRequest(_customerId, event) {
      debits.push([event.route, event.creditCost]);
    },
    async recordUsage() {}
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const midnight = await app.inject({
    method: 'POST',
    url: '/v1/astronomy/crux-midnight',
    headers: { 'x-api-key': 'test-key' },
    payload: { start_date: '2026-03-31', days: 3 }
  });
  const hourly = await app.inject({
    method: 'POST',
    url: '/v1/astronomy/crux-hourly',
    headers: { 'x-api-key': 'test-key' },
    payload: { date: '2026-03-31' }
  });
  const current = await app.inject({
    method: 'POST',
    url: '/v1/astronomy/crux-current',
    headers: { 'x-api-key': 'test-key' },
    payload: { timestamp: '2026-04-01T00:00:00+10:00' }
  });
  await app.close();

  assert.equal(midnight.statusCode, 200);
  assert.equal(midnight.json().positions[0].crux_hand_degrees, 0);
  assert.equal(midnight.json().positions[1].day_index, 1);
  assert.equal(hourly.statusCode, 200);
  assert.equal(hourly.json().positions.length, 24);
  assert.equal(hourly.json().positions[0].crux_hand_degrees, 0);
  assert.equal(current.statusCode, 200);
  assert.ok(current.json().crux_hand_degrees > 0.98);
  assert.ok(current.json().crux_hand_degrees < 0.99);
  assert.equal(debits.some(([route, cost]) => route === '/v1/astronomy/crux-midnight' && cost === 2), true);
  assert.equal(debits.some(([route, cost]) => route === '/v1/astronomy/crux-hourly' && cost === 5), true);
  assert.equal(debits.some(([route, cost]) => route === '/v1/astronomy/crux-current' && cost === 2), true);
});

test('advanced astronomy routes expose pure math endpoint suite with one-credit costs', async () => {
  const debits = [];
  const keyStore = {
    async findByKey() {
      return {
        customerId: 'customer_a',
        planId: 'database',
        rateLimitPerMinute: 240,
        keyFingerprint: 'ct_live_test',
        authenticated: true
      };
    },
    async checkBillableAccess(_customerId, options) {
      return { balance: 1000, required: options.creditCost };
    },
    async debitBillableRequest(_customerId, event) {
      debits.push([event.route, event.creditCost]);
    },
    async recordUsage() {}
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const headers = { 'x-api-key': 'test-key' };
  const requests = [
    ['/v1/astronomy/solar-noon', { date: '2026-06-21', lat: 48.137154, lon: 11.576124 }, 'solar_noon'],
    ['/v1/astronomy/equinox-solstice', { year: 2026 }, 'events'],
    ['/v1/astronomy/moon-phase', { timestamp: '2026-06-21T00:00:00Z' }, 'moon'],
    ['/v1/astronomy/julian-date', { timestamp: '2000-01-01T12:00:00Z' }, 'julian_day'],
    ['/v1/astronomy/sidereal-time', { timestamp: '2026-06-21T00:00:00Z', lon: 11.576124 }, 'sidereal_time'],
    ['/v1/astronomy/twilight-calculator', { date: '2026-06-21', lat: 48.137154, lon: 11.576124 }, 'twilight'],
    ['/v1/astronomy/sun-position', { timestamp: '2026-06-21T12:00:00Z', lat: 48.137154, lon: 11.576124 }, 'sun'],
    ['/v1/astronomy/moon-position', { timestamp: '2026-06-21T00:00:00Z', lat: 48.137154, lon: 11.576124 }, 'moon'],
    ['/v1/astronomy/day-length', { date: '2026-06-21', lat: 48.137154, lon: 11.576124 }, 'daylight'],
    ['/v1/astronomy/polar-night-check', { date: '2026-06-21', lat: 80, lon: 0 }, 'classification']
  ];

  for (const [url, payload, marker] of requests) {
    const response = await app.inject({ method: 'POST', url, headers, payload });
    assert.equal(response.statusCode, 200, url);
    assert.notEqual(response.json()[marker], undefined, url);
  }
  await app.close();

  for (const [url] of requests) {
    assert.equal(debits.some(([route, cost]) => route === url && cost === 1), true, url);
  }
});

test('status advertises advanced astronomy route inventory', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const response = await app.inject('/v1/status');
  await app.close();

  const astronomy = response.json().endpoint_families.find((family) => family.family === 'astronomy');
  assert.ok(astronomy.routes.includes('POST /v1/astronomy/solar-noon'));
  assert.ok(astronomy.routes.includes('POST /v1/astronomy/polar-night-check'));
});

test('geospatial distance endpoint preserves response contract', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const response = await app.inject('/v1/geo/distance?from_lat=48.137154&from_lon=11.576124&to_lat=52.52&to_lon=13.405');
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().bearing.compass, 'NNE');
  assert.ok(response.json().distance.kilometers > 500);
  assert.ok(response.json().distance.kilometers < 510);
});

test('geospatial distance batch endpoint returns indexed results', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/geo/distance/batch',
    payload: {
      pairs: [
        {
          from_lat: 48.137154,
          from_lon: 11.576124,
          to_lat: 52.52,
          to_lon: 13.405
        },
        {
          from_lat: 48.137154,
          from_lon: 11.576124,
          to_lat: 48.370545,
          to_lon: 10.89779
        }
      ]
    }
  });
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().count, 2);
  assert.equal(response.json().results[0].index, 0);
  assert.equal(response.json().results[0].bearing.compass, 'NNE');
  assert.equal(response.json().method, 'haversine_sphere_batch');
});

test('geospatial elevation endpoint returns cacheable Open-Meteo-backed terrain elevation', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    assert.equal(new URL(url).searchParams.get('latitude'), '48.137154');
    assert.equal(new URL(url).searchParams.get('longitude'), '11.576124');
    return {
      ok: true,
      async json() {
        return {
          elevation: [519]
        };
      }
    };
  };

  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const path = '/v1/geo/elevation?lat=48.137154&lon=11.576124';
  const first = await app.inject(path);
  const second = await app.inject(path);
  await app.close();
  globalThis.fetch = originalFetch;

  assert.equal(first.statusCode, 200);
  assert.equal(first.headers['x-cache'], 'MISS');
  assert.equal(first.headers['cache-control'], 'private, max-age=2592000, stale-while-revalidate=86400');
  assert.equal(second.headers['x-cache'], 'HIT');
  assert.equal(second.headers['cache-control'], 'private, max-age=2592000, stale-while-revalidate=86400');
  assert.equal(calls, 1);
  assert.equal(first.json().elevation.meters, 519);
  assert.equal(first.json().provider.name, 'Open-Meteo Elevation API');
  assert.equal(first.json().method, 'open_meteo_copernicus_dem_glo_90');
});

test('solar position endpoint returns local solar geometry without provider calls', async () => {
  const app = await buildServer({ env: { TIME_API_CACHE: 'memory' }, logger: false });
  const path = '/v1/solar/position?lat=48.137154&lon=11.576124&at=2026-07-26T12:00:00Z';
  const first = await app.inject(path);
  const second = await app.inject(path);
  await app.close();

  assert.equal(first.statusCode, 200);
  assert.equal(first.headers['x-cache'], 'MISS');
  assert.equal(first.headers['cache-control'], 'private, max-age=604800, stale-while-revalidate=86400');
  assert.equal(second.headers['x-cache'], 'HIT');
  assert.equal(second.headers['cache-control'], 'private, max-age=604800, stale-while-revalidate=86400');
  assert.equal(first.json().method, 'noaa_solar_position_approximation');
  assert.ok(first.json().solar_position.azimuth_degrees >= 0);
  assert.ok(first.json().solar_position.azimuth_degrees < 360);
  assert.ok(first.json().solar_position.apparent_elevation_degrees > 50);
  assert.equal(first.json().daylight_state, 'sun_above_horizon');
});

test('API key middleware rejects protected routes when required', async () => {
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_KEYS: 'customer_a:test-key',
      TIME_API_CACHE: 'memory'
    },
    logger: false
  });
  const rejected = await app.inject('/v1/date/difference?start=2026-07-12&end=2026-08-01');
  const accepted = await app.inject({
    url: '/v1/date/difference?start=2026-07-12&end=2026-08-01',
    headers: { 'x-api-key': 'test-key' }
  });
  await app.close();

  assert.equal(rejected.statusCode, 401);
  assert.equal(rejected.json().error.code, 'unauthorized');
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.json().days, 20);
});

test('API key middleware accepts persistent key store matches', async () => {
  const keyStore = {
    async findByKey(key) {
      if (key !== 'stored-key') return null;
      return {
        customerId: 'stored_customer',
        planId: 'database',
        rateLimitPerMinute: 120,
        keyFingerprint: 'stored-prefix'
      };
    }
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const response = await app.inject({
    url: '/v1/date/difference?start=2026-07-12&end=2026-08-01',
    headers: { authorization: 'Bearer stored-key' }
  });
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().days, 20);
});

test('billable routes enforce commercial access and debit successful requests', async () => {
  const calls = [];
  const keyStore = {
    async findByKey(key) {
      if (key !== 'stored-key') return null;
      return {
        customerId: 'stored_customer',
        planId: 'database',
        rateLimitPerMinute: 120,
        keyFingerprint: 'stored-prefix'
      };
    },
    async checkBillableAccess(customerId) {
      calls.push(['checkBillableAccess', customerId]);
      return {
        customer_id: customerId,
        balance: 10,
        trial_ends_at: '2026-12-17T00:00:00.000Z'
      };
    },
    async debitBillableRequest(customerId, event) {
      calls.push(['debitBillableRequest', customerId, event.route, event.statusCode]);
      return { customer_id: customerId, balance: 9 };
    },
    async recordUsage(event) {
      calls.push(['recordUsage', event.route, event.statusCode]);
    }
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const response = await app.inject({
    url: '/v1/date/difference?start=2026-07-12&end=2026-08-01',
    headers: { authorization: 'Bearer stored-key' }
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().days, 20);
  assert.equal(calls[0][0], 'checkBillableAccess');
  assert.equal(calls.some((call) => call[0] === 'debitBillableRequest' && call[2] === '/v1/date/difference'), true);
});

test('account and canary routes are protected but not billable', async () => {
  const calls = [];
  const keyStore = {
    async findByKey(key) {
      if (key !== 'stored-key') return null;
      return {
        customerId: 'stored_customer',
        planId: 'database',
        rateLimitPerMinute: 120,
        keyFingerprint: 'stored-prefix'
      };
    },
    async checkBillableAccess() {
      calls.push(['checkBillableAccess']);
      throw new Error('should not be called');
    },
    async getAccountProfile(customerId) {
      return {
        customer_id: customerId,
        display_name: 'Stored Customer',
        status: 'active',
        authentication: { plan_id: 'database' },
        plan: { rate_limit_per_minute: 120 },
        capabilities: { account_database: true, credit_ledger: true, usage_breakdown: true }
      };
    },
    async recordUsage() {}
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const profile = await app.inject({
    url: '/v1/account/profile',
    headers: { authorization: 'Bearer stored-key' }
  });
  const canary = await app.inject({
    url: '/v1/canary',
    headers: { authorization: 'Bearer stored-key' }
  });
  await app.close();

  assert.equal(profile.statusCode, 200);
  assert.equal(canary.statusCode, 200);
  assert.deepEqual(calls, []);
});

test('billable routes return payment required when credits are exhausted', async () => {
  const keyStore = {
    async findByKey(key) {
      if (key !== 'stored-key') return null;
      return {
        customerId: 'stored_customer',
        planId: 'database',
        rateLimitPerMinute: 120,
        keyFingerprint: 'stored-prefix'
      };
    },
    async checkBillableAccess() {
      throw Object.assign(new Error('API credit balance is exhausted'), {
        statusCode: 402,
        code: 'credits_exhausted'
      });
    },
    async recordUsage() {}
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const response = await app.inject({
    url: '/v1/date/difference?start=2026-07-12&end=2026-08-01',
    headers: { authorization: 'Bearer stored-key' }
  });
  await app.close();

  assert.equal(response.statusCode, 402);
  assert.equal(response.json().error.code, 'credits_exhausted');
});

test('billable routes return forbidden when trial has expired', async () => {
  const keyStore = {
    async findByKey(key) {
      if (key !== 'stored-key') return null;
      return {
        customerId: 'stored_customer',
        planId: 'database',
        rateLimitPerMinute: 120,
        keyFingerprint: 'stored-prefix'
      };
    },
    async checkBillableAccess() {
      throw Object.assign(new Error('Customer trial has expired'), {
        statusCode: 403,
        code: 'trial_expired'
      });
    },
    async recordUsage() {}
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const response = await app.inject({
    url: '/v1/date/difference?start=2026-07-12&end=2026-08-01',
    headers: { authorization: 'Bearer stored-key' }
  });
  await app.close();

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, 'trial_expired');
});

test('nearby endpoint returns sorted radius-filtered points from geo store', async () => {
  const geoStore = {
    async nearby(input) {
      assert.equal(input.lat, '48.137154');
      return {
        input,
        count: 1,
        results: [
          {
            name: 'Munich test point',
            distance: { kilometers: 0.2 }
          }
        ],
        method: 'bounding_box_prefilter_haversine_sort'
      };
    }
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_KEYS: 'customer_a:test-key',
      TIME_API_CACHE: 'memory'
    },
    geoStore,
    logger: false
  });
  const response = await app.inject({
    url: '/v1/geo/nearby?lat=48.137154&lon=11.576124&radius_km=10&limit=5',
    headers: { 'x-api-key': 'test-key' }
  });
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().count, 1);
  assert.equal(response.json().method, 'bounding_box_prefilter_haversine_sort');
});

test('finance, stats, and payroll routes return calculations and credit costs', async () => {
  const debits = [];
  const keyStore = {
    async findByKey(key) {
      if (key !== 'stored-key') return null;
      return {
        customerId: 'stored_customer',
        planId: 'database',
        rateLimitPerMinute: 120,
        keyFingerprint: 'stored-prefix'
      };
    },
    async checkBillableAccess(_customerId, options) {
      return { balance: 100, required_credits: options.creditCost };
    },
    async debitBillableRequest(_customerId, event) {
      debits.push([event.route, event.creditCost]);
      return { balance: 100 - event.creditCost };
    },
    async recordUsage() {}
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const headers = { authorization: 'Bearer stored-key' };
  const margin = await app.inject({
    method: 'POST',
    url: '/v1/finance/margin-markup',
    headers,
    payload: { cost: 60, selling_price: 100 }
  });
  const loan = await app.inject({
    method: 'POST',
    url: '/v1/finance/loan-amortization',
    headers,
    payload: { principal: 1000, annual_interest_rate_percent: 12, term_months: 12 }
  });
  const tax = await app.inject({
    method: 'POST',
    url: '/v1/finance/tax-extraction',
    headers,
    payload: { amounts: [{ amount: 120, tax_rate_percent: 20, mode: 'inclusive' }] }
  });
  const freelancer = await app.inject({
    method: 'POST',
    url: '/v1/finance/freelancer-rate',
    headers,
    payload: { target_annual_income: 80000, annual_expenses: 20000, tax_overhead_percent: 25, billable_weeks: 40, billable_hours_per_week: 25 }
  });
  const stats = await app.inject({
    method: 'POST',
    url: '/v1/stats/summary',
    headers,
    payload: { values: [1, 2, 2, 4, 9] }
  });
  const payroll = await app.inject({
    method: 'POST',
    url: '/v1/payroll/decimal-hours',
    headers,
    payload: { hours: 1, minutes: 30, overtime_multiplier: 1.5 }
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  await app.close();

  assert.equal(margin.statusCode, 200);
  assert.equal(margin.json().gross_margin_percent, 40);
  assert.equal(loan.statusCode, 200);
  assert.equal(loan.json().schedule.length, 12);
  assert.equal(tax.statusCode, 200);
  assert.equal(tax.json().totals.tax_amount, 20);
  assert.equal(freelancer.statusCode, 200);
  assert.equal(freelancer.json().hourly_rate, 133.33);
  assert.equal(stats.statusCode, 200);
  assert.equal(stats.json().mean, 3.6);
  assert.equal(payroll.statusCode, 200);
  assert.equal(payroll.json().overtime_decimal_hours, 2.25);
  assert.equal(debits.some(([route, cost]) => route === '/v1/finance/loan-amortization' && cost === 5), true);
  assert.equal(debits.some(([route, cost]) => route === '/v1/stats/summary' && cost === 3), true);
});

test('business calculation routes reject malformed JSON bodies', async () => {
  const keyStore = {
    async findByKey(key) {
      if (key !== 'stored-key') return null;
      return {
        customerId: 'stored_customer',
        planId: 'database',
        rateLimitPerMinute: 120,
        keyFingerprint: 'stored-prefix'
      };
    },
    async checkBillableAccess() {
      return { balance: 100 };
    },
    async recordUsage() {}
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/stats/summary',
    headers: { authorization: 'Bearer stored-key' },
    payload: { values: [] }
  });
  await app.close();

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'invalid_array_length');
});

test('phase 4 finance and phase 5 health routes return calculations and one-credit costs', async () => {
  const debits = [];
  const keyStore = {
    async findByKey() {
      return {
        customerId: 'customer_a',
        planId: 'database',
        rateLimitPerMinute: 240,
        keyFingerprint: 'ct_live_test',
        authenticated: true
      };
    },
    async checkBillableAccess(_customerId, options) {
      return { balance: 1000, required: options.creditCost };
    },
    async debitBillableRequest(_customerId, event) {
      debits.push([event.route, event.creditCost]);
    },
    async recordUsage() {}
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const headers = { 'x-api-key': 'test-key' };
  const requests = [
    ['/v1/finance/simple-interest', { principal: 1000, annual_rate_percent: 5, years: 3 }, 'interest'],
    ['/v1/finance/compound-interest', { principal: 1000, annual_rate_percent: 5, years: 10, compounds_per_year: 12 }, 'future_value'],
    ['/v1/finance/loan-amortization-summary', { principal: 1000, annual_interest_rate_percent: 12, term_months: 12 }, 'total_interest'],
    ['/v1/finance/rule-of-72', { annual_rate_percent: 6 }, 'doubling_time_years'],
    ['/v1/finance/roi', { cost: 1000, net_gain: 250 }, 'roi_percent'],
    ['/v1/finance/discount-calculator', { original_price: 120, discount_percent: 15 }, 'final_price'],
    ['/v1/finance/markup-margin', { margin_percent: 40 }, 'markup_percent'],
    ['/v1/finance/break-even', { fixed_costs: 10000, price_per_unit: 50, variable_cost_per_unit: 30 }, 'break_even_units'],
    ['/v1/finance/salestax', { amount: 120, tax_rate_percent: 20, mode: 'inclusive' }, 'totals'],
    ['/v1/finance/cagr', { beginning_value: 1000, ending_value: 1500, years: 5 }, 'cagr_percent'],
    ['/v1/health/bmi', { unit: 'metric', weight_kg: 70, height_cm: 175 }, 'bmi'],
    ['/v1/health/bmr', { unit: 'metric', weight_kg: 70, height_cm: 175, age: 35, sex: 'male' }, 'bmr_calories_per_day'],
    ['/v1/health/tdee', { unit: 'metric', weight_kg: 70, height_cm: 175, age: 35, sex: 'male', activity_level: 'moderate' }, 'tdee_calories_per_day'],
    ['/v1/health/macro-split', { calories: 2000, protein_percent: 30, carbs_percent: 40, fat_percent: 30 }, 'grams'],
    ['/v1/health/pace-calculator', { distance: 5, unit: 'km', minutes: 25 }, 'pace_per_km']
  ];

  for (const [url, payload, marker] of requests) {
    const response = await app.inject({ method: 'POST', url, headers, payload });
    assert.equal(response.statusCode, 200, url);
    assert.notEqual(response.json()[marker], undefined, url);
  }
  await app.close();

  for (const [url] of requests) {
    assert.equal(debits.some(([route, cost]) => route === url && cost === 1), true, url);
  }
});

test('phase 3 math routes return calculations and one-credit costs', async () => {
  const debits = [];
  const keyStore = {
    async findByKey() {
      return {
        customerId: 'customer_a',
        planId: 'database',
        rateLimitPerMinute: 240,
        keyFingerprint: 'ct_live_test',
        authenticated: true
      };
    },
    async checkBillableAccess(_customerId, options) {
      return { balance: 1000, required: options.creditCost };
    },
    async debitBillableRequest(_customerId, event) {
      debits.push([event.route, event.creditCost]);
    },
    async recordUsage() {}
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const headers = { 'x-api-key': 'test-key' };
  const requests = [
    ['/v1/math/quadratic-solver', { a: 1, b: -3, c: 2 }, 'roots'],
    ['/v1/math/pythagorean-solve', { a: 3, b: 4 }, 'sides'],
    ['/v1/math/triangle-heron', { a: 3, b: 4, c: 5 }, 'angles_degrees'],
    ['/v1/math/circle-geometry', { radius: 10, angle_degrees: 90 }, 'arc_length'],
    ['/v1/math/sphere-geometry', { radius: 3 }, 'volume'],
    ['/v1/math/cylinder-geometry', { radius: 3, height: 10 }, 'volume'],
    ['/v1/math/statistics-summary', { values: [1, 2, 2, 4, 9] }, 'standard_deviation'],
    ['/v1/math/percentage-change', { baseline: 80, current: 100 }, 'percentage_change'],
    ['/v1/math/percent-error', { true_value: 100, measured_value: 96 }, 'percent_error'],
    ['/v1/math/gcd-lcm', { values: [12, 18, 30] }, 'lcm'],
    ['/v1/math/matrix-determinant', { matrix: [[1, 2], [3, 4]] }, 'determinant'],
    ['/v1/math/proportion-solver', { a: 2, b: 5, c: 8 }, 'x'],
    ['/v1/math/logarithm-eval', { value: 1000, base: 10 }, 'logarithm'],
    ['/v1/math/exponent-eval', { base: 27, exponent: 2, root: 3 }, 'root_value'],
    ['/v1/math/combinatorics', { n: 10, r: 3 }, 'combinations']
  ];

  for (const [url, payload, marker] of requests) {
    const response = await app.inject({ method: 'POST', url, headers, payload });
    assert.equal(response.statusCode, 200, url);
    assert.notEqual(response.json()[marker], undefined, url);
  }
  const status = await app.inject('/v1/status');
  await app.close();

  assert.equal(status.json().endpoint_families.some((family) => family.family === 'math' && family.routes.length >= 25), true);
  for (const [url] of requests) {
    assert.equal(debits.some(([route, cost]) => route === url && cost === 1), true, url);
  }
});

test('batch two visible zero-cost developer routes return one-credit calculations', async () => {
  const debits = [];
  const keyStore = {
    async findByKey() {
      return {
        customerId: 'customer_a',
        planId: 'database',
        rateLimitPerMinute: 240,
        keyFingerprint: 'ct_live_test',
        authenticated: true
      };
    },
    async checkBillableAccess(_customerId, options) {
      return { balance: 1000, required: options.creditCost };
    },
    async debitBillableRequest(_customerId, event) {
      debits.push([event.route, event.creditCost]);
    },
    async recordUsage() {}
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const headers = { 'x-api-key': 'test-key' };
  const requests = [
    ['/api/v1/convert/length', { value: 1, from: 'mile', to: 'kilometer' }, 'result'],
    ['/api/v1/convert/temperature', { value: 32, from: 'fahrenheit', to: 'celsius' }, 'result'],
    ['/api/v1/convert/power', { value: 1, from: 'horsepower', to: 'watt' }, 'result'],
    ['/api/v1/convert/data-storage', { value: 1, from: 'gigabyte', to: 'megabyte' }, 'result'],
    ['/api/v1/crypto/hash-sha256', { text: 'abc' }, 'digest_hex'],
    ['/api/v1/crypto/base64-encode', { text: 'calculationtime' }, 'base64'],
    ['/api/v1/crypto/base64-decode', { base64: 'Y2FsY3VsYXRpb250aW1l' }, 'text'],
    ['/api/v1/astronomy/solar-declination', { date: '2026-06-21' }, 'declination_degrees'],
    ['/api/v1/astronomy/daylight-delta', { date: '2026-06-21', lat: 48.137154, lon: 11.576124 }, 'delta_minutes'],
    ['/api/v1/math/ohm-law', { voltage: 12, resistance: 4 }, 'values'],
    ['/api/v1/math/cone-geometry', { radius: 3, height: 4 }, 'volume']
  ];

  for (const [url, payload, marker] of requests) {
    const response = await app.inject({ method: 'POST', url, headers, payload });
    assert.equal(response.statusCode, 200, url);
    assert.notEqual(response.json()[marker], undefined, url);
  }
  await app.close();

  for (const [url] of requests) {
    assert.equal(debits.some(([route, cost]) => route === url && cost === 1), true, url);
  }
});

test('MD5 hash route is removed from the public API surface', async () => {
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_KEYS: 'customer_a:test-key',
      TIME_API_CACHE: 'memory'
    },
    logger: false
  });
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/crypto/hash-md5',
    headers: { 'x-api-key': 'test-key' },
    payload: { text: 'calculationtime' }
  });
  await app.close();

  assert.equal(response.statusCode, 404);
});

test('tradie accounting routes return calculations and weighted credit costs', async () => {
  const debits = [];
  const keyStore = {
    async findByKey(key) {
      if (key !== 'stored-key') return null;
      return {
        customerId: 'stored_customer',
        planId: 'database',
        rateLimitPerMinute: 120,
        keyFingerprint: 'stored-prefix'
      };
    },
    async checkBillableAccess(_customerId, options) {
      return { balance: 100, required_credits: options.creditCost };
    },
    async debitBillableRequest(_customerId, event) {
      debits.push([event.route, event.creditCost]);
      return { balance: 100 - event.creditCost };
    },
    async recordUsage() {}
  };
  const app = await buildServer({
    env: {
      REQUIRE_API_KEY: 'true',
      TIME_API_CACHE: 'memory'
    },
    keyStore,
    logger: false
  });
  const headers = { authorization: 'Bearer stored-key' };
  const job = await app.inject({
    method: 'POST',
    url: '/v1/tradie/job-margin',
    headers,
    payload: { labour_hours: 40, labour_rate: 35, materials_cost: 600, subcontractor_cost: 300, overhead_percent: 10, quoted_price: 3200 }
  });
  const vat = await app.inject({
    method: 'POST',
    url: '/v1/tradie/vat-return-summary',
    headers,
    payload: {
      sales: [{ amount: 1200, tax_rate_percent: 20, mode: 'inclusive' }],
      purchases: [{ amount: 300, tax_rate_percent: 20, mode: 'exclusive' }]
    }
  });
  const cis = await app.inject({
    method: 'POST',
    url: '/v1/tradie/cis-deduction',
    headers,
    payload: { gross_labour: 1000, materials: 200, deduction_rate_percent: 20 }
  });
  const mileage = await app.inject({
    method: 'POST',
    url: '/v1/tradie/mileage-claim',
    headers,
    payload: { miles: 120, rate_per_mile: 0.45, reimbursed_amount: 20 }
  });
  const depreciation = await app.inject({
    method: 'POST',
    url: '/v1/tradie/tool-depreciation',
    headers,
    payload: { purchase_price: 1200, salvage_value: 200, useful_life_years: 5, business_use_percent: 80 }
  });
  const aging = await app.inject({
    method: 'POST',
    url: '/v1/tradie/invoice-aging',
    headers,
    payload: {
      as_of: '2026-09-30',
      invoices: [{ due_date: '2026-09-15', amount: 1000, paid_amount: 200 }]
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  await app.close();

  assert.equal(job.statusCode, 200);
  assert.equal(job.json().gross_profit, 670);
  assert.equal(vat.statusCode, 200);
  assert.equal(vat.json().vat.net_vat_due, 140);
  assert.equal(cis.statusCode, 200);
  assert.equal(cis.json().cis_deduction, 160);
  assert.equal(mileage.statusCode, 200);
  assert.equal(mileage.json().claim_amount, 54);
  assert.equal(depreciation.statusCode, 200);
  assert.equal(depreciation.json().annual_depreciation, 160);
  assert.equal(aging.statusCode, 200);
  assert.equal(aging.json().buckets['1_30'], 800);
  assert.equal(debits.some(([route, cost]) => route === '/v1/tradie/vat-return-summary' && cost === 3), true);
  assert.equal(debits.some(([route, cost]) => route === '/v1/tradie/tool-depreciation' && cost === 3), true);
});
