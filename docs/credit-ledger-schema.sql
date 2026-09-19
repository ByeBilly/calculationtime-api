create schema if not exists calculationtime_api;

create table if not exists calculationtime_api.credit_ledger (
  id bigserial primary key,
  customer_id uuid not null references calculationtime_api.customers(id) on delete cascade,
  delta integer not null,
  reason text not null,
  reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text not null default current_user
);

create index if not exists credit_ledger_customer_created_idx
  on calculationtime_api.credit_ledger (customer_id, created_at desc);

comment on table calculationtime_api.credit_ledger is
  'Append-only credit grants, adjustments, and future debits for CalculationTime API customers.';

comment on column calculationtime_api.credit_ledger.delta is
  'Positive values grant credits. Negative values debit or reverse credits.';

create table if not exists calculationtime_api.customer_webhooks (
  id bigserial primary key,
  customer_id uuid not null references calculationtime_api.customers(id) on delete cascade,
  event_type text not null,
  destination_url text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_webhooks_event_unique unique (customer_id, event_type),
  constraint customer_webhooks_status_check check (status in ('active', 'paused')),
  constraint customer_webhooks_event_check check (event_type in ('calculation.heavy.completed')),
  constraint customer_webhooks_https_check check (destination_url ~ '^https://')
);

create index if not exists customer_webhooks_active_idx
  on calculationtime_api.customer_webhooks (customer_id, event_type)
  where status = 'active';

comment on table calculationtime_api.customer_webhooks is
  'Optional outbound webhook destinations for tenant calculation events.';
