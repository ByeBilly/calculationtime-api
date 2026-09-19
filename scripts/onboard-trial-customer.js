#!/usr/bin/env node
import { randomBytes, createHash } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

const args = parseArgs(process.argv.slice(2));
const customerSlug = required(args.customer, '--customer');
const displayName = args.name || customerSlug;
const rateLimitPerMinute = positiveInteger(args['rate-limit'], 120, '--rate-limit');
const trialDays = positiveInteger(args['trial-days'] ?? legacyTrialDays(args['trial-months']), 365, '--trial-days');
const trialCredits = positiveInteger(args.credits, 1_000_000, '--credits');
const reference = args.reference || `trial-${trialDays}-days`;
const databaseUrl = process.env.TIME_API_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('TIME_API_DATABASE_URL or DATABASE_URL must be set.');
  process.exit(1);
}

const now = new Date();
const trialEndsAt = addUtcDays(now, trialDays);
const apiKey = args.key || generateApiKey();
const keyHash = hashApiKey(apiKey);
const keyPrefix = apiKey.slice(0, 12);
const pool = new Pool({ connectionString: databaseUrl, max: 1 });

try {
  await pool.query('begin');
  const customer = await upsertCustomer({
    slug: customerSlug,
    displayName,
    rateLimitPerMinute
  });

  await pool.query(
    `
      update calculationtime_api.api_keys
      set status = 'rotated'
      where customer_id = $1 and status = 'active'
    `,
    [customer.id]
  );

  await pool.query(
    `
      insert into calculationtime_api.api_keys
        (customer_id, key_prefix, key_hash, status)
      values ($1, $2, $3, 'active')
    `,
    [customer.id, keyPrefix, keyHash]
  );

  await pool.query(
    `
      insert into calculationtime_api.credit_ledger
        (customer_id, delta, reason, reference, metadata, created_by)
      values ($1, $2, $3, $4, $5::jsonb, 'trial_onboarding')
    `,
    [
      customer.id,
      trialCredits,
      `${trialDays}_day_free_access`,
      reference,
      JSON.stringify({
        trial_days: trialDays,
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEndsAt.toISOString()
      })
    ]
  );

  await pool.query('commit');
  console.log(JSON.stringify({
    customer: customerSlug,
    display_name: displayName,
    rate_limit_per_minute: rateLimitPerMinute,
    trial_days: trialDays,
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEndsAt.toISOString(),
    granted_credits: trialCredits,
    key_prefix: keyPrefix,
    api_key: apiKey,
    warning: 'Store api_key now. It is shown once and only its hash is saved in the database.'
  }, null, 2));
} catch (error) {
  await pool.query('rollback').catch(() => {});
  console.error(`Trial onboarding failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}

async function upsertCustomer({ slug, displayName, rateLimitPerMinute }) {
  const result = await pool.query(
    `
      insert into calculationtime_api.customers
        (slug, display_name, status, rate_limit_per_minute)
      values ($1, $2, 'active', $3)
      on conflict (slug) do update
      set
        display_name = excluded.display_name,
        status = 'active',
        rate_limit_per_minute = excluded.rate_limit_per_minute,
        updated_at = now()
      returning id
    `,
    [slug, displayName, rateLimitPerMinute]
  );
  return result.rows[0];
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

function required(value, label) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  console.error(`${label} is required.`);
  usage(1);
}

function positiveInteger(value, fallback, label) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  console.error(`${label} must be a positive integer.`);
  usage(1);
}

function legacyTrialDays(months) {
  if (months === undefined) return undefined;
  return Number(months) * 30;
}

function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function generateApiKey() {
  return `ct_live_${randomBytes(32).toString('base64url')}`;
}

function hashApiKey(apiKey) {
  return createHash('sha256').update(String(apiKey)).digest('hex');
}

function usage(code) {
  console.error(`
Usage:
  node scripts/onboard-trial-customer.js --customer <slug> --name <display-name> [--rate-limit 120] [--trial-days 365] [--credits 1000000] [--reference source-note]

Environment:
  TIME_API_DATABASE_URL must point at the CalculationTime API database.
`);
  process.exit(code);
}
