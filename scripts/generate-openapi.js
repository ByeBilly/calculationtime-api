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
  publicRoute('get', '/v1/data/countries', 'Country reference table with capitals, ISO codes, dialing codes, and currencies'),
  publicRoute('get', '/v1/data/timezones', 'IANA timezone reference with current UTC offsets and DST status'),
  publicRoute('get', '/v1/data/elements', 'Periodic table reference values'),
  publicRoute('get', '/v1/data/constants', 'Physical and mathematical constants reference table'),
  publicRoute('get', '/v1/data/materials/density', 'Common material density reference table'),
  publicRoute('get', '/v1/data/http-status', 'HTTP status code directory'),
  publicRoute('get', '/v1/data/mime-types', 'MIME type and extension reference table'),
  publicRoute('get', '/v1/data/unicode-blocks', 'Unicode block range reference table'),
  publicRoute('get', '/v1/data/constellations', 'IAU constellation names, genitives, abbreviations, and quadrants'),
  publicRoute('get', '/v1/data/stars/bright', 'Bright star reference table'),
  publicRoute('get', '/v1/data/meteor-showers', 'Major annual meteor shower reference table'),
  publicRoute('get', '/api/v1/data/countries', 'Alias: country reference table'),
  publicRoute('get', '/api/v1/data/timezones', 'Alias: IANA timezone reference'),
  publicRoute('get', '/api/v1/data/elements', 'Alias: periodic table reference values'),
  publicRoute('get', '/api/v1/data/constants', 'Alias: physical and mathematical constants'),
  publicRoute('get', '/api/v1/data/materials/density', 'Alias: common material density reference table'),
  publicRoute('get', '/api/v1/data/http-status', 'Alias: HTTP status code directory'),
  publicRoute('get', '/api/v1/data/mime-types', 'Alias: MIME type and extension reference table'),
  publicRoute('get', '/api/v1/data/unicode-blocks', 'Alias: Unicode block range reference table'),
  publicRoute('get', '/api/v1/data/constellations', 'Alias: IAU constellation reference'),
  publicRoute('get', '/api/v1/data/stars/bright', 'Alias: bright star reference table'),
  publicRoute('get', '/api/v1/data/meteor-showers', 'Alias: major annual meteor shower reference table'),
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
  billablePost('/api/v1/convert/length', 'Zero-cost length unit conversion', 1, { value: 1, from: 'mile', to: 'kilometer' }),
  billablePost('/api/v1/convert/weight', 'Zero-cost weight and mass unit conversion', 1, { value: 10, from: 'pound', to: 'kilogram' }),
  billablePost('/api/v1/convert/temperature', 'Temperature scale conversion', 1, { value: 32, from: 'fahrenheit', to: 'celsius' }),
  billablePost('/api/v1/convert/area', 'Area unit conversion', 1, { value: 1, from: 'acre', to: 'square_meter' }),
  billablePost('/api/v1/convert/volume', 'Volume unit conversion', 1, { value: 1, from: 'gallon', to: 'liter' }),
  billablePost('/api/v1/convert/speed', 'Speed unit conversion', 1, { value: 100, from: 'kmh', to: 'mph' }),
  billablePost('/api/v1/convert/pressure', 'Pressure unit conversion', 1, { value: 1, from: 'atmosphere', to: 'psi' }),
  billablePost('/api/v1/convert/energy', 'Energy unit conversion', 1, { value: 1, from: 'kilowatt_hour', to: 'joule' }),
  billablePost('/api/v1/convert/power', 'Power unit conversion', 1, { value: 1, from: 'horsepower', to: 'watt' }),
  billablePost('/api/v1/convert/data-storage', 'Data storage unit conversion', 1, { value: 1, from: 'gigabyte', to: 'megabyte' }),
  billablePost('/api/v1/crypto/hash-sha256', 'Compute SHA-256 hash for a small payload', 1, { text: 'calculationtime' }),
  billablePost('/api/v1/crypto/hash-sha512', 'Compute SHA-512 hash for a small payload', 1, { text: 'calculationtime' }),
  billablePost('/api/v1/crypto/base64-encode', 'Encode text to Base64', 1, { text: 'calculationtime' }),
  billablePost('/api/v1/crypto/base64-decode', 'Decode Base64 text', 1, { base64: 'Y2FsY3VsYXRpb250aW1l' }),
  billablePost('/api/v1/schedule/cron-parser', 'List upcoming UTC run timestamps for a 5-field cron expression', 1, { expression: '*/15 9-17 * * 1-5', from: '2026-09-21T08:00:00Z', count: 5 }),
  billablePost('/api/v1/schedule/workday-shift', 'Shift a date by configurable working days', 1, { date: '2026-09-21', days: 10, weekend_days: [6, 7] }),
  billablePost('/api/v1/schedule/date-range-split', 'Split a date range into week, month, or quarter chunks', 1, { start: '2026-01-01', end: '2026-03-31', unit: 'month' }),
  billablePost('/api/v1/schedule/interval-overlap', 'Calculate overlap between two timestamp intervals', 1, { a_start: '2026-09-21T09:00:00Z', a_end: '2026-09-21T12:00:00Z', b_start: '2026-09-21T11:00:00Z', b_end: '2026-09-21T13:00:00Z' }),
  billablePost('/api/v1/schedule/project-timeline', 'Forward-pass project timeline and critical finish calculation', 1, { start: '2026-09-21', tasks: [{ id: 'design', duration_days: 3 }, { id: 'build', duration_days: 5, dependencies: ['design'] }] }),
  billablePost('/api/v1/schedule/shift-calculator', 'Calculate shift hours, overtime, and night differential hours', 1, { start: '2026-09-21T20:00:00Z', end: '2026-09-22T06:00:00Z', overtime_after_hours: 8 }),
  billablePost('/api/v1/schedule/countdown-workdays', 'Count business days remaining until a deadline', 1, { start: '2026-09-21', target: '2026-10-02', weekend_days: [6, 7] }),
  billablePost('/api/v1/schedule/recurring-monthly', 'Generate nth-weekday monthly recurrence dates', 1, { year: 2026, start_month: 1, months: 3, ordinal: 3, weekday: 'tuesday' }),
  billablePost('/api/v1/schedule/age-in-days', 'Calculate an exact age milestone date in days', 1, { birth_date: '1990-05-15', days: 10000 }),
  billablePost('/api/v1/schedule/time-blocks', 'Divide a 24-hour day into equal booking blocks', 1, { minutes: 30 }),
  billablePost('/api/v1/color/hex-to-rgb', 'Convert HEX colour to RGB array', 1, { hex: '#336699' }),
  billablePost('/api/v1/color/rgb-to-hex', 'Convert RGB values to HEX colour', 1, { r: 51, g: 102, b: 153 }),
  billablePost('/api/v1/color/rgb-to-hsl', 'Convert RGB colour to HSL', 1, { r: 51, g: 102, b: 153 }),
  billablePost('/api/v1/color/hsl-to-rgb', 'Convert HSL colour to RGB and HEX', 1, { h: 210, s: 50, l: 40 }),
  billablePost('/api/v1/color/contrast-ratio', 'Calculate WCAG contrast ratio between two colours', 1, { foreground: '#000000', background: '#ffffff' }),
  billablePost('/api/v1/color/luminance', 'Calculate WCAG relative luminance for a colour', 1, { hex: '#336699' }),
  billablePost('/api/v1/color/tint-shade', 'Generate tint and shade palette steps from a base colour', 1, { hex: '#336699', steps: 5 }),
  billablePost('/api/v1/color/cmyk-conversion', 'Approximate CMYK values from RGB input', 1, { r: 51, g: 102, b: 153 }),
  billablePost('/api/v1/typography/px-to-rem', 'Convert pixel values to rem units', 1, { px: 24, base_px: 16 }),
  billablePost('/api/v1/typography/line-height', 'Calculate proportional line height and type scale steps', 1, { font_size_px: 16, ratio: 1.5, steps: 5 }),
  billablePost('/api/v1/network/ip-parse', 'Parse IPv4 or IPv6 address metadata', 1, { ip: '192.168.1.10' }),
  billablePost('/api/v1/network/cidr-range', 'Calculate IPv4 CIDR network, broadcast, and usable hosts', 1, { cidr: '192.168.1.0/24' }),
  billablePost('/api/v1/network/user-agent-parse', 'Extract browser, OS, and device class from a user-agent string', 1, { user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' }),
  billablePost('/api/v1/network/query-string-parse', 'Encode or decode URL query strings', 1, { mode: 'decode', query: 'a=1&b=two' }),
  billablePost('/api/v1/network/slug-sanitize', 'Normalize arbitrary text into a URL-safe slug', 1, { text: 'Café Invoice #42!' }),
  billablePost('/api/v1/network/port-lookup', 'Look up standard TCP/UDP port service names', 1, { port: 443 }),
  billablePost('/api/v1/network/http-status-lookup', 'Look up HTTP status phrase and status class', 1, { code: 429 }),
  billablePost('/api/v1/network/mime-lookup', 'Resolve file extension to MIME type', 1, { extension: 'json' }),
  billablePost('/api/v1/network/uuid-v5', 'Generate deterministic name-based UUID v5', 1, { namespace: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', name: 'calculationtime.com' }),
  billablePost('/api/v1/network/mac-format', 'Normalize and validate MAC address formatting', 1, { mac: 'aabb.ccdd.eeff' }),
  billablePost('/api/v1/finance/npv', 'Calculate net present value for uneven cash flows', 1, { discount_rate_percent: 8, cashflows: [-1000, 400, 400, 400] }),
  billablePost('/api/v1/finance/irr-approximation', 'Approximate internal rate of return from cash flows', 1, { cashflows: [-1000, 400, 400, 400] }),
  billablePost('/api/v1/finance/bond-yield', 'Calculate current yield and approximate yield to maturity', 1, { face_value: 1000, price: 950, coupon_rate_percent: 5, years_to_maturity: 10 }),
  billablePost('/api/v1/finance/depreciation-straight-line', 'Generate a straight-line depreciation schedule', 1, { cost: 10000, salvage_value: 1000, life_years: 5 }),
  billablePost('/api/v1/finance/depreciation-declining', 'Generate a declining-balance depreciation schedule', 1, { cost: 10000, salvage_value: 1000, life_years: 5 }),
  billablePost('/api/v1/finance/loan-payoff-extra', 'Calculate loan payoff impact from extra monthly principal', 1, { principal: 200000, annual_rate_percent: 5, monthly_payment: 1200, extra_payment: 100 }),
  billablePost('/api/v1/finance/effective-annual-rate', 'Convert nominal APR to effective annual rate', 1, { nominal_rate_percent: 6, compounds_per_year: 12 }),
  billablePost('/api/v1/finance/markup-margin-split', 'Convert between markup, margin, cost, and selling price', 1, { cost: 60, price: 100 }),
  billablePost('/api/v1/finance/break-even-multi', 'Calculate weighted break-even across multiple products', 1, { fixed_costs: 10000, products: [{ name: 'A', price: 50, variable_cost: 20, mix: 2 }, { name: 'B', price: 80, variable_cost: 40, mix: 1 }] }),
  billablePost('/api/v1/finance/tip-split', 'Calculate tip, total, and per-person split', 1, { subtotal: 120, tip_percent: 20, people: 4 }),
  billablePost('/api/v1/math/matrix-multiply', 'Multiply two 2x2 or 3x3-compatible matrices', 1, { a: [[1, 2], [3, 4]], b: [[5, 6], [7, 8]] }),
  billablePost('/api/v1/math/vector-magnitude', 'Calculate vector magnitude and unit vector', 1, { vector: [3, 4] }),
  billablePost('/api/v1/math/vector-dot-product', 'Calculate vector dot product and angle', 1, { a: [1, 0], b: [0, 1] }),
  billablePost('/api/v1/math/quadratic-vertex', 'Calculate parabola vertex, axis, and roots', 1, { a: 1, b: -4, c: 3 }),
  billablePost('/api/v1/math/factorial-gamma', 'Calculate factorials and gamma approximations', 1, { n: 5 }),
  billablePost('/api/v1/math/fibonacci', 'Calculate Fibonacci number and sequence', 1, { n: 10 }),
  billablePost('/api/v1/math/base-n-convert', 'Convert integers between base 2 and base 36', 1, { value: 'ff', from_base: 16, to_base: 2 }),
  billablePost('/api/v1/math/percentile-calc', 'Calculate statistical percentile from raw values', 1, { values: [1, 2, 3, 4, 5], percentile: 90 }),
  billablePost('/api/v1/math/wind-chill', 'Calculate wind chill apparent temperature', 1, { temperature_c: 0, wind_kmh: 20 }),
  billablePost('/api/v1/math/heat-index', 'Calculate heat index apparent temperature', 1, { temperature_c: 32, relative_humidity: 70 }),
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
  billablePost('/api/v1/astronomy/solar-declination', 'Approximate solar declination angle for a date', 1, { date: '2026-06-21' }),
  billablePost('/api/v1/astronomy/equation-of-time', 'Approximate equation of time for a date', 1, { date: '2026-06-21' }),
  billablePost('/api/v1/astronomy/moon-illumination', 'Moon illumination fraction and phase angle', 1, { timestamp: '2026-06-21T00:00:00Z' }),
  billablePost('/api/v1/astronomy/sidereal-conversion', 'Convert solar hours to sidereal interval', 1, { solar_hours: 24 }),
  billablePost('/api/v1/astronomy/golden-hour', 'Morning and evening golden-hour windows', 1, { date: '2026-06-21', lat: 48.137154, lon: 11.576124 }),
  billablePost('/api/v1/astronomy/blue-hour', 'Morning and evening blue-hour windows', 1, { date: '2026-06-21', lat: 48.137154, lon: 11.576124 }),
  billablePost('/api/v1/astronomy/season-progress', 'Astronomical season progress at a timestamp', 1, { timestamp: '2026-06-21T00:00:00Z' }),
  billablePost('/api/v1/astronomy/zodiac-sign', 'Tropical zodiac sign by calendar date', 1, { date: '2026-06-21' }),
  billablePost('/api/v1/astronomy/daylight-delta', 'Day-length gain or loss versus previous day', 1, { date: '2026-06-21', lat: 48.137154, lon: 11.576124 }),
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
  billablePost('/v1/finance/simple-interest', 'Simple interest from principal, rate, and time', 1, {
    principal: 1000,
    annual_rate_percent: 5,
    years: 3
  }),
  billablePost('/v1/finance/compound-interest', 'Future value with compound interest frequency options', 1, {
    principal: 1000,
    annual_rate_percent: 5,
    years: 10,
    compounds_per_year: 12
  }),
  billablePost('/v1/finance/loan-amortization-summary', 'Loan payment, total interest, and total cost summary', 1, {
    principal: 250000,
    annual_interest_rate_percent: 6.25,
    term_months: 360
  }),
  billablePost('/v1/finance/rule-of-72', 'Estimated investment doubling time using the rule of 72', 1, {
    annual_rate_percent: 6
  }),
  billablePost('/v1/finance/roi', 'Return on investment percentage from cost and net gain', 1, {
    cost: 1000,
    net_gain: 250
  }),
  billablePost('/v1/finance/discount-calculator', 'Final price and savings from original price and discount rate', 1, {
    original_price: 120,
    discount_percent: 15
  }),
  billablePost('/v1/finance/markup-margin', 'Convert between gross margin and markup percentages', 1, {
    margin_percent: 40
  }),
  billablePost('/v1/finance/break-even', 'Break-even units from fixed costs, variable cost, and price', 1, {
    fixed_costs: 10000,
    price_per_unit: 50,
    variable_cost_per_unit: 30
  }),
  billablePost('/v1/finance/salestax', 'Add or extract sales tax/GST from an amount and tax rate', 1, {
    amount: 120,
    tax_rate_percent: 20,
    mode: 'inclusive'
  }),
  billablePost('/v1/finance/cagr', 'Compound annual growth rate from beginning value, ending value, and years', 1, {
    beginning_value: 1000,
    ending_value: 1500,
    years: 5
  }),
  billablePost('/v1/health/bmi', 'Body Mass Index and category classification', 1, {
    unit: 'metric',
    weight_kg: 70,
    height_cm: 175
  }),
  billablePost('/v1/health/bmr', 'Basal Metabolic Rate using Mifflin-St Jeor', 1, {
    unit: 'metric',
    weight_kg: 70,
    height_cm: 175,
    age: 35,
    sex: 'male'
  }),
  billablePost('/v1/health/tdee', 'Total Daily Energy Expenditure from BMR and activity multiplier', 1, {
    unit: 'metric',
    weight_kg: 70,
    height_cm: 175,
    age: 35,
    sex: 'male',
    activity_level: 'moderate'
  }),
  billablePost('/v1/health/macro-split', 'Protein, carbs, and fat grams from calories and macro percentages', 1, {
    calories: 2000,
    protein_percent: 30,
    carbs_percent: 40,
    fat_percent: 30
  }),
  billablePost('/v1/health/pace-calculator', 'Running or walking pace and speed from distance and duration', 1, {
    distance: 5,
    unit: 'km',
    minutes: 25
  }),
  billablePost('/v1/math/quadratic-solver', 'Solve a quadratic equation with real or complex roots and vertex coordinates', 1, {
    a: 1,
    b: -3,
    c: 2
  }),
  billablePost('/v1/math/pythagorean-solve', 'Solve the missing side of a right triangle from any two sides', 1, {
    a: 3,
    b: 4
  }),
  billablePost('/v1/math/triangle-heron', 'Triangle area, perimeter, and angles from three side lengths', 1, {
    a: 3,
    b: 4,
    c: 5
  }),
  billablePost('/v1/math/circle-geometry', 'Circle area, circumference, diameter, arc length, and sector area', 1, {
    radius: 10,
    angle_degrees: 90
  }),
  billablePost('/v1/math/sphere-geometry', 'Sphere diameter, surface area, and volume from radius', 1, {
    radius: 3
  }),
  billablePost('/v1/math/cylinder-geometry', 'Cylinder base area, surface area, and volume from radius and height', 1, {
    radius: 3,
    height: 10
  }),
  billablePost('/v1/math/statistics-summary', 'Mean, median, mode, variance, standard deviation, and IQR for numbers', 1, {
    values: [1, 2, 2, 4, 9]
  }),
  billablePost('/v1/math/percentage-change', 'Absolute and percentage change from baseline to current value', 1, {
    baseline: 80,
    current: 100
  }),
  billablePost('/v1/math/percent-error', 'Absolute, relative, and percent error against an accepted true value', 1, {
    true_value: 100,
    measured_value: 96
  }),
  billablePost('/v1/math/gcd-lcm', 'Greatest common divisor and least common multiple for integer sets', 1, {
    values: [12, 18, 30]
  }),
  billablePost('/v1/math/matrix-determinant', 'Determinants for 2x2 and 3x3 matrices', 1, {
    matrix: [[1, 2], [3, 4]]
  }),
  billablePost('/v1/math/proportion-solver', 'Solve x in equivalent ratios a/b = c/x', 1, {
    a: 2,
    b: 5,
    c: 8
  }),
  billablePost('/v1/math/logarithm-eval', 'Evaluate logarithms with custom bases using change of base', 1, {
    value: 1000,
    base: 10
  }),
  billablePost('/v1/math/exponent-eval', 'Evaluate exponentiation and optional real root extraction', 1, {
    base: 27,
    exponent: 2,
    root: 3
  }),
  billablePost('/v1/math/combinatorics', 'Permutations and combinations for n and r', 1, {
    n: 10,
    r: 3
  }),
  billablePost('/api/v1/math/ohm-law', 'Ohm law solver for voltage, current, resistance, and power', 1, { voltage: 12, resistance: 4 }),
  billablePost('/api/v1/math/projectile-range', 'Ideal projectile range, flight time, and max height', 1, { velocity: 30, angle_degrees: 45 }),
  billablePost('/api/v1/math/kinetic-energy', 'Kinetic energy from mass and velocity', 1, { mass: 10, velocity: 12 }),
  billablePost('/api/v1/math/potential-energy', 'Gravitational potential energy', 1, { mass: 10, height: 5 }),
  billablePost('/api/v1/math/circle-sector', 'Circle sector area, arc, and chord length', 1, { radius: 10, angle_degrees: 90 }),
  billablePost('/api/v1/math/sphere-surface', 'Sphere surface area and volume alias', 1, { radius: 3 }),
  billablePost('/api/v1/math/cone-geometry', 'Cone slant height, surface area, and volume', 1, { radius: 3, height: 4 }),
  billablePost('/api/v1/math/torus-geometry', 'Torus surface area and volume', 1, { major_radius: 5, minor_radius: 2 }),
  billablePost('/api/v1/math/arithmetic-progression', 'Arithmetic progression nth term and partial sum', 1, { first: 2, difference: 3, n: 10 }),
  billablePost('/api/v1/math/geometric-progression', 'Geometric progression nth term and partial sum', 1, { first: 2, ratio: 3, n: 5 }),
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
    description: 'CalculationTime v1 API for time, date, holiday, geospatial, solar, astronomy, finance, payroll, statistics, tradie accounting, tenant account, and webhook-management workflows.'
  },
  servers: [
    { url: 'https://api.calculationtime.com' },
    { url: 'http://127.0.0.1:4110' }
  ],
  paths,
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      BearerAuth: { type: 'http', scheme: 'bearer' }
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
