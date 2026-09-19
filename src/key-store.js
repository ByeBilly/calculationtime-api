import { createHash } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

export function createKeyStore(env = process.env) {
  const connectionString = env.TIME_API_DATABASE_URL || env.DATABASE_URL || '';
  if (!connectionString) return null;

  const pool = new Pool({
    connectionString,
    max: Number(env.TIME_API_DB_POOL_MAX || 4),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000
  });

  return {
    async findByKey(apiKey) {
      const keyHash = hashApiKey(apiKey);
      const result = await pool.query(
        `
          select
            k.id as key_id,
            k.key_prefix,
            c.slug as customer_id,
            c.rate_limit_per_minute,
            c.status as customer_status,
            k.status as key_status
          from calculationtime_api.api_keys k
          join calculationtime_api.customers c on c.id = k.customer_id
          where k.key_hash = $1
          limit 1
        `,
        [keyHash]
      );

      const row = result.rows[0];
      if (!row || row.key_status !== 'active') return null;
      if (row.customer_status !== 'active') {
        throw Object.assign(new Error('Customer account is not active'), {
          statusCode: 403,
          code: 'account_suspended'
        });
      }

      await pool.query(
        'update calculationtime_api.api_keys set last_used_at = now() where id = $1',
        [row.key_id]
      );

      return {
        customerId: row.customer_id,
        planId: 'database',
        rateLimitPerMinute: row.rate_limit_per_minute,
        keyFingerprint: row.key_prefix
      };
    },
    async recordUsage(event) {
      await pool.query(
        `
          insert into calculationtime_api.usage_events
            (customer_id, route, method, status_code, duration_ms)
          select c.id, $2, $3, $4, $5
          from calculationtime_api.customers c
          where c.slug = $1
        `,
        [
          event.customerId,
          event.route,
          event.method,
          event.statusCode,
          event.durationMs
        ]
      );
    },
    async checkBillableAccess(customerSlug, options = {}) {
      const creditCost = creditCostFromOptions(options);
      const customer = await findCustomer(pool, customerSlug);
      if (!customer) return null;
      if (customer.status !== 'active') {
        throw Object.assign(new Error('Customer account is not active'), {
          statusCode: 403,
          code: 'account_suspended'
        });
      }
      await assertCreditLedgerExists(pool);

      const account = await commercialAccountState(pool, customer.id);
      if (account.trial_ends_at && account.trial_ends_at.getTime() <= Date.now()) {
        throw Object.assign(new Error('Customer trial has expired'), {
          statusCode: 403,
          code: 'trial_expired',
          trial_ends_at: account.trial_ends_at.toISOString()
        });
      }
      if (account.balance < creditCost) {
        throw Object.assign(new Error('API credit balance is exhausted'), {
          statusCode: 402,
          code: 'credits_exhausted',
          balance: account.balance,
          required_credits: creditCost
        });
      }

      return {
        customer_id: customer.slug,
        balance: account.balance,
        trial_ends_at: account.trial_ends_at ? account.trial_ends_at.toISOString() : null
      };
    },
    async debitBillableRequest(customerSlug, event = {}) {
      const creditCost = creditCostFromOptions(event);
      const customer = await findCustomer(pool, customerSlug);
      if (!customer) return null;
      await assertCreditLedgerExists(pool);

      const client = await pool.connect();
      try {
        await client.query('begin');
        const state = await commercialAccountState(client, customer.id, true);
        if (state.balance < creditCost) {
          throw Object.assign(new Error('API credit balance is exhausted'), {
            statusCode: 402,
            code: 'credits_exhausted',
            balance: state.balance,
            required_credits: creditCost
          });
        }
        const result = await client.query(
          `
            insert into calculationtime_api.credit_ledger
              (customer_id, delta, reason, reference, metadata, created_by)
            values ($1, $2, 'billable_request', $3, $4::jsonb, 'api_meter')
            returning id, delta, reason, reference, metadata, created_at, created_by
          `,
          [
            customer.id,
            -creditCost,
            `${event.method || 'GET'} ${event.route || 'unknown'}`,
            JSON.stringify({
              route: event.route || null,
              method: event.method || null,
              status_code: event.statusCode || null,
              duration_ms: event.durationMs || null,
              credit_cost: creditCost
            })
          ]
        );
        await client.query('commit');
        return {
          customer_id: customer.slug,
          balance: state.balance - creditCost,
          unit: 'api_credit',
          event: formatCreditEvent(result.rows[0])
        };
      } catch (error) {
        await client.query('rollback').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    async getAccountProfile(customerSlug) {
      const customer = await findCustomer(pool, customerSlug);
      if (!customer) return null;

      const ledgerExists = await creditLedgerExists(pool);
      return {
        customer_id: customer.slug,
        display_name: customer.display_name,
        status: customer.status,
        authentication: {
          plan_id: 'database'
        },
        plan: {
          rate_limit_per_minute: customer.rate_limit_per_minute
        },
        capabilities: {
          account_database: true,
          credit_ledger: ledgerExists,
          usage_breakdown: true
        }
      };
    },
    async getAccountUsage(customerSlug) {
      const customer = await findCustomer(pool, customerSlug);
      if (!customer) return null;

      const summaryResult = await pool.query(
        `
          select
            count(*)::int as requests_this_month,
            count(*) filter (where status_code >= 200 and status_code < 400)::int as successful_requests_this_month,
            count(*) filter (where status_code >= 400)::int as error_requests_this_month,
            min(created_at) as first_request_at,
            max(created_at) as last_request_at
          from calculationtime_api.usage_events
          where customer_id = $1
            and created_at >= date_trunc('month', now())
        `,
        [customer.id]
      );
      const routeResult = await pool.query(
        `
          select
            route,
            method,
            count(*)::int as requests,
            count(*) filter (where status_code >= 400)::int as errors,
            round(avg(duration_ms))::int as average_duration_ms
          from calculationtime_api.usage_events
          where customer_id = $1
            and created_at >= date_trunc('month', now())
          group by route, method
          order by requests desc, route asc
          limit 20
        `,
        [customer.id]
      );
      const summary = summaryResult.rows[0] || {};

      return {
        customer_id: customer.slug,
        display_name: customer.display_name,
        status: customer.status,
        usage: {
          configured: true,
          window: 'current_month',
          requests_this_month: summary.requests_this_month || 0,
          successful_requests_this_month: summary.successful_requests_this_month || 0,
          error_requests_this_month: summary.error_requests_this_month || 0,
          first_request_at: summary.first_request_at ? new Date(summary.first_request_at).toISOString() : null,
          last_request_at: summary.last_request_at ? new Date(summary.last_request_at).toISOString() : null,
          by_route: routeResult.rows.map((row) => ({
            route: row.route,
            method: row.method,
            requests: row.requests,
            errors: row.errors,
            average_duration_ms: row.average_duration_ms
          }))
        }
      };
    },
    async getAccountLimits(customerSlug) {
      const customer = await findCustomer(pool, customerSlug);
      if (!customer) return null;

      return {
        customer_id: customer.slug,
        display_name: customer.display_name,
        status: customer.status,
        limits: {
          configured: true,
          rate_limit_per_minute: customer.rate_limit_per_minute,
          batch_limits: {
            time_batch_points: 100,
            date_difference_ranges: 100,
            geo_distance_pairs: 100
          }
        }
      };
    },
    async getAccountCredits(customerSlug) {
      const customer = await findCustomer(pool, customerSlug);
      if (!customer) return null;

      const usageResult = await pool.query(
        `
          select count(*)::int as requests_this_month
          from calculationtime_api.usage_events
          where customer_id = $1
            and created_at >= date_trunc('month', now())
        `,
        [customer.id]
      );
      if (!(await creditLedgerExists(pool))) {
        return {
          customer_id: customer.slug,
          display_name: customer.display_name,
          status: customer.status,
          plan: {
            rate_limit_per_minute: customer.rate_limit_per_minute
          },
          usage: {
            requests_this_month: usageResult.rows[0]?.requests_this_month || 0
          },
          credits: {
            configured: false,
            balance: null,
            unit: 'api_credit',
            note: 'Credit ledger table is not configured for this API database yet.'
          }
        };
      }

      const creditsResult = await pool.query(
        `
          select
            coalesce(sum(delta), 0)::int as balance,
            max(created_at) as last_credit_event_at
          from calculationtime_api.credit_ledger
          where customer_id = $1
        `,
        [customer.id]
      );
      const credits = creditsResult.rows[0] || {};

      return {
        customer_id: customer.slug,
        display_name: customer.display_name,
        status: customer.status,
        plan: {
          rate_limit_per_minute: customer.rate_limit_per_minute
        },
        usage: {
          requests_this_month: usageResult.rows[0]?.requests_this_month || 0
        },
        credits: {
          configured: true,
          balance: Number(credits.balance || 0),
          unit: 'api_credit',
          last_credit_event_at: credits.last_credit_event_at
            ? new Date(credits.last_credit_event_at).toISOString()
            : null
        }
      };
    },
    async createOrUpdateCustomer({ slug, displayName, rateLimitPerMinute, status = 'active' }) {
      validateCustomerSlug(slug);
      validatePositiveInteger(rateLimitPerMinute, 'rate_limit_per_minute');
      const normalizedStatus = validateStatus(status);
      const result = await pool.query(
        `
          insert into calculationtime_api.customers
            (slug, display_name, status, rate_limit_per_minute)
          values ($1, $2, $3, $4)
          on conflict (slug) do update
          set
            display_name = excluded.display_name,
            status = excluded.status,
            rate_limit_per_minute = excluded.rate_limit_per_minute,
            updated_at = now()
          returning slug, display_name, status, rate_limit_per_minute, created_at, updated_at
        `,
        [slug, displayName || slug, normalizedStatus, rateLimitPerMinute]
      );
      return formatCustomer(result.rows[0]);
    },
    async grantCredits(customerSlug, { delta, reason, reference = null, metadata = {}, createdBy = 'api_admin' }) {
      validatePositiveInteger(Math.abs(Number(delta)), 'delta');
      const parsedDelta = Number(delta);
      if (!Number.isInteger(parsedDelta) || parsedDelta === 0) {
        throw Object.assign(new Error('delta must be a non-zero integer'), {
          statusCode: 400,
          code: 'invalid_credit_delta'
        });
      }
      if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
        throw Object.assign(new Error('reason must be a descriptive string'), {
          statusCode: 400,
          code: 'invalid_credit_reason'
        });
      }

      const customer = await findCustomer(pool, customerSlug);
      if (!customer) return null;
      await assertCreditLedgerExists(pool);

      const result = await pool.query(
        `
          insert into calculationtime_api.credit_ledger
            (customer_id, delta, reason, reference, metadata, created_by)
          values ($1, $2, $3, $4, $5::jsonb, $6)
          returning id, delta, reason, reference, metadata, created_at, created_by
        `,
        [
          customer.id,
          parsedDelta,
          reason.trim(),
          reference || null,
          JSON.stringify(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}),
          createdBy
        ]
      );
      const balance = await creditBalance(pool, customer.id);
      return {
        customer_id: customer.slug,
        display_name: customer.display_name,
        balance,
        unit: 'api_credit',
        event: formatCreditEvent(result.rows[0])
      };
    },
    async listCreditLedger(customerSlug, { limit = 25 } = {}) {
      const customer = await findCustomer(pool, customerSlug);
      if (!customer) return null;
      await assertCreditLedgerExists(pool);

      const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 25, 1), 100);
      const result = await pool.query(
        `
          select id, delta, reason, reference, metadata, created_at, created_by
          from calculationtime_api.credit_ledger
          where customer_id = $1
          order by created_at desc, id desc
          limit $2
        `,
        [customer.id, safeLimit]
      );
      const balance = await creditBalance(pool, customer.id);
      return {
        customer_id: customer.slug,
        display_name: customer.display_name,
        balance,
        unit: 'api_credit',
        events: result.rows.map(formatCreditEvent)
      };
    },
    async listCustomerWebhooks(customerSlug) {
      const customer = await findCustomer(pool, customerSlug);
      if (!customer) return null;
      await assertWebhookTableExists(pool);

      const result = await pool.query(
        `
          select id, event_type, destination_url, status, created_at, updated_at
          from calculationtime_api.customer_webhooks
          where customer_id = $1
          order by created_at desc, id desc
        `,
        [customer.id]
      );
      return {
        customer_id: customer.slug,
        display_name: customer.display_name,
        webhooks: result.rows.map(formatWebhook)
      };
    },
    async upsertCustomerWebhook(customerSlug, input = {}) {
      const customer = await findCustomer(pool, customerSlug);
      if (!customer) return null;
      await assertWebhookTableExists(pool);

      const eventType = validateWebhookEventType(input.event_type || 'calculation.heavy.completed');
      const destinationUrl = validateWebhookUrl(input.destination_url || input.url);
      const status = validateWebhookStatus(input.status || 'active');
      const result = await pool.query(
        `
          insert into calculationtime_api.customer_webhooks
            (customer_id, event_type, destination_url, status)
          values ($1, $2, $3, $4)
          on conflict (customer_id, event_type) do update
          set destination_url = excluded.destination_url,
              status = excluded.status,
              updated_at = now()
          returning id, event_type, destination_url, status, created_at, updated_at
        `,
        [customer.id, eventType, destinationUrl, status]
      );
      return {
        customer_id: customer.slug,
        display_name: customer.display_name,
        webhook: formatWebhook(result.rows[0])
      };
    },
    async listWebhookDestinations(customerSlug, { eventType = 'calculation.heavy.completed' } = {}) {
      const customer = await findCustomer(pool, customerSlug);
      if (!customer || !(await webhookTableExists(pool))) return [];

      const result = await pool.query(
        `
          select event_type, destination_url
          from calculationtime_api.customer_webhooks
          where customer_id = $1
            and status = 'active'
            and event_type = $2
        `,
        [customer.id, eventType]
      );
      return result.rows.map((row) => ({
        event_type: row.event_type,
        url: row.destination_url,
        timeout_ms: 2500
      }));
    },
    async listCustomers({ limit = 100, includeInactive = false } = {}) {
      const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 500);
      const result = await pool.query(
        `
          select
            c.slug,
            c.display_name,
            c.status,
            c.rate_limit_per_minute,
            c.created_at,
            c.updated_at,
            coalesce(k.active_api_keys, 0)::int as active_api_keys,
            coalesce(u.requests_this_month, 0)::int as requests_this_month,
            coalesce(cl.credit_balance, 0)::int as credit_balance,
            cl.trial_ends_at,
            u.last_request_at
          from calculationtime_api.customers c
          left join lateral (
            select count(*)::int as active_api_keys
            from calculationtime_api.api_keys
            where customer_id = c.id and status = 'active'
          ) k on true
          left join lateral (
            select
              count(*) filter (where created_at >= date_trunc('month', now()))::int as requests_this_month,
              max(created_at) as last_request_at
            from calculationtime_api.usage_events
            where customer_id = c.id
          ) u on true
          left join lateral (
            select
              coalesce(sum(delta), 0)::int as credit_balance,
              max((metadata->>'trial_ends_at')::timestamptz) filter (where metadata ? 'trial_ends_at') as trial_ends_at
            from calculationtime_api.credit_ledger
            where customer_id = c.id
          ) cl on true
          where ($1::boolean or c.status = 'active')
          order by c.created_at desc
          limit $2
        `,
        [Boolean(includeInactive), safeLimit]
      );
      return {
        count: result.rows.length,
        customers: result.rows.map(formatCustomerSummary)
      };
    },
    async getCustomerDetail(customerSlug) {
      const customer = await findCustomer(pool, customerSlug);
      if (!customer) return null;
      const [usage, credits, keys] = await Promise.all([
        this.getAccountUsage(customerSlug),
        this.getAccountCredits(customerSlug),
        pool.query(
          `
            select key_prefix, status, created_at, last_used_at
            from calculationtime_api.api_keys
            where customer_id = $1
            order by created_at desc
            limit 20
          `,
          [customer.id]
        )
      ]);
      const state = await commercialAccountState(pool, customer.id);
      return {
        ...formatCustomer(customer),
        trial_ends_at: state.trial_ends_at ? state.trial_ends_at.toISOString() : null,
        credit_balance: state.balance,
        usage: usage?.usage || null,
        credits: credits?.credits || null,
        api_keys: keys.rows.map((row) => ({
          key_prefix: row.key_prefix,
          status: row.status,
          created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
          last_used_at: row.last_used_at ? new Date(row.last_used_at).toISOString() : null
        }))
      };
    },
    async close() {
      await pool.end();
    }
  };
}

export function hashApiKey(apiKey) {
  return createHash('sha256').update(String(apiKey)).digest('hex');
}

async function findCustomer(pool, customerSlug) {
  const customerResult = await pool.query(
    `
      select
        id,
        slug,
        display_name,
        status,
        rate_limit_per_minute
      from calculationtime_api.customers
      where slug = $1
      limit 1
    `,
    [customerSlug]
  );
  return customerResult.rows[0] || null;
}

async function creditLedgerExists(pool) {
  const result = await pool.query(
    "select to_regclass('calculationtime_api.credit_ledger') as table_name"
  );
  return Boolean(result.rows[0]?.table_name);
}

async function assertCreditLedgerExists(pool) {
  if (await creditLedgerExists(pool)) return;
  throw Object.assign(new Error('Credit ledger table is not configured for this API database yet'), {
    statusCode: 503,
    code: 'credit_ledger_unavailable'
  });
}

async function webhookTableExists(pool) {
  const result = await pool.query(
    "select to_regclass('calculationtime_api.customer_webhooks') as table_name"
  );
  return Boolean(result.rows[0]?.table_name);
}

async function assertWebhookTableExists(pool) {
  if (await webhookTableExists(pool)) return;
  throw Object.assign(new Error('Customer webhook table is not configured for this API database yet'), {
    statusCode: 503,
    code: 'webhook_table_unavailable'
  });
}

async function creditBalance(pool, customerId) {
  const result = await pool.query(
    'select coalesce(sum(delta), 0)::int as balance from calculationtime_api.credit_ledger where customer_id = $1',
    [customerId]
  );
  return Number(result.rows[0]?.balance || 0);
}

async function commercialAccountState(pool, customerId, lock = false) {
  if (lock) {
    await pool.query(
      'select id from calculationtime_api.customers where id = $1 for update',
      [customerId]
    );
  }
  const result = await pool.query(
    `
      select
        coalesce(sum(delta), 0)::int as balance,
        max((metadata->>'trial_ends_at')::timestamptz) filter (where metadata ? 'trial_ends_at') as trial_ends_at
      from calculationtime_api.credit_ledger
      where customer_id = $1
    `,
    [customerId]
  );
  const row = result.rows[0] || {};
  return {
    balance: Number(row.balance || 0),
    trial_ends_at: row.trial_ends_at ? new Date(row.trial_ends_at) : null
  };
}

function validateCustomerSlug(slug) {
  if (typeof slug === 'string' && /^[a-z0-9][a-z0-9_-]{1,62}[a-z0-9]$/.test(slug)) return;
  throw Object.assign(new Error('slug must be 3 to 64 lowercase letters, numbers, underscores, or hyphens'), {
    statusCode: 400,
    code: 'invalid_customer_slug'
  });
}

function validatePositiveInteger(value, label) {
  if (Number.isInteger(Number(value)) && Number(value) > 0) return;
  throw Object.assign(new Error(`${label} must be a positive integer`), {
    statusCode: 400,
    code: `invalid_${label}`
  });
}

function creditCostFromOptions(options = {}) {
  const parsed = Number(options.creditCost ?? options.credit_cost ?? 1);
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 1000) return parsed;
  return 1;
}

function validateStatus(status) {
  if (['active', 'paused', 'disabled'].includes(status)) return status;
  throw Object.assign(new Error('status must be active, paused, or disabled'), {
    statusCode: 400,
    code: 'invalid_customer_status'
  });
}

function validateWebhookEventType(eventType) {
  if (eventType === 'calculation.heavy.completed') return eventType;
  throw Object.assign(new Error('event_type must be calculation.heavy.completed'), {
    statusCode: 400,
    code: 'invalid_webhook_event_type'
  });
}

function validateWebhookStatus(status) {
  if (['active', 'paused'].includes(status)) return status;
  throw Object.assign(new Error('status must be active or paused'), {
    statusCode: 400,
    code: 'invalid_webhook_status'
  });
}

function validateWebhookUrl(url) {
  try {
    const parsed = new URL(String(url || ''));
    if (parsed.protocol === 'https:' && parsed.hostname.length > 0) return parsed.toString();
  } catch {
    // Fall through to standardized API error below.
  }
  throw Object.assign(new Error('destination_url must be a valid HTTPS URL'), {
    statusCode: 400,
    code: 'invalid_webhook_url'
  });
}

function formatCustomer(row) {
  return {
    customer_id: row.slug,
    display_name: row.display_name,
    status: row.status,
    rate_limit_per_minute: row.rate_limit_per_minute,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

function formatCustomerSummary(row) {
  return {
    customer_id: row.slug,
    display_name: row.display_name,
    status: row.status,
    rate_limit_per_minute: row.rate_limit_per_minute,
    active_api_keys: Number(row.active_api_keys || 0),
    requests_this_month: Number(row.requests_this_month || 0),
    credit_balance: Number(row.credit_balance || 0),
    trial_ends_at: row.trial_ends_at ? new Date(row.trial_ends_at).toISOString() : null,
    last_request_at: row.last_request_at ? new Date(row.last_request_at).toISOString() : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

function formatWebhook(row) {
  return {
    id: row.id,
    event_type: row.event_type,
    destination_url: row.destination_url,
    status: row.status,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

function formatCreditEvent(row) {
  return {
    id: row.id,
    delta: row.delta,
    reason: row.reason,
    reference: row.reference,
    metadata: row.metadata || {},
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    created_by: row.created_by
  };
}
