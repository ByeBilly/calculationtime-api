const MAX_DATASET_SIZE = 10_000;

export function marginMarkup(input = {}) {
  const cost = money(input.cost, 'cost');
  const sellingPrice = optionalMoney(input.selling_price ?? input.sellingPrice, 'selling_price');
  const targetMarginPercent = optionalPercent(input.target_margin_percent ?? input.targetMarginPercent, 'target_margin_percent');
  const targetMarkupPercent = optionalPercent(input.target_markup_percent ?? input.targetMarkupPercent, 'target_markup_percent');
  const actualCost = optionalMoney(input.actual_cost ?? input.actualCost, 'actual_cost');

  const resolvedSellingPrice = sellingPrice
    ?? (targetMarginPercent !== null ? cost / (1 - targetMarginPercent / 100) : null)
    ?? (targetMarkupPercent !== null ? cost * (1 + targetMarkupPercent / 100) : null);

  if (resolvedSellingPrice === null) {
    throw badRequest('selling_price, target_margin_percent, or target_markup_percent is required', 'missing_selling_price');
  }
  if (resolvedSellingPrice <= 0) throw badRequest('selling_price must be greater than zero', 'invalid_selling_price');

  const grossProfit = resolvedSellingPrice - cost;
  const marginPercent = (grossProfit / resolvedSellingPrice) * 100;
  const markupPercent = (grossProfit / cost) * 100;
  const actualGrossProfit = actualCost === null ? null : resolvedSellingPrice - actualCost;

  return {
    input: {
      cost,
      selling_price: roundMoney(resolvedSellingPrice),
      actual_cost: actualCost
    },
    gross_profit: roundMoney(grossProfit),
    gross_margin_percent: round(marginPercent, 4),
    markup_percent: round(markupPercent, 4),
    cost_variance: actualCost === null ? null : {
      baseline_cost: cost,
      actual_cost: actualCost,
      variance_amount: roundMoney(actualCost - cost),
      variance_percent: round(((actualCost - cost) / cost) * 100, 4),
      actual_gross_profit: roundMoney(actualGrossProfit),
      actual_margin_percent: round((actualGrossProfit / resolvedSellingPrice) * 100, 4)
    },
    method: 'gross_margin_markup_from_cost_and_price'
  };
}

export function loanAmortization(input = {}) {
  const principal = money(input.principal, 'principal');
  const annualRatePercent = percent(input.annual_interest_rate_percent ?? input.annualInterestRatePercent, 'annual_interest_rate_percent', 0, 100);
  const termMonths = integer(input.term_months ?? input.termMonths, 'term_months', 1, 1200);
  const paymentsPerYear = integer(input.payments_per_year ?? input.paymentsPerYear ?? 12, 'payments_per_year', 1, 52);
  const periods = Math.ceil((termMonths / 12) * paymentsPerYear);
  if (periods > 1200) throw badRequest('loan schedule cannot exceed 1200 payment periods', 'schedule_too_large');

  const periodicRate = annualRatePercent / 100 / paymentsPerYear;
  const payment = periodicRate === 0
    ? principal / periods
    : principal * (periodicRate / (1 - (1 + periodicRate) ** -periods));

  let balance = principal;
  let totalInterest = 0;
  const schedule = [];
  for (let period = 1; period <= periods; period += 1) {
    const interest = balance * periodicRate;
    const principalPayment = period === periods ? balance : Math.min(payment - interest, balance);
    const actualPayment = principalPayment + interest;
    balance = Math.max(0, balance - principalPayment);
    totalInterest += interest;
    schedule.push({
      period,
      year: Math.ceil(period / paymentsPerYear),
      payment: roundMoney(actualPayment),
      principal: roundMoney(principalPayment),
      interest: roundMoney(interest),
      remaining_balance: roundMoney(balance)
    });
  }

  const annual = [];
  for (let year = 1; year <= Math.ceil(periods / paymentsPerYear); year += 1) {
    const rows = schedule.filter((row) => row.year === year);
    annual.push({
      year,
      payment: roundMoney(sum(rows, 'payment')),
      principal: roundMoney(sum(rows, 'principal')),
      interest: roundMoney(sum(rows, 'interest')),
      ending_balance: rows.at(-1)?.remaining_balance ?? 0
    });
  }

  return {
    input: {
      principal,
      annual_interest_rate_percent: annualRatePercent,
      term_months: termMonths,
      payments_per_year: paymentsPerYear
    },
    payment_per_period: roundMoney(payment),
    total_payments: roundMoney(sum(schedule, 'payment')),
    total_interest: roundMoney(totalInterest),
    periods,
    schedule,
    annual_summary: annual,
    method: 'fixed_rate_level_payment_amortization'
  };
}

export function taxExtraction(input = {}) {
  const amounts = array(input.amounts, 'amounts', 1, 500).map((item, index) => ({
    label: typeof item.label === 'string' ? item.label : `line_${index + 1}`,
    amount: money(item.amount, `amounts[${index}].amount`),
    tax_rate_percent: percent(item.tax_rate_percent ?? item.taxRatePercent, `amounts[${index}].tax_rate_percent`, 0, 100),
    mode: enumValue(item.mode ?? input.mode ?? 'exclusive', `amounts[${index}].mode`, ['exclusive', 'inclusive'])
  }));

  const lines = amounts.map((line) => {
    if (line.mode === 'inclusive') {
      const net = line.amount / (1 + line.tax_rate_percent / 100);
      const tax = line.amount - net;
      return formatTaxLine(line, net, tax, line.amount);
    }
    const tax = line.amount * (line.tax_rate_percent / 100);
    return formatTaxLine(line, line.amount, tax, line.amount + tax);
  });

  return {
    input: {
      count: lines.length
    },
    totals: {
      net_amount: roundMoney(sum(lines, 'net_amount')),
      tax_amount: roundMoney(sum(lines, 'tax_amount')),
      gross_amount: roundMoney(sum(lines, 'gross_amount'))
    },
    lines,
    method: 'exclusive_add_on_or_inclusive_reverse_tax_extraction'
  };
}

export function freelancerRate(input = {}) {
  const targetIncome = money(input.target_annual_income ?? input.targetAnnualIncome, 'target_annual_income');
  const annualExpenses = optionalMoney(input.annual_expenses ?? input.annualExpenses, 'annual_expenses') ?? 0;
  const taxOverheadPercent = percent(input.tax_overhead_percent ?? input.taxOverheadPercent ?? 0, 'tax_overhead_percent', 0, 95);
  const billableWeeks = number(input.billable_weeks ?? input.billableWeeks, 'billable_weeks', 1, 52);
  const billableHoursPerWeek = number(input.billable_hours_per_week ?? input.billableHoursPerWeek, 'billable_hours_per_week', 1, 100);
  const daysPerWeek = number(input.billable_days_per_week ?? input.billableDaysPerWeek ?? 5, 'billable_days_per_week', 1, 7);

  const preTaxRequired = (targetIncome + annualExpenses) / (1 - taxOverheadPercent / 100);
  const annualHours = billableWeeks * billableHoursPerWeek;
  const annualDays = billableWeeks * daysPerWeek;

  return {
    input: {
      target_annual_income: targetIncome,
      annual_expenses: annualExpenses,
      tax_overhead_percent: taxOverheadPercent,
      billable_weeks: billableWeeks,
      billable_hours_per_week: billableHoursPerWeek,
      billable_days_per_week: daysPerWeek
    },
    required_revenue: roundMoney(preTaxRequired),
    hourly_rate: roundMoney(preTaxRequired / annualHours),
    daily_rate: roundMoney(preTaxRequired / annualDays),
    weekly_revenue_target: roundMoney(preTaxRequired / billableWeeks),
    method: 'target_income_expenses_tax_overhead_billable_capacity'
  };
}

export function statsSummary(input = {}) {
  const values = array(input.values, 'values', 1, MAX_DATASET_SIZE).map((value, index) => finiteNumber(value, `values[${index}]`));
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sumValues(values) / values.length;
  const deviations = values.map((value) => (value - mean) ** 2);
  const variancePopulation = sumValues(deviations) / values.length;
  const varianceSample = values.length > 1 ? sumValues(deviations) / (values.length - 1) : 0;

  return {
    input: {
      count: values.length
    },
    min: sorted[0],
    max: sorted.at(-1),
    range: sorted.at(-1) - sorted[0],
    sum: round(sumValues(values), 10),
    mean: round(mean, 10),
    median: percentile(sorted, 0.5),
    mode: modes(values),
    variance_population: round(variancePopulation, 10),
    standard_deviation_population: round(Math.sqrt(variancePopulation), 10),
    variance_sample: round(varianceSample, 10),
    standard_deviation_sample: round(Math.sqrt(varianceSample), 10),
    quartiles: {
      q1: percentile(sorted, 0.25),
      q2: percentile(sorted, 0.5),
      q3: percentile(sorted, 0.75),
      iqr: round(percentile(sorted, 0.75) - percentile(sorted, 0.25), 10)
    },
    method: 'sorted_linear_interpolation_percentiles'
  };
}

export function decimalHours(input = {}) {
  const overtimeMultiplier = number(input.overtime_multiplier ?? input.overtimeMultiplier ?? 1, 'overtime_multiplier', 0, 10);
  if (input.decimal_hours !== undefined || input.decimalHours !== undefined) {
    const decimal = number(input.decimal_hours ?? input.decimalHours, 'decimal_hours', -100000, 100000);
    const sign = decimal < 0 ? -1 : 1;
    const absolute = Math.abs(decimal);
    const hours = Math.floor(absolute);
    const minutesFloat = (absolute - hours) * 60;
    const minutes = Math.floor(minutesFloat);
    const seconds = Math.round((minutesFloat - minutes) * 60);
    return {
      input: {
        decimal_hours: decimal,
        overtime_multiplier: overtimeMultiplier
      },
      hours: hours * sign,
      minutes,
      seconds,
      decimal_hours: round(decimal, 6),
      overtime_decimal_hours: round(decimal * overtimeMultiplier, 6),
      method: 'decimal_hours_to_clock_parts'
    };
  }

  const hours = number(input.hours ?? 0, 'hours', -100000, 100000);
  const minutes = number(input.minutes ?? 0, 'minutes', 0, 59);
  const seconds = number(input.seconds ?? 0, 'seconds', 0, 59);
  const sign = hours < 0 ? -1 : 1;
  const decimal = sign * (Math.abs(hours) + minutes / 60 + seconds / 3600);
  return {
    input: {
      hours,
      minutes,
      seconds,
      overtime_multiplier: overtimeMultiplier
    },
    decimal_hours: round(decimal, 6),
    overtime_decimal_hours: round(decimal * overtimeMultiplier, 6),
    total_minutes: round(decimal * 60, 4),
    total_seconds: round(decimal * 3600, 2),
    method: 'clock_parts_to_decimal_hours'
  };
}

export function tradieJobMargin(input = {}) {
  const labourHours = number(input.labour_hours ?? input.labourHours ?? 0, 'labour_hours', 0, 100000);
  const labourRate = money(input.labour_rate ?? input.labourRate ?? 0, 'labour_rate');
  const materialsCost = money(input.materials_cost ?? input.materialsCost ?? 0, 'materials_cost');
  const subcontractorCost = money(input.subcontractor_cost ?? input.subcontractorCost ?? 0, 'subcontractor_cost');
  const overheadPercent = percent(input.overhead_percent ?? input.overheadPercent ?? 0, 'overhead_percent', 0, 500);
  const quotedPrice = money(input.quoted_price ?? input.quotedPrice, 'quoted_price');

  const labourCost = labourHours * labourRate;
  const directCost = labourCost + materialsCost + subcontractorCost;
  const overheadAmount = directCost * (overheadPercent / 100);
  const totalCost = directCost + overheadAmount;
  const grossProfit = quotedPrice - totalCost;

  return {
    input: {
      labour_hours: labourHours,
      labour_rate: labourRate,
      materials_cost: materialsCost,
      subcontractor_cost: subcontractorCost,
      overhead_percent: overheadPercent,
      quoted_price: quotedPrice
    },
    labour_cost: roundMoney(labourCost),
    direct_cost: roundMoney(directCost),
    overhead_amount: roundMoney(overheadAmount),
    total_cost: roundMoney(totalCost),
    gross_profit: roundMoney(grossProfit),
    gross_margin_percent: round((grossProfit / quotedPrice) * 100, 4),
    markup_on_cost_percent: totalCost === 0 ? null : round((grossProfit / totalCost) * 100, 4),
    break_even_price: roundMoney(totalCost),
    method: 'tradie_job_quote_margin_from_labour_materials_subcontractors'
  };
}

export function tradieVatReturnSummary(input = {}) {
  const sales = taxLines(input.sales, 'sales');
  const purchases = taxLines(input.purchases, 'purchases');
  const outputVat = sum(sales, 'tax_amount');
  const inputVat = sum(purchases, 'tax_amount');
  const netVatDue = outputVat - inputVat;

  return {
    input: {
      sales_count: sales.length,
      purchases_count: purchases.length
    },
    sales: {
      net_amount: roundMoney(sum(sales, 'net_amount')),
      vat_amount: roundMoney(outputVat),
      gross_amount: roundMoney(sum(sales, 'gross_amount'))
    },
    purchases: {
      net_amount: roundMoney(sum(purchases, 'net_amount')),
      vat_amount: roundMoney(inputVat),
      gross_amount: roundMoney(sum(purchases, 'gross_amount'))
    },
    vat: {
      output_vat: roundMoney(outputVat),
      input_vat: roundMoney(inputVat),
      net_vat_due: roundMoney(netVatDue),
      position: netVatDue >= 0 ? 'payable' : 'repayable'
    },
    method: 'tradie_vat_return_output_less_input_tax'
  };
}

export function tradieCisDeduction(input = {}) {
  const grossLabour = money(input.gross_labour ?? input.grossLabour, 'gross_labour');
  const materials = money(input.materials ?? 0, 'materials');
  const deductionRatePercent = percent(input.deduction_rate_percent ?? input.deductionRatePercent ?? 20, 'deduction_rate_percent', 0, 50);
  const cisTaxableLabour = Math.max(0, grossLabour - materials);
  const deduction = cisTaxableLabour * (deductionRatePercent / 100);

  return {
    input: {
      gross_labour: grossLabour,
      materials,
      deduction_rate_percent: deductionRatePercent
    },
    cis_taxable_labour: roundMoney(cisTaxableLabour),
    cis_deduction: roundMoney(deduction),
    net_payment: roundMoney(grossLabour - deduction),
    note: 'CIS treatment depends on UK scheme status and contract detail; this endpoint calculates a standard deduction model only.',
    method: 'uk_cis_labour_less_materials_deduction'
  };
}

export function tradieMileageClaim(input = {}) {
  const miles = number(input.miles ?? 0, 'miles', 0, 1_000_000);
  const ratePerMile = money(input.rate_per_mile ?? input.ratePerMile ?? 0.45, 'rate_per_mile');
  const reimbursedAmount = optionalMoney(input.reimbursed_amount ?? input.reimbursedAmount, 'reimbursed_amount') ?? 0;
  const claimAmount = miles * ratePerMile;

  return {
    input: {
      miles,
      rate_per_mile: ratePerMile,
      reimbursed_amount: reimbursedAmount
    },
    claim_amount: roundMoney(claimAmount),
    unreimbursed_amount: roundMoney(Math.max(0, claimAmount - reimbursedAmount)),
    reimbursed_excess: roundMoney(Math.max(0, reimbursedAmount - claimAmount)),
    method: 'business_mileage_claim_from_distance_and_rate'
  };
}

export function tradieToolDepreciation(input = {}) {
  const purchasePrice = money(input.purchase_price ?? input.purchasePrice, 'purchase_price');
  const salvageValue = money(input.salvage_value ?? input.salvageValue ?? 0, 'salvage_value');
  const usefulLifeYears = integer(input.useful_life_years ?? input.usefulLifeYears, 'useful_life_years', 1, 50);
  const businessUsePercent = percent(input.business_use_percent ?? input.businessUsePercent ?? 100, 'business_use_percent', 0, 100);
  if (salvageValue > purchasePrice) throw badRequest('salvage_value cannot exceed purchase_price', 'invalid_salvage_value');

  const depreciableAmount = (purchasePrice - salvageValue) * (businessUsePercent / 100);
  const annualDepreciation = depreciableAmount / usefulLifeYears;
  const schedule = [];
  let carryingValue = purchasePrice;
  for (let year = 1; year <= usefulLifeYears; year += 1) {
    carryingValue = Math.max(salvageValue, carryingValue - annualDepreciation);
    schedule.push({
      year,
      depreciation: roundMoney(annualDepreciation),
      carrying_value: roundMoney(carryingValue)
    });
  }

  return {
    input: {
      purchase_price: purchasePrice,
      salvage_value: salvageValue,
      useful_life_years: usefulLifeYears,
      business_use_percent: businessUsePercent
    },
    depreciable_amount: roundMoney(depreciableAmount),
    annual_depreciation: roundMoney(annualDepreciation),
    monthly_depreciation: roundMoney(annualDepreciation / 12),
    schedule,
    method: 'straight_line_tool_depreciation_business_use_adjusted'
  };
}

export function tradieInvoiceAging(input = {}) {
  const asOf = parseDate(input.as_of ?? input.asOf ?? new Date().toISOString().slice(0, 10), 'as_of');
  const invoices = array(input.invoices, 'invoices', 1, 1000).map((invoice, index) => {
    const amount = money(invoice.amount, `invoices[${index}].amount`);
    const paidAmount = money(invoice.paid_amount ?? invoice.paidAmount ?? 0, `invoices[${index}].paid_amount`);
    const dueDate = parseDate(invoice.due_date ?? invoice.dueDate, `invoices[${index}].due_date`);
    const outstanding = Math.max(0, amount - paidAmount);
    const daysOverdue = Math.max(0, daysBetween(dueDate, asOf));
    return {
      invoice_id: typeof invoice.invoice_id === 'string' ? invoice.invoice_id : `invoice_${index + 1}`,
      customer: typeof invoice.customer === 'string' ? invoice.customer : null,
      due_date: dueDate.toISOString().slice(0, 10),
      amount: roundMoney(amount),
      paid_amount: roundMoney(paidAmount),
      outstanding_amount: roundMoney(outstanding),
      days_overdue: daysOverdue,
      aging_bucket: agingBucket(daysOverdue)
    };
  });

  const outstandingInvoices = invoices.filter((invoice) => invoice.outstanding_amount > 0);
  return {
    input: {
      as_of: asOf.toISOString().slice(0, 10),
      invoice_count: invoices.length
    },
    totals: {
      invoiced_amount: roundMoney(sum(invoices, 'amount')),
      paid_amount: roundMoney(sum(invoices, 'paid_amount')),
      outstanding_amount: roundMoney(sum(invoices, 'outstanding_amount')),
      overdue_amount: roundMoney(sum(outstandingInvoices.filter((invoice) => invoice.days_overdue > 0), 'outstanding_amount'))
    },
    buckets: bucketTotals(outstandingInvoices),
    invoices,
    method: 'tradie_invoice_aging_by_due_date'
  };
}

function formatTaxLine(line, net, tax, gross) {
  return {
    label: line.label,
    mode: line.mode,
    tax_rate_percent: line.tax_rate_percent,
    net_amount: roundMoney(net),
    tax_amount: roundMoney(tax),
    gross_amount: roundMoney(gross)
  };
}

function taxLines(value, name) {
  return array(value, name, 0, 1000).map((item, index) => {
    const line = {
      label: typeof item.label === 'string' ? item.label : `${name}_${index + 1}`,
      amount: money(item.amount, `${name}[${index}].amount`),
      tax_rate_percent: percent(item.tax_rate_percent ?? item.taxRatePercent ?? 20, `${name}[${index}].tax_rate_percent`, 0, 100),
      mode: enumValue(item.mode ?? 'exclusive', `${name}[${index}].mode`, ['exclusive', 'inclusive'])
    };
    if (line.mode === 'inclusive') {
      const net = line.amount / (1 + line.tax_rate_percent / 100);
      return formatTaxLine(line, net, line.amount - net, line.amount);
    }
    return formatTaxLine(line, line.amount, line.amount * (line.tax_rate_percent / 100), line.amount * (1 + line.tax_rate_percent / 100));
  });
}

function parseDate(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest(`${name} must be a YYYY-MM-DD date`, 'invalid_date');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw badRequest(`${name} must be a valid date`, 'invalid_date');
  return parsed;
}

function daysBetween(start, end) {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

function agingBucket(daysOverdue) {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return '1_30';
  if (daysOverdue <= 60) return '31_60';
  if (daysOverdue <= 90) return '61_90';
  return '90_plus';
}

function bucketTotals(invoices) {
  const buckets = {
    current: 0,
    '1_30': 0,
    '31_60': 0,
    '61_90': 0,
    '90_plus': 0
  };
  for (const invoice of invoices) buckets[invoice.aging_bucket] += invoice.outstanding_amount;
  return Object.fromEntries(Object.entries(buckets).map(([bucket, amount]) => [bucket, roundMoney(amount)]));
}

function money(value, name) {
  return number(value, name, 0, 1_000_000_000);
}

function optionalMoney(value, name) {
  if (value === undefined || value === null || value === '') return null;
  return money(value, name);
}

function percent(value, name, min = -1000, max = 1000) {
  return number(value, name, min, max);
}

function optionalPercent(value, name) {
  if (value === undefined || value === null || value === '') return null;
  return percent(value, name);
}

function integer(value, name, min, max) {
  const parsed = number(value, name, min, max);
  if (!Number.isInteger(parsed)) throw badRequest(`${name} must be an integer`, 'invalid_integer');
  return parsed;
}

function finiteNumber(value, name) {
  return number(value, name, -1_000_000_000_000, 1_000_000_000_000);
}

function number(value, name, min, max) {
  if (value === undefined || value === null || value === '') throw badRequest(`${name} is required`, 'missing_value');
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw badRequest(`${name} must be a finite number`, 'invalid_number');
  if (parsed < min || parsed > max) throw badRequest(`${name} must be between ${min} and ${max}`, 'value_out_of_range');
  return parsed;
}

function array(value, name, min, max) {
  if (!Array.isArray(value)) throw badRequest(`${name} must be an array`, 'invalid_array');
  if (value.length < min || value.length > max) throw badRequest(`${name} must contain ${min} to ${max} items`, 'invalid_array_length');
  return value;
}

function enumValue(value, name, allowed) {
  if (allowed.includes(value)) return value;
  throw badRequest(`${name} must be one of: ${allowed.join(', ')}`, 'invalid_enum');
}

function percentile(sorted, p) {
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;
  return round(sorted[lower] + (sorted[upper] - sorted[lower]) * fraction, 10);
}

function modes(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  const max = Math.max(...counts.values());
  if (max <= 1) return [];
  return [...counts.entries()].filter(([, count]) => count === max).map(([value]) => value).sort((a, b) => a - b);
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function sumValues(values) {
  return values.reduce((total, value) => total + value, 0);
}

function roundMoney(value) {
  return round(value, 2);
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function badRequest(message, code) {
  return Object.assign(new Error(message), {
    statusCode: 400,
    code
  });
}
