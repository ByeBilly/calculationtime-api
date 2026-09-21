import { createHash } from 'node:crypto';

const DAY_MS = 86_400_000;
const MAX_ARRAY = 1000;

export function cronParser(input = {}) {
  const expression = requiredString(input.expression ?? input.cron, 'expression');
  const count = integer(input.count ?? input.n ?? 5, 'count', 1, 100);
  const from = parseDateTime(input.from ?? input.start ?? new Date().toISOString(), 'from');
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) throw badRequest('expression must contain 5 cron fields', 'invalid_cron');
  const [minute, hour, dayOfMonth, month, dayOfWeek] = [
    parseCronField(fields[0], 0, 59),
    parseCronField(fields[1], 0, 23),
    parseCronField(fields[2], 1, 31),
    parseCronField(fields[3], 1, 12),
    parseCronField(fields[4], 0, 7).map((value) => value === 7 ? 0 : value)
  ];
  const hits = [];
  let cursor = new Date(Math.ceil((from.getTime() + 1) / 60000) * 60000);
  for (let checked = 0; checked < 525_600 * 5 && hits.length < count; checked += 1) {
    if (minute.includes(cursor.getUTCMinutes()) && hour.includes(cursor.getUTCHours()) &&
      dayOfMonth.includes(cursor.getUTCDate()) && month.includes(cursor.getUTCMonth() + 1) &&
      dayOfWeek.includes(cursor.getUTCDay())) hits.push(cursor.toISOString());
    cursor = new Date(cursor.getTime() + 60_000);
  }
  if (hits.length < count) throw badRequest('cron expression produced too few hits in the 5-year scan window', 'cron_scan_window_exceeded');
  return { input: { expression, from: from.toISOString(), count }, next_runs: hits, method: 'five_field_utc_cron_minute_scan' };
}

export function workdayShift(input = {}) {
  let date = parseDate(input.date ?? input.start, 'date');
  let remaining = integer(input.days ?? input.n, 'days', -10000, 10000);
  const step = remaining >= 0 ? 1 : -1;
  const weekend = weekdaySet(input.weekend_days ?? [6, 7]);
  const holidays = new Set((input.holidays ?? []).map((value) => parseDate(value, 'holidays').toISOString().slice(0, 10)));
  while (remaining !== 0) {
    date = addDays(date, step);
    if (!isWeekend(date, weekend) && !holidays.has(date.toISOString().slice(0, 10))) remaining -= step;
  }
  return { input: { date: parseDate(input.date ?? input.start, 'date').toISOString().slice(0, 10), days: integer(input.days ?? input.n, 'days', -10000, 10000), weekend_days: [...weekend] }, shifted_date: date.toISOString().slice(0, 10), method: 'custom_weekend_business_day_shift' };
}

export function dateRangeSplit(input = {}) {
  let cursor = parseDate(input.start, 'start');
  const end = parseDate(input.end, 'end');
  if (end < cursor) throw badRequest('end must be on or after start', 'invalid_range');
  const unit = enumValue(input.unit ?? input.granularity ?? 'month', 'unit', ['week', 'month', 'quarter']);
  const chunks = [];
  while (cursor <= end && chunks.length < 1000) {
    const chunkStart = cursor;
    const next = unit === 'week' ? addDays(chunkStart, 7) : addMonths(chunkStart, unit === 'month' ? 1 : 3);
    const chunkEnd = new Date(Math.min(addDays(next, -1).getTime(), end.getTime()));
    chunks.push({ start: isoDate(chunkStart), end: isoDate(chunkEnd), days: daysBetween(chunkStart, chunkEnd) + 1 });
    cursor = addDays(chunkEnd, 1);
  }
  return { input: { start: isoDate(parseDate(input.start, 'start')), end: isoDate(end), unit }, chunks, method: 'calendar_range_fixed_unit_chunks' };
}

export function intervalOverlap(input = {}) {
  const aStart = parseDateTime(input.a_start ?? input.start_a, 'a_start');
  const aEnd = parseDateTime(input.a_end ?? input.end_a, 'a_end');
  const bStart = parseDateTime(input.b_start ?? input.start_b, 'b_start');
  const bEnd = parseDateTime(input.b_end ?? input.end_b, 'b_end');
  if (aEnd <= aStart || bEnd <= bStart) throw badRequest('interval ends must be after starts', 'invalid_interval');
  const start = new Date(Math.max(aStart.getTime(), bStart.getTime()));
  const end = new Date(Math.min(aEnd.getTime(), bEnd.getTime()));
  const ms = Math.max(0, end - start);
  return { overlaps: ms > 0, overlap_start: ms ? start.toISOString() : null, overlap_end: ms ? end.toISOString() : null, overlap_minutes: round(ms / 60000, 6), method: 'closed_open_interval_intersection' };
}

export function projectTimeline(input = {}) {
  const start = parseDate(input.start ?? input.start_date, 'start');
  const tasks = array(input.tasks, 'tasks', 1, 200).map((task, index) => ({
    id: requiredString(task.id ?? `task_${index + 1}`, `tasks[${index}].id`),
    duration_days: integer(task.duration_days ?? task.duration ?? 1, `tasks[${index}].duration_days`, 0, 10000),
    dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
    offset_days: integer(task.offset_days ?? task.offset ?? 0, `tasks[${index}].offset_days`, -10000, 10000)
  }));
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const memo = new Map();
  function finish(task, stack = []) {
    if (memo.has(task.id)) return memo.get(task.id);
    if (stack.includes(task.id)) throw badRequest('dependencies must not contain cycles', 'dependency_cycle');
    const depFinish = task.dependencies.length === 0 ? 0 : Math.max(...task.dependencies.map((id) => {
      const dep = byId.get(id);
      if (!dep) throw badRequest(`unknown dependency ${id}`, 'unknown_dependency');
      return finish(dep, [...stack, task.id]);
    }));
    const startDay = depFinish + task.offset_days;
    const endDay = startDay + task.duration_days;
    const value = { id: task.id, start_offset_days: startDay, finish_offset_days: endDay, start_date: isoDate(addDays(start, startDay)), finish_date: isoDate(addDays(start, endDay)) };
    memo.set(task.id, value);
    return value;
  }
  const schedule = tasks.map((task) => finish(task));
  const finishOffset = Math.max(...schedule.map((task) => task.finish_offset_days));
  return { input: { start: isoDate(start), task_count: tasks.length }, finish_date: isoDate(addDays(start, finishOffset)), duration_days: finishOffset, schedule, critical_tasks: schedule.filter((task) => task.finish_offset_days === finishOffset).map((task) => task.id), method: 'dependency_offset_forward_pass' };
}

export function shiftCalculator(input = {}) {
  const start = parseDateTime(input.start, 'start');
  const end = parseDateTime(input.end, 'end');
  if (end <= start) throw badRequest('end must be after start', 'invalid_shift');
  const overtimeAfter = number(input.overtime_after_hours ?? 8, 'overtime_after_hours', 0, 24);
  const nightStart = integer(input.night_start_hour ?? 22, 'night_start_hour', 0, 23);
  const nightEnd = integer(input.night_end_hour ?? 6, 'night_end_hour', 0, 23);
  const total = (end - start) / 3_600_000;
  let night = 0;
  for (let cursor = new Date(start); cursor < end; cursor = new Date(cursor.getTime() + 900_000)) {
    const h = cursor.getUTCHours();
    const isNight = nightStart > nightEnd ? h >= nightStart || h < nightEnd : h >= nightStart && h < nightEnd;
    if (isNight) night += Math.min(900_000, end - cursor) / 3_600_000;
  }
  return { input: { start: start.toISOString(), end: end.toISOString(), overtime_after_hours: overtimeAfter }, total_hours: round(total, 4), regular_hours: round(Math.min(total, overtimeAfter), 4), overtime_hours: round(Math.max(0, total - overtimeAfter), 4), night_differential_hours: round(night, 4), method: 'utc_shift_hour_bucket_scan' };
}

export function countdownWorkdays(input = {}) {
  const start = parseDate(input.start ?? new Date().toISOString().slice(0, 10), 'start');
  const target = parseDate(input.target ?? input.deadline, 'target');
  const weekend = weekdaySet(input.weekend_days ?? [6, 7]);
  const holidays = new Set((input.holidays ?? []).map((value) => isoDate(parseDate(value, 'holidays'))));
  let count = 0;
  for (let d = start; d <= target; d = addDays(d, 1)) {
    if (!isWeekend(d, weekend) && !holidays.has(isoDate(d))) count += 1;
  }
  return { input: { start: isoDate(start), target: isoDate(target), weekend_days: [...weekend] }, business_days_remaining: Math.max(0, count), calendar_days_remaining: Math.max(0, daysBetween(start, target)), method: 'inclusive_business_day_countdown' };
}

export function recurringMonthly(input = {}) {
  const year = integer(input.year, 'year', 1900, 3000);
  const months = integer(input.months ?? 12, 'months', 1, 120);
  const ordinal = integer(input.ordinal ?? input.nth, 'ordinal', -5, 5);
  if (ordinal === 0) throw badRequest('ordinal must not be zero', 'invalid_ordinal');
  const weekday = normalizeWeekday(input.weekday);
  const startMonth = integer(input.start_month ?? 1, 'start_month', 1, 12);
  const occurrences = [];
  for (let offset = 0; offset < months; offset += 1) {
    const date = nthWeekdayOfMonth(year, startMonth + offset, weekday, ordinal);
    if (date) occurrences.push(isoDate(date));
  }
  return { input: { year, start_month: startMonth, months, ordinal, weekday }, occurrences, method: 'nth_weekday_monthly_recurrence' };
}

export function ageInDays(input = {}) {
  const birth = parseDate(input.birth_date ?? input.birth, 'birth_date');
  const days = integer(input.days ?? input.milestone_days ?? 10000, 'days', 0, 1000000);
  return { input: { birth_date: isoDate(birth), milestone_days: days }, milestone_date: isoDate(addDays(birth, days)), weekday: weekdayName(addDays(birth, days)), method: 'birth_date_plus_milestone_days' };
}

export function timeBlocks(input = {}) {
  const minutes = integer(input.minutes ?? input.block_minutes ?? 30, 'minutes', 1, 1440);
  if (1440 % minutes !== 0) throw badRequest('minutes must divide evenly into 1440', 'invalid_block_size');
  const blocks = [];
  for (let start = 0; start < 1440; start += minutes) blocks.push({ start: clock(start), end: clock(start + minutes), minutes });
  return { input: { minutes }, count: blocks.length, blocks, method: 'twenty_four_hour_equal_block_split' };
}

export function hexToRgb(input = {}) {
  const { r, g, b, hex } = parseHex(input.hex ?? input.color);
  return { input: { hex }, rgb: [r, g, b], method: 'hex_triplet_to_rgb' };
}

export function rgbToHex(input = {}) {
  const [r, g, b] = rgb(input);
  return { input: { rgb: [r, g, b] }, hex: toHex(r, g, b), method: 'rgb_to_hex_triplet' };
}

export function rgbToHsl(input = {}) {
  const [r, g, b] = rgb(input).map((value) => value / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return { hsl: { h: round(h, 6), s: round(s * 100, 6), l: round(l * 100, 6) }, method: 'rgb_to_hsl_color_space' };
}

export function hslToRgb(input = {}) {
  const h = ((number(input.h ?? input.hue, 'h', -36000, 36000) % 360) + 360) % 360;
  const s = percent01(input.s ?? input.saturation, 's');
  const l = percent01(input.l ?? input.lightness, 'l');
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  const [rp, gp, bp] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const values = [rp, gp, bp].map((value) => Math.round((value + m) * 255));
  return { input: { h, s: round(s * 100, 6), l: round(l * 100, 6) }, rgb: values, hex: toHex(...values), method: 'hsl_to_rgb_color_space' };
}

export function contrastRatio(input = {}) {
  const a = parseHex(input.color_a ?? input.foreground ?? input.hex1);
  const b = parseHex(input.color_b ?? input.background ?? input.hex2);
  const ratio = (Math.max(relativeLuminance(a), relativeLuminance(b)) + 0.05) / (Math.min(relativeLuminance(a), relativeLuminance(b)) + 0.05);
  return { ratio: round(ratio, 4), wcag: { aa_normal: ratio >= 4.5, aa_large: ratio >= 3, aaa_normal: ratio >= 7 }, method: 'wcag_relative_luminance_contrast' };
}

export function luminance(input = {}) {
  const color = parseHex(input.hex ?? input.color);
  return { input: { hex: color.hex }, relative_luminance: round(relativeLuminance(color), 8), method: 'wcag_relative_luminance' };
}

export function tintShade(input = {}) {
  const color = parseHex(input.hex ?? input.color);
  const steps = integer(input.steps ?? 10, 'steps', 1, 20);
  const palette = [];
  for (let i = steps; i >= 1; i -= 1) palette.push({ type: 'tint', weight: i / (steps + 1), hex: mix(color, { r: 255, g: 255, b: 255 }, i / (steps + 1)) });
  palette.push({ type: 'base', weight: 0, hex: color.hex });
  for (let i = 1; i <= steps; i += 1) palette.push({ type: 'shade', weight: i / (steps + 1), hex: mix(color, { r: 0, g: 0, b: 0 }, i / (steps + 1)) });
  return { input: { hex: color.hex, steps }, palette, method: 'linear_rgb_tint_shade_mix' };
}

export function cmykConversion(input = {}) {
  const [r, g, b] = rgb(input).map((value) => value / 255);
  const k = 1 - Math.max(r, g, b);
  const c = k === 1 ? 0 : (1 - r - k) / (1 - k);
  const m = k === 1 ? 0 : (1 - g - k) / (1 - k);
  const y = k === 1 ? 0 : (1 - b - k) / (1 - k);
  return { cmyk: { c: round(c * 100, 4), m: round(m * 100, 4), y: round(y * 100, 4), k: round(k * 100, 4) }, method: 'rgb_to_device_cmyk_approximation' };
}

export function pxToRem(input = {}) {
  const px = number(input.px ?? input.pixels, 'px', -100000, 100000);
  const base = number(input.base_px ?? input.base ?? 16, 'base_px', 1, 1000);
  return { input: { px, base_px: base }, rem: round(px / base, 6), css: `${round(px / base, 6)}rem`, method: 'pixels_divided_by_root_font_size' };
}

export function lineHeight(input = {}) {
  const fontSize = number(input.font_size_px ?? input.font_size ?? 16, 'font_size_px', 1, 500);
  const ratio = number(input.ratio ?? 1.5, 'ratio', 1, 3);
  const steps = integer(input.steps ?? 5, 'steps', 1, 20);
  return { input: { font_size_px: fontSize, ratio, steps }, line_height_px: round(fontSize * ratio, 4), unitless: round(ratio, 4), scale: Array.from({ length: steps }, (_, i) => round(fontSize * ratio ** i, 4)), method: 'modular_typography_ratio' };
}

export function ipParse(input = {}) {
  const value = requiredString(input.ip ?? input.address, 'ip');
  if (value.includes(':')) return { input: { ip: value }, version: 6, compressed: value, valid: /^[0-9a-f:.]+$/i.test(value), method: 'basic_ipv6_pattern_parse' };
  const int = ipv4ToInt(value);
  const first = Number(value.split('.')[0]);
  return { input: { ip: value }, version: 4, integer: int, class: first < 128 ? 'A' : first < 192 ? 'B' : first < 224 ? 'C' : first < 240 ? 'D' : 'E', private: isPrivateIpv4(int), method: 'ipv4_octet_integer_parse' };
}

export function cidrRange(input = {}) {
  const raw = requiredString(input.cidr, 'cidr');
  const [ip, prefixRaw] = raw.split('/');
  const prefix = integer(prefixRaw, 'prefix', 0, 32);
  const base = ipv4ToInt(ip);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = base & mask;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  return { input: { cidr: raw }, network_address: intToIpv4(network), broadcast_address: intToIpv4(broadcast), first_usable: prefix >= 31 ? null : intToIpv4(network + 1), last_usable: prefix >= 31 ? null : intToIpv4(broadcast - 1), total_addresses: total, usable_hosts: prefix >= 31 ? total : Math.max(0, total - 2), method: 'ipv4_cidr_bitmask_range' };
}

export function userAgentParse(input = {}) {
  const ua = requiredString(input.user_agent ?? input.ua, 'user_agent');
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) && !/Chrome\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Unknown';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown';
  const device = /Mobi|Android|iPhone/.test(ua) ? 'mobile' : /iPad|Tablet/.test(ua) ? 'tablet' : 'desktop';
  return { browser, os, device, method: 'deterministic_user_agent_pattern_match' };
}

export function queryStringParse(input = {}) {
  const mode = enumValue(input.mode ?? 'decode', 'mode', ['decode', 'encode']);
  if (mode === 'encode') {
    const params = new URLSearchParams(flattenObject(input.params ?? input.value ?? {}));
    return { query: params.toString(), method: 'url_search_params_encode' };
  }
  const raw = requiredString(input.query ?? input.value, 'query').replace(/^\?/, '');
  return { params: Object.fromEntries(new URLSearchParams(raw).entries()), method: 'url_search_params_decode' };
}

export function slugSanitize(input = {}) {
  const text = requiredString(input.text ?? input.value, 'text');
  const slug = text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 200);
  return { input: { text }, slug, method: 'unicode_normalized_url_slug' };
}

export function portLookup(input = {}) {
  const port = integer(input.port, 'port', 0, 65535);
  const table = { 20: 'ftp-data', 21: 'ftp', 22: 'ssh', 25: 'smtp', 53: 'dns', 80: 'http', 110: 'pop3', 143: 'imap', 443: 'https', 587: 'smtp-submission', 993: 'imaps', 995: 'pop3s', 3306: 'mysql', 5432: 'postgresql', 6379: 'redis', 27017: 'mongodb' };
  return { input: { port }, service: table[port] ?? null, range: port < 1024 ? 'well_known' : port < 49152 ? 'registered' : 'dynamic_private', method: 'static_port_reference_lookup' };
}

export function httpStatusLookup(input = {}) {
  const code = integer(input.code ?? input.status, 'code', 100, 599);
  const phrases = { 200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict', 422: 'Unprocessable Content', 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable' };
  return { input: { code }, phrase: phrases[code] ?? 'Unassigned or uncommon status', class: `${Math.floor(code / 100)}xx`, error: code >= 400, method: 'static_http_status_lookup' };
}

export function mimeLookup(input = {}) {
  const ext = requiredString(input.extension ?? input.ext, 'extension').toLowerCase().replace(/^\./, '');
  const table = { html: 'text/html', css: 'text/css', js: 'text/javascript', json: 'application/json', csv: 'text/csv', txt: 'text/plain', pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp', mp3: 'audio/mpeg', mp4: 'video/mp4', zip: 'application/zip' };
  return { input: { extension: ext }, mime_type: table[ext] ?? 'application/octet-stream', known: Boolean(table[ext]), method: 'static_extension_mime_lookup' };
}

export function uuidV5(input = {}) {
  const namespace = uuidToBytes(requiredString(input.namespace ?? '6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'namespace'));
  const name = requiredString(input.name, 'name');
  const hash = createHash('sha1').update(Buffer.concat([namespace, Buffer.from(name)])).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return { input: { namespace: input.namespace ?? '6ba7b810-9dad-11d1-80b4-00c04fd430c8', name }, uuid: bytesToUuid(hash.subarray(0, 16)), method: 'rfc4122_uuid_v5_sha1' };
}

export function macFormat(input = {}) {
  const raw = requiredString(input.mac ?? input.address, 'mac').toLowerCase().replace(/[^0-9a-f]/g, '');
  if (!/^[0-9a-f]{12}$/.test(raw)) throw badRequest('mac must contain exactly 12 hexadecimal digits', 'invalid_mac');
  return { input: { mac: input.mac ?? input.address }, normalized: raw.match(/.{2}/g).join(':'), hyphen: raw.match(/.{2}/g).join('-'), dotted: `${raw.slice(0, 4)}.${raw.slice(4, 8)}.${raw.slice(8)}`, method: 'mac_hex_normalization' };
}

export function npv(input = {}) {
  const rate = number(input.discount_rate_percent ?? input.rate_percent ?? input.rate, 'discount_rate_percent', -99.999, 10000) / 100;
  const cashflows = numberArray(input.cashflows ?? input.cash_flows, 'cashflows', 1, MAX_ARRAY);
  return { input: { discount_rate_percent: rate * 100, cashflows }, npv: round(cashflows.reduce((total, cf, i) => total + cf / (1 + rate) ** i, 0), 6), method: 'discounted_cash_flow_net_present_value' };
}

export function irrApproximation(input = {}) {
  const cashflows = numberArray(input.cashflows ?? input.cash_flows, 'cashflows', 2, 200);
  let rate = number(input.guess_percent ?? 10, 'guess_percent', -90, 1000) / 100;
  for (let i = 0; i < 100; i += 1) {
    const f = cashflows.reduce((total, cf, t) => total + cf / (1 + rate) ** t, 0);
    const df = cashflows.reduce((total, cf, t) => total - (t * cf) / (1 + rate) ** (t + 1), 0);
    if (Math.abs(df) < 1e-12) break;
    const next = rate - f / df;
    if (!Number.isFinite(next) || next <= -0.999999) break;
    if (Math.abs(next - rate) < 1e-10) { rate = next; break; }
    rate = next;
  }
  return { input: { cashflows }, irr_percent: round(rate * 100, 6), method: 'newton_raphson_irr_approximation' };
}

export function bondYield(input = {}) {
  const face = number(input.face_value ?? input.face, 'face_value', 0.000001, 1e12);
  const price = number(input.price, 'price', 0.000001, 1e12);
  const couponRate = number(input.coupon_rate_percent ?? input.coupon_rate, 'coupon_rate_percent', 0, 1000) / 100;
  const years = number(input.years_to_maturity ?? input.years, 'years_to_maturity', 0.000001, 1000);
  const annualCoupon = face * couponRate;
  return { current_yield_percent: round((annualCoupon / price) * 100, 6), approximate_ytm_percent: round(((annualCoupon + (face - price) / years) / ((face + price) / 2)) * 100, 6), method: 'current_yield_and_approximate_ytm' };
}

export function depreciationStraightLine(input = {}) {
  const cost = number(input.cost, 'cost', 0, 1e12);
  const salvage = number(input.salvage_value ?? input.salvage ?? 0, 'salvage_value', 0, cost);
  const life = integer(input.life_years ?? input.years, 'life_years', 1, 1000);
  const annual = (cost - salvage) / life;
  return { annual_depreciation: round(annual, 6), schedule: Array.from({ length: life }, (_, i) => ({ year: i + 1, depreciation: round(annual, 6), book_value: round(Math.max(salvage, cost - annual * (i + 1)), 6) })), method: 'straight_line_depreciation_schedule' };
}

export function depreciationDeclining(input = {}) {
  const cost = number(input.cost, 'cost', 0, 1e12);
  const salvage = number(input.salvage_value ?? input.salvage ?? 0, 'salvage_value', 0, cost);
  const life = integer(input.life_years ?? input.years, 'life_years', 1, 1000);
  const rate = number(input.rate_percent ?? 200 / life, 'rate_percent', 0, 100) / 100;
  let book = cost;
  const schedule = [];
  for (let year = 1; year <= life; year += 1) {
    const depreciation = Math.min(book - salvage, book * rate);
    book -= depreciation;
    schedule.push({ year, depreciation: round(depreciation, 6), book_value: round(book, 6) });
  }
  return { input: { cost, salvage_value: salvage, life_years: life, rate_percent: rate * 100 }, schedule, method: 'declining_balance_depreciation_schedule' };
}

export function loanPayoffExtra(input = {}) {
  const principal = number(input.principal, 'principal', 0.000001, 1e12);
  const annualRate = number(input.annual_rate_percent ?? input.rate_percent, 'annual_rate_percent', 0, 1000) / 100 / 12;
  const payment = number(input.monthly_payment, 'monthly_payment', 0.000001, 1e12);
  const extra = number(input.extra_payment ?? 0, 'extra_payment', 0, 1e12);
  const base = payoff(principal, annualRate, payment);
  const accelerated = payoff(principal, annualRate, payment + extra);
  return { baseline: base, with_extra_payment: accelerated, months_saved: base.months - accelerated.months, interest_saved: round(base.total_interest - accelerated.total_interest, 6), method: 'monthly_amortization_extra_principal' };
}

export function effectiveAnnualRate(input = {}) {
  const nominal = number(input.nominal_rate_percent ?? input.rate_percent, 'nominal_rate_percent', -99, 1000) / 100;
  const n = integer(input.compounds_per_year ?? input.n, 'compounds_per_year', 1, 365000);
  return { effective_annual_rate_percent: round(((1 + nominal / n) ** n - 1) * 100, 6), method: 'nominal_to_effective_annual_rate' };
}

export function markupMarginSplit(input = {}) {
  const cost = optionalNum(input.cost, 'cost', 0, 1e12);
  const price = optionalNum(input.price ?? input.selling_price, 'price', 0, 1e12);
  const margin = optionalNum(input.margin_percent, 'margin_percent', 0, 99.999);
  const markup = optionalNum(input.markup_percent, 'markup_percent', 0, 100000);
  const resolvedMarkup = markup ?? (margin !== null ? (margin / (100 - margin)) * 100 : (cost !== null && price !== null ? ((price - cost) / cost) * 100 : null));
  const resolvedMargin = margin ?? (markup !== null ? (markup / (100 + markup)) * 100 : (cost !== null && price !== null ? ((price - cost) / price) * 100 : null));
  return { gross_margin_percent: round(resolvedMargin, 6), markup_percent: round(resolvedMarkup, 6), gross_profit: cost !== null && price !== null ? round(price - cost, 6) : null, method: 'margin_markup_cost_price_conversion' };
}

export function breakEvenMulti(input = {}) {
  const fixed = number(input.fixed_costs, 'fixed_costs', 0, 1e12);
  const products = array(input.products, 'products', 1, 100).map((p, i) => {
    const price = number(p.price, `products[${i}].price`, 0.000001, 1e12);
    const variable = number(p.variable_cost, `products[${i}].variable_cost`, 0, price);
    const mix = number(p.mix ?? p.sales_mix ?? 1, `products[${i}].mix`, 0.000001, 1e12);
    return { name: p.name ?? `product_${i + 1}`, price, variable_cost: variable, mix, contribution: price - variable };
  });
  const mixTotal = products.reduce((t, p) => t + p.mix, 0);
  const weightedContribution = products.reduce((t, p) => t + p.contribution * (p.mix / mixTotal), 0);
  const units = fixed / weightedContribution;
  return { weighted_contribution_margin: round(weightedContribution, 6), break_even_units: Math.ceil(units), break_even_revenue: round(products.reduce((t, p) => t + Math.ceil(units * p.mix / mixTotal) * p.price, 0), 6), product_units: products.map((p) => ({ name: p.name, units: Math.ceil(units * p.mix / mixTotal) })), method: 'weighted_average_multi_product_break_even' };
}

export function tipSplit(input = {}) {
  const subtotal = number(input.subtotal ?? input.amount, 'subtotal', 0, 1e12);
  const tipPercent = number(input.tip_percent ?? input.tip, 'tip_percent', 0, 1000);
  const people = integer(input.people ?? 1, 'people', 1, 10000);
  const tip = subtotal * tipPercent / 100;
  const total = subtotal + tip;
  return { subtotal: round(subtotal, 2), tip_amount: round(tip, 2), total: round(total, 2), per_person: round(total / people, 2), method: 'percentage_tip_even_split' };
}

export function matrixMultiply(input = {}) {
  const a = matrix(input.a ?? input.matrix_a, 'a');
  const b = matrix(input.b ?? input.matrix_b, 'b');
  if (a[0].length !== b.length) throw badRequest('matrix column/row dimensions must match', 'invalid_matrix_dimensions');
  return { result: a.map((row) => b[0].map((_, j) => round(row.reduce((sum, value, k) => sum + value * b[k][j], 0), 12))), method: 'direct_matrix_multiplication' };
}

export function vectorMagnitude(input = {}) {
  const values = numberArray(input.vector ?? input.values, 'vector', 2, 3);
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0));
  return { vector: values, magnitude: round(magnitude, 12), unit_vector: values.map((value) => round(value / magnitude, 12)), method: 'euclidean_vector_norm' };
}

export function vectorDotProduct(input = {}) {
  const a = numberArray(input.a ?? input.vector_a, 'a', 2, 3);
  const b = numberArray(input.b ?? input.vector_b, 'b', a.length, a.length);
  const dot = a.reduce((sum, value, i) => sum + value * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v ** 2, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v ** 2, 0));
  return { dot_product: round(dot, 12), angle_degrees: round(Math.acos(Math.max(-1, Math.min(1, dot / (magA * magB)))) * 180 / Math.PI, 8), method: 'vector_dot_product_angle' };
}

export function quadraticVertex(input = {}) {
  const a = number(input.a, 'a', -1e9, 1e9);
  if (a === 0) throw badRequest('a must not be zero', 'invalid_quadratic');
  const b = number(input.b, 'b', -1e9, 1e9);
  const c = number(input.c, 'c', -1e9, 1e9);
  const x = -b / (2 * a);
  const disc = b ** 2 - 4 * a * c;
  return { vertex: { x: round(x, 12), y: round(a * x ** 2 + b * x + c, 12) }, axis_of_symmetry: round(x, 12), roots: disc < 0 ? [] : [round((-b + Math.sqrt(disc)) / (2 * a), 12), round((-b - Math.sqrt(disc)) / (2 * a), 12)], method: 'quadratic_vertex_formula' };
}

export function factorialGamma(input = {}) {
  const n = number(input.n ?? input.value, 'n', 0, 170);
  if (Number.isInteger(n)) return { input: { n }, factorial: factorial(n), gamma: factorial(n - 1), method: 'integer_factorial_gamma_identity' };
  return { input: { n }, gamma: round(lanczosGamma(n), 12), factorial_approximation: round(lanczosGamma(n + 1), 12), method: 'lanczos_gamma_approximation' };
}

export function fibonacci(input = {}) {
  const n = integer(input.n, 'n', 0, 1000);
  const sequence = [0, 1];
  for (let i = 2; i <= n; i += 1) sequence[i] = sequence[i - 1] + sequence[i - 2];
  return { n, value: sequence[n] ?? 0, sequence: sequence.slice(0, n + 1), method: 'iterative_fibonacci_sequence' };
}

export function baseNConvert(input = {}) {
  const fromBase = integer(input.from_base, 'from_base', 2, 36);
  const toBase = integer(input.to_base, 'to_base', 2, 36);
  const value = requiredString(input.value, 'value');
  const parsed = parseInt(value, fromBase);
  if (Number.isNaN(parsed)) throw badRequest('value is invalid for from_base', 'invalid_base_value');
  return { input: { value, from_base: fromBase, to_base: toBase }, decimal: parsed, converted: parsed.toString(toBase).toUpperCase(), method: 'integer_base_conversion' };
}

export function percentileCalc(input = {}) {
  const values = numberArray(input.values, 'values', 1, MAX_ARRAY).sort((a, b) => a - b);
  const percentile = number(input.percentile ?? input.p, 'percentile', 0, 100);
  return { percentile, value: round(percentileValue(values, percentile / 100), 12), method: 'sorted_linear_interpolation_percentile' };
}

export function windChill(input = {}) {
  const tempC = number(input.temperature_c ?? input.temp_c, 'temperature_c', -100, 50);
  const windKmh = number(input.wind_kmh ?? input.wind_speed_kmh, 'wind_kmh', 0, 500);
  const chill = windKmh < 4.8 || tempC > 10 ? tempC : 13.12 + 0.6215 * tempC - 11.37 * windKmh ** 0.16 + 0.3965 * tempC * windKmh ** 0.16;
  return { input: { temperature_c: tempC, wind_kmh: windKmh }, wind_chill_c: round(chill, 4), method: 'canadian_us_wind_chill_formula' };
}

export function heatIndex(input = {}) {
  const tempC = number(input.temperature_c ?? input.temp_c, 'temperature_c', -50, 80);
  const rh = number(input.relative_humidity ?? input.humidity_percent, 'relative_humidity', 0, 100);
  const f = tempC * 9 / 5 + 32;
  const hiF = -42.379 + 2.04901523 * f + 10.14333127 * rh - 0.22475541 * f * rh - 0.00683783 * f ** 2 - 0.05481717 * rh ** 2 + 0.00122874 * f ** 2 * rh + 0.00085282 * f * rh ** 2 - 0.00000199 * f ** 2 * rh ** 2;
  return { input: { temperature_c: tempC, relative_humidity: rh }, heat_index_c: round((hiF - 32) * 5 / 9, 4), method: 'noaa_rothfusz_heat_index_regression' };
}

function parseCronField(field, min, max) {
  const out = new Set();
  for (const part of field.split(',')) {
    const [rangePart, stepRaw] = part.split('/');
    const step = stepRaw ? integer(stepRaw, 'cron_step', 1, max - min + 1) : 1;
    const [startRaw, endRaw] = rangePart === '*' ? [min, max] : rangePart.split('-');
    const start = Number(startRaw), end = endRaw === undefined ? start : Number(endRaw);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) throw badRequest('cron field contains an invalid range', 'invalid_cron_field');
    for (let value = start; value <= end; value += step) out.add(value);
  }
  return [...out].sort((a, b) => a - b);
}

function parseDate(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw badRequest(`${name} must be YYYY-MM-DD`, 'invalid_date');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || isoDate(date) !== value) throw badRequest(`${name} must be a valid date`, 'invalid_date');
  return date;
}

function parseDateTime(value, name) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest(`${name} must be a valid timestamp`, 'invalid_timestamp');
  return date;
}

function addDays(date, days) { return new Date(date.getTime() + days * DAY_MS); }
function addMonths(date, months) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate())); }
function daysBetween(a, b) { return Math.floor((b - a) / DAY_MS); }
function isoDate(date) { return date.toISOString().slice(0, 10); }
function weekdaySet(values) { return new Set(array(values, 'weekend_days', 0, 7).map((v) => integer(v, 'weekend_day', 1, 7))); }
function isWeekend(date, weekend) { return weekend.has(date.getUTCDay() === 0 ? 7 : date.getUTCDay()); }
function normalizeWeekday(value) {
  const map = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  if (typeof value === 'string' && map[value.toLowerCase()] !== undefined) return map[value.toLowerCase()];
  return integer(value, 'weekday', 0, 6);
}
function nthWeekdayOfMonth(year, monthOffset, weekday, ordinal) {
  const date = new Date(Date.UTC(year, monthOffset - 1, 1));
  const y = date.getUTCFullYear(), m = date.getUTCMonth();
  const dates = [];
  for (let d = new Date(Date.UTC(y, m, 1)); d.getUTCMonth() === m; d = addDays(d, 1)) if (d.getUTCDay() === weekday) dates.push(new Date(d));
  return ordinal > 0 ? dates[ordinal - 1] : dates.at(ordinal);
}
function weekdayName(date) { return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getUTCDay()]; }
function clock(totalMinutes) { const m = totalMinutes % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }

function parseHex(value) {
  const raw = requiredString(value, 'hex').replace(/^#/, '');
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(raw)) throw badRequest('hex must be a 3- or 6-digit colour', 'invalid_hex');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const r = parseInt(full.slice(0, 2), 16), g = parseInt(full.slice(2, 4), 16), b = parseInt(full.slice(4, 6), 16);
  return { r, g, b, hex: toHex(r, g, b) };
}
function rgb(input) {
  const values = Array.isArray(input.rgb) ? input.rgb : [input.r, input.g, input.b];
  return values.map((value, i) => integer(value, ['r', 'g', 'b'][i], 0, 255));
}
function toHex(r, g, b) { return `#${[r, g, b].map((v) => integer(v, 'rgb', 0, 255).toString(16).padStart(2, '0')).join('')}`; }
function percent01(value, name) { const parsed = number(value, name, 0, 100); return parsed > 1 ? parsed / 100 : parsed; }
function relativeLuminance({ r, g, b }) {
  const linear = [r, g, b].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
function mix(a, b, weight) { return toHex(Math.round(a.r + (b.r - a.r) * weight), Math.round(a.g + (b.g - a.g) * weight), Math.round(a.b + (b.b - a.b) * weight)); }

function ipv4ToInt(ip) {
  const parts = requiredString(ip, 'ip').split('.').map((p) => integer(p, 'octet', 0, 255));
  if (parts.length !== 4) throw badRequest('ip must contain four IPv4 octets', 'invalid_ipv4');
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}
function intToIpv4(value) { return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.'); }
function isPrivateIpv4(value) { return (value >>> 24) === 10 || (value >>> 20) === 0xac1 || (value >>> 16) === 0xc0a8; }
function flattenObject(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) => value && typeof value === 'object' && !Array.isArray(value) ? flattenObject(value, prefix ? `${prefix}[${key}]` : key) : [[prefix ? `${prefix}[${key}]` : key, String(value)]]);
}
function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw badRequest('namespace must be a UUID', 'invalid_uuid');
  return Buffer.from(hex, 'hex');
}
function bytesToUuid(bytes) { const hex = bytes.toString('hex'); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`; }
function payoff(principal, rate, payment) {
  let balance = principal, interest = 0, months = 0;
  while (balance > 0.005 && months < 12000) {
    const charge = balance * rate;
    if (payment <= charge) throw badRequest('monthly_payment must exceed monthly interest', 'payment_too_low');
    interest += charge;
    balance = Math.max(0, balance + charge - payment);
    months += 1;
  }
  return { months, total_interest: round(interest, 6), total_paid: round(principal + interest, 6) };
}
function matrix(value, name) {
  const rows = array(value, name, 2, 3).map((row, i) => numberArray(row, `${name}[${i}]`, 2, 3));
  if (![2, 3].includes(rows.length) || rows.some((row) => ![2, 3].includes(row.length))) throw badRequest('matrix must be 2x2, 2x3, 3x2, or 3x3', 'invalid_matrix');
  return rows;
}
function factorial(n) { let out = 1; for (let i = 2; i <= n; i += 1) out *= i; return out; }
function lanczosGamma(z) {
  const p = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * lanczosGamma(1 - z));
  z -= 1;
  let x = 0.9999999999998099;
  for (let i = 0; i < p.length; i += 1) x += p[i] / (z + i + 1);
  const t = z + p.length - 0.5;
  return Math.sqrt(2 * Math.PI) * t ** (z + 0.5) * Math.exp(-t) * x;
}
function percentileValue(sorted, p) { const idx = (sorted.length - 1) * p; const lo = Math.floor(idx), hi = Math.ceil(idx); return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo); }

function numberArray(value, name, minLength, maxLength) { return array(value, name, minLength, maxLength).map((item, i) => number(item, `${name}[${i}]`, -1e15, 1e15)); }
function array(value, name, min, max) { if (!Array.isArray(value) || value.length < min || value.length > max) throw badRequest(`${name} must contain ${min} to ${max} items`, 'invalid_array_length'); return value; }
function requiredString(value, name) { if (typeof value !== 'string' || value.trim() === '') throw badRequest(`${name} is required`, 'missing_value'); return value.trim(); }
function integer(value, name, min, max) { const parsed = number(value, name, min, max); if (!Number.isInteger(parsed)) throw badRequest(`${name} must be an integer`, 'invalid_integer'); return parsed; }
function optionalNum(value, name, min, max) { return value === undefined || value === null || value === '' ? null : number(value, name, min, max); }
function number(value, name, min, max) { if (value === undefined || value === null || value === '') throw badRequest(`${name} is required`, 'missing_value'); const parsed = Number(value); if (!Number.isFinite(parsed)) throw badRequest(`${name} must be finite`, 'invalid_number'); if (parsed < min || parsed > max) throw badRequest(`${name} must be between ${min} and ${max}`, 'value_out_of_range'); return parsed; }
function enumValue(value, name, allowed) { const parsed = String(value ?? '').toLowerCase(); if (!allowed.includes(parsed)) throw badRequest(`${name} must be one of: ${allowed.join(', ')}`, 'invalid_enum'); return parsed; }
function round(value, places) { const factor = 10 ** places; return Math.round((value + Number.EPSILON) * factor) / factor; }
function badRequest(message, code) { return Object.assign(new Error(message), { statusCode: 400, code }); }
