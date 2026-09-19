#!/usr/bin/env node
import pg from 'pg';

const { Pool } = pg;

const args = parseArgs(process.argv.slice(2));
const format = args.format || 'markdown';
const databaseUrl = process.env.TIME_API_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('TIME_API_DATABASE_URL or DATABASE_URL must be set.');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });

try {
  const result = await pool.query(
    `
      select
        c.slug,
        c.display_name,
        c.status,
        c.rate_limit_per_minute,
        coalesce(k.active_api_keys, 0)::int as active_api_keys,
        coalesce(u.requests_this_month, 0)::int as requests_this_month,
        coalesce(u.successful_requests_this_month, 0)::int as successful_requests_this_month,
        coalesce(u.error_requests_this_month, 0)::int as error_requests_this_month,
        u.last_request_at,
        coalesce(cl.credit_balance, 0)::int as credit_balance,
        cl.trial_ends_at,
        c.created_at,
        c.updated_at
      from calculationtime_api.customers c
      left join lateral (
        select count(*)::int as active_api_keys
        from calculationtime_api.api_keys
        where customer_id = c.id and status = 'active'
      ) k on true
      left join lateral (
        select
          count(*) filter (where created_at >= date_trunc('month', now()))::int as requests_this_month,
          count(*) filter (where created_at >= date_trunc('month', now()) and status_code >= 200 and status_code < 400)::int as successful_requests_this_month,
          count(*) filter (where created_at >= date_trunc('month', now()) and status_code >= 400)::int as error_requests_this_month,
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
      order by c.status asc, cl.trial_ends_at nulls last, c.slug asc
    `
  );

  const customers = result.rows.map((row) => ({
    customer_id: row.slug,
    display_name: row.display_name,
    status: row.status,
    rate_limit_per_minute: row.rate_limit_per_minute,
    active_api_keys: Number(row.active_api_keys || 0),
    requests_this_month: Number(row.requests_this_month || 0),
    successful_requests_this_month: Number(row.successful_requests_this_month || 0),
    error_requests_this_month: Number(row.error_requests_this_month || 0),
    credit_balance: Number(row.credit_balance || 0),
    trial_ends_at: iso(row.trial_ends_at),
    last_request_at: iso(row.last_request_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at)
  }));

  if (format === 'json') {
    console.log(JSON.stringify({ generated_at: new Date().toISOString(), count: customers.length, customers }, null, 2));
  } else if (format === 'csv') {
    printCsv(customers);
  } else {
    printMarkdown(customers);
  }
} catch (error) {
  console.error(`Customer summary export failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}

function printMarkdown(customers) {
  console.log(`# CalculationTime API Customer Summary`);
  console.log();
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Customers: ${customers.length}`);
  console.log();
  console.log('| Customer | Status | Active Keys | Rate/min | Credits | Trial Ends | Requests This Month | Last Request |');
  console.log('|---|---:|---:|---:|---:|---|---:|---|');
  for (const customer of customers) {
    console.log([
      customer.customer_id,
      customer.status,
      customer.active_api_keys,
      customer.rate_limit_per_minute,
      customer.credit_balance,
      customer.trial_ends_at || '',
      customer.requests_this_month,
      customer.last_request_at || ''
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
}

function printCsv(customers) {
  const headers = [
    'customer_id',
    'display_name',
    'status',
    'active_api_keys',
    'rate_limit_per_minute',
    'credit_balance',
    'trial_ends_at',
    'requests_this_month',
    'successful_requests_this_month',
    'error_requests_this_month',
    'last_request_at'
  ];
  console.log(headers.join(','));
  for (const customer of customers) {
    console.log(headers.map((header) => csv(customer[header])).join(','));
  }
}

function csv(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}
