const HEAVY_ROUTE_EVENTS = new Map([
  ['/v1/finance/loan-amortization', 'calculation.heavy.loan_amortization.completed'],
  ['/v1/finance/tax-extraction', 'calculation.heavy.tax_extraction.completed'],
  ['/v1/stats/summary', 'calculation.heavy.stats_summary.completed'],
  ['/v1/tradie/vat-return-summary', 'calculation.heavy.tradie_vat_return_summary.completed'],
  ['/v1/tradie/tool-depreciation', 'calculation.heavy.tradie_tool_depreciation.completed'],
  ['/v1/tradie/invoice-aging', 'calculation.heavy.tradie_invoice_aging.completed']
]);

export function isWebhookEligibleRoute(route) {
  return HEAVY_ROUTE_EVENTS.has(route);
}

export async function dispatchWebhookEvent({ request, reply, usageEvent }) {
  const customerId = request.customer?.customerId;
  const route = usageEvent.route;
  if (!customerId || !isWebhookEligibleRoute(route)) return;
  if (!request.server.keyStore?.listWebhookDestinations) return;

  const destinations = await request.server.keyStore.listWebhookDestinations(customerId, {
    eventType: 'calculation.heavy.completed',
    route
  });
  if (!Array.isArray(destinations) || destinations.length === 0) return;

  const payload = {
    event_id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    event_type: HEAVY_ROUTE_EVENTS.get(route),
    event_group: 'calculation.heavy.completed',
    service: 'time-coordinate-api',
    api_version: 'v1',
    occurred_at: new Date().toISOString(),
    customer_id: customerId,
    route,
    method: usageEvent.method,
    status_code: reply.statusCode,
    duration_ms: usageEvent.durationMs,
    credit_cost: usageEvent.creditCost
  };

  await Promise.allSettled(destinations.map((destination) => sendWebhook(destination, payload)));
}

async function sendWebhook(destination, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), destination.timeout_ms || 2500);
  try {
    const headers = {
      'content-type': 'application/json',
      'user-agent': 'CalculationTime-API-Webhooks/0.1',
      'x-calculationtime-event': payload.event_type,
      'x-calculationtime-customer': payload.customer_id
    };
    if (destination.signing_secret_hint) {
      headers['x-calculationtime-signature-version'] = 'unsigned-development-preview';
    }
    const response = await fetch(destination.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    return {
      ok: response.ok,
      status: response.status
    };
  } finally {
    clearTimeout(timeout);
  }
}

