import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decimalHours,
  freelancerRate,
  loanAmortization,
  marginMarkup,
  statsSummary,
  taxExtraction,
  tradieCisDeduction,
  tradieInvoiceAging,
  tradieJobMargin,
  tradieMileageClaim,
  tradieToolDepreciation,
  tradieVatReturnSummary
} from '../src/business-service.js';

test('calculates gross margin and markup', () => {
  const result = marginMarkup({ cost: 60, selling_price: 100, actual_cost: 66 });
  assert.equal(result.gross_profit, 40);
  assert.equal(result.gross_margin_percent, 40);
  assert.equal(result.markup_percent, 66.6667);
  assert.equal(result.cost_variance.variance_amount, 6);
});

test('generates fixed-rate monthly amortization schedule', () => {
  const result = loanAmortization({ principal: 1000, annual_interest_rate_percent: 12, term_months: 12 });
  assert.equal(result.periods, 12);
  assert.equal(result.schedule.length, 12);
  assert.equal(result.schedule.at(-1).remaining_balance, 0);
  assert.ok(result.total_interest > 60);
});

test('extracts inclusive and exclusive tax lines', () => {
  const result = taxExtraction({
    amounts: [
      { label: 'exclusive', amount: 100, tax_rate_percent: 20, mode: 'exclusive' },
      { label: 'inclusive', amount: 120, tax_rate_percent: 20, mode: 'inclusive' }
    ]
  });
  assert.equal(result.totals.net_amount, 200);
  assert.equal(result.totals.tax_amount, 40);
  assert.equal(result.totals.gross_amount, 240);
});

test('calculates freelancer hourly and daily rates', () => {
  const result = freelancerRate({
    target_annual_income: 80000,
    annual_expenses: 20000,
    tax_overhead_percent: 25,
    billable_weeks: 40,
    billable_hours_per_week: 25
  });
  assert.equal(result.required_revenue, 133333.33);
  assert.equal(result.hourly_rate, 133.33);
});

test('summarizes numeric datasets', () => {
  const result = statsSummary({ values: [1, 2, 2, 4, 9] });
  assert.equal(result.mean, 3.6);
  assert.equal(result.median, 2);
  assert.deepEqual(result.mode, [2]);
  assert.equal(result.quartiles.q1, 2);
  assert.equal(result.quartiles.q3, 4);
});

test('converts clock parts to decimal hours and back', () => {
  const forward = decimalHours({ hours: 1, minutes: 30, seconds: 0, overtime_multiplier: 1.5 });
  assert.equal(forward.decimal_hours, 1.5);
  assert.equal(forward.overtime_decimal_hours, 2.25);

  const reverse = decimalHours({ decimal_hours: 2.75 });
  assert.equal(reverse.hours, 2);
  assert.equal(reverse.minutes, 45);
  assert.equal(reverse.seconds, 0);
});

test('rejects malformed payloads with clean errors', () => {
  assert.throws(
    () => statsSummary({ values: [] }),
    (error) => error.statusCode === 400 && error.code === 'invalid_array_length'
  );
});

test('calculates tradie job margin from quote inputs', () => {
  const result = tradieJobMargin({
    labour_hours: 40,
    labour_rate: 35,
    materials_cost: 600,
    subcontractor_cost: 300,
    overhead_percent: 10,
    quoted_price: 3200
  });
  assert.equal(result.total_cost, 2530);
  assert.equal(result.gross_profit, 670);
  assert.equal(result.gross_margin_percent, 20.9375);
});

test('summarizes VAT return input and output tax', () => {
  const result = tradieVatReturnSummary({
    sales: [{ amount: 1200, tax_rate_percent: 20, mode: 'inclusive' }],
    purchases: [{ amount: 300, tax_rate_percent: 20, mode: 'exclusive' }]
  });
  assert.equal(result.sales.vat_amount, 200);
  assert.equal(result.purchases.vat_amount, 60);
  assert.equal(result.vat.net_vat_due, 140);
});

test('calculates CIS deduction model', () => {
  const result = tradieCisDeduction({ gross_labour: 1000, materials: 200, deduction_rate_percent: 20 });
  assert.equal(result.cis_taxable_labour, 800);
  assert.equal(result.cis_deduction, 160);
  assert.equal(result.net_payment, 840);
});

test('calculates mileage claim and unreimbursed balance', () => {
  const result = tradieMileageClaim({ miles: 120, rate_per_mile: 0.45, reimbursed_amount: 20 });
  assert.equal(result.claim_amount, 54);
  assert.equal(result.unreimbursed_amount, 34);
});

test('generates straight-line tool depreciation schedule', () => {
  const result = tradieToolDepreciation({
    purchase_price: 1200,
    salvage_value: 200,
    useful_life_years: 5,
    business_use_percent: 80
  });
  assert.equal(result.depreciable_amount, 800);
  assert.equal(result.annual_depreciation, 160);
  assert.equal(result.schedule.length, 5);
});

test('ages tradie invoices into overdue buckets', () => {
  const result = tradieInvoiceAging({
    as_of: '2026-09-30',
    invoices: [
      { invoice_id: 'INV-1', customer: 'Painter A', due_date: '2026-09-15', amount: 1000, paid_amount: 200 },
      { invoice_id: 'INV-2', customer: 'Builder B', due_date: '2026-06-01', amount: 500, paid_amount: 0 }
    ]
  });
  assert.equal(result.totals.outstanding_amount, 1300);
  assert.equal(result.totals.overdue_amount, 1300);
  assert.equal(result.buckets['1_30'], 800);
  assert.equal(result.buckets['90_plus'], 500);
});
