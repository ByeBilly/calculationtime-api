# CalculationTime API User Guide

Generated from the live CalculationTime API codebase and OpenAPI contract on 2026-09-21.

## Base URL And Connection Details

Production base URL:

```text
https://api.calculationtime.com
```

Local service URL on the Munich VPS:

```text
http://127.0.0.1:4110
```

Useful public probes:

```bash
curl 'https://api.calculationtime.com/health'
curl 'https://api.calculationtime.com/v1/status'
curl 'https://api.calculationtime.com/openapi.json'
```

The API is served by the `time-coordinate-api` Node/Fastify service on the Munich VPS. Public documentation is also exposed at `GET /`, and the machine-readable OpenAPI contract is at `GET /openapi.json`.

### Route Prefixes

Most CalculationTime API routes use `/v1/...`. Public reference-data endpoints are available in both forms:

- Canonical backend form: `/v1/data/...`
- Frontend/developer alias form: `/api/v1/data/...`

Both return the same style of JSON and make no external network calls at request time.

## Authentication

Most calculation endpoints are protected. Send an API key in either header form:

```http
Authorization: Bearer ct_live_your_key_here
```

Or:

```http
X-API-Key: ct_live_your_key_here
```

Recommended curl pattern:

```bash
export CALCULATIONTIME_API_KEY='ct_live_your_key_here'
curl 'https://api.calculationtime.com/v1/canary' \
  -H "Authorization: Bearer $CALCULATIONTIME_API_KEY"
```

Never place `ct_live_...` keys in public site code, screenshots, git commits, browser bundles, public docs, or client-side JavaScript. Public reference-data routes and status routes do not require a key.

Admin endpoints require a separate private admin key:

```http
X-Admin-Key: admin-key
```

Customer API keys cannot call admin endpoints.

## Rate Limits, Quotas, And Credits

The API uses minute buckets. Defaults from the current codebase:

- Public routes: 60 requests per minute per client IP, unless configured otherwise.
- Customer API-key routes: 120 requests per minute by default, with per-customer overrides supported.
- Some customers have explicit trial windows and credit balances in the persistent key store.

Every response includes rate-limit headers when the relevant limiter is applied:

```http
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 119
X-RateLimit-Reset: 1789948860
```

When a limit is exceeded, the API returns `429` and includes:

```http
Retry-After: 14
```

Billable protected endpoints carry credit costs. Most lightweight pure-math endpoints cost 1 credit. Heavier routes such as full amortization, Crux hourly tables, and some tradie/accounting calculations cost more. The live OpenAPI contract includes `x-credit-cost` where configured.

Check account state with:

```bash
curl 'https://api.calculationtime.com/v1/account/credits' \
  -H "Authorization: Bearer $CALCULATIONTIME_API_KEY"
```

Typical response:

```json
{
  "customer_id": "customer_id",
  "status": "active",
  "plan": { "rate_limit_per_minute": 120 },
  "usage": { "requests_this_month": 42 },
  "credits": {
    "configured": true,
    "balance": 999950,
    "unit": "api_credit"
  }
}
```

## Error Handling

All normal API errors use this JSON shape:

```json
{
  "error": {
    "code": "invalid_number",
    "message": "lat must be a finite number"
  }
}
```

Standard statuses:

| Status | Meaning | Common cause |
|---|---|---|
| 400 | Invalid request input | Missing field, invalid date, out-of-range number, malformed domain value |
| 401 | Unauthorized | Missing or invalid API key on a protected route |
| 402 | Payment required | Credit balance exhausted |
| 403 | Forbidden | Suspended account or expired trial |
| 404 | Not found | Unknown route, missing share token, missing account/customer |
| 429 | Rate limited | Public IP or customer key exceeded per-minute bucket |
| 500 | Internal server error | Unexpected server failure |
| 503 | Service unavailable | Optional store/provider not configured or temporarily unavailable |

Malformed JSON bodies return:

```json
{
  "error": {
    "code": "invalid_json",
    "message": "Request body must be valid JSON"
  }
}
```

## Public vs Protected Quick Map

Public routes:

- `GET /`
- `GET /health`
- `GET /openapi.json`
- `GET /v1/status`
- `GET /v1/time/utc`
- `GET /api/v1/utility/tagline`
- `GET /v1/data/...` and `GET /api/v1/data/...` reference-data routes
- `POST /v1/observatory/share` and `GET /v1/observatory/share/{token}`

Protected customer routes:

- `GET /v1/canary`
- `GET /v1/account/...`
- All core calculation routes under `/v1/time`, `/v1/date`, `/v1/geo`, `/v1/solar`, `/v1/astronomy`, `/v1/finance`, `/v1/health`, `/v1/math`, `/v1/stats`, `/v1/payroll`, and `/v1/tradie`.

Admin routes:

- `/v1/admin/...`, using `X-Admin-Key`.

## High-Value Examples

### GET `/v1/status`

Public measured service status and endpoint inventory

Auth: **Public**  
Inputs: -

```bash
curl 'https://api.calculationtime.com/v1/status'
```

Sample response shape:

```json
{
  "ok": true,
  "service": "time-coordinate-api",
  "endpoint_families": [
    {
      "family": "data",
      "routes": [
        "GET /v1/data/countries"
      ]
    }
  ],
  "sla_claimed": false
}
```

### GET `/v1/data/materials/density`

Common material density reference table

Auth: **Public**  
Inputs: -

```bash
curl 'https://api.calculationtime.com/v1/data/materials/density?q=steel'
```

Sample response shape:

```json
{
  "dataset_version": "2026-09-21",
  "source": "bundled_reference_data",
  "count": 1,
  "data": [
    {
      "example": "see endpoint output for schema-specific fields"
    }
  ]
}
```

### GET `/api/v1/data/timezones`

Alias: IANA timezone reference

Auth: **Public**  
Inputs: -

```bash
curl 'https://api.calculationtime.com/api/v1/data/timezones?q=Australia/Sydney&at=2026-09-21T00:00:00Z'
```

Sample response shape:

```json
{
  "dataset_version": "2026-09-21",
  "source": "bundled_reference_data",
  "count": 1,
  "data": [
    {
      "example": "see endpoint output for schema-specific fields"
    }
  ]
}
```

### GET `/v1/time`

Get local time for one coordinate

Auth: **API key**  
Inputs: lat, lon, at

```bash
curl 'https://api.calculationtime.com/v1/time?lat=48.137154&lon=11.576124&at=2026-07-29T12:00:00Z' \
  -H 'Authorization: Bearer ct_live_your_key_here'
```

Sample response shape:

```json
{
  "input": {},
  "result": {},
  "method": "see endpoint-specific response"
}
```

### POST `/v1/date/business-days-add`

Add or subtract configurable business days

Auth: **API key**  
Inputs: JSON body shown below

```bash
curl -X POST 'https://api.calculationtime.com/v1/date/business-days-add' \
  -H 'Authorization: Bearer ct_live_your_key_here' \
  -H 'Content-Type: application/json' \
  -d '{"start":"2026-07-13","business_days":10,"weekend_days":[6,7],"holidays":["2026-07-20"]}'
```

Sample request body:

```json
{
  "start": "2026-07-13",
  "business_days": 10,
  "weekend_days": [
    6,
    7
  ],
  "holidays": [
    "2026-07-20"
  ]
}
```

Sample response shape:

```json
{
  "input": {},
  "result": {},
  "method": "deterministic_date_math"
}
```

### GET `/v1/astronomy/ephemeris`

Astronomy ephemeris for a date

Auth: **API key**  
Inputs: date

```bash
curl 'https://api.calculationtime.com/v1/astronomy/ephemeris?date=2029-10-21' \
  -H 'Authorization: Bearer ct_live_your_key_here'
```

Sample response shape:

```json
{
  "input": {},
  "result": {},
  "method": "deterministic_astronomy_approximation"
}
```

### POST `/v1/astronomy/crux-current`

Current Crux clock hand position and Parkes alignment delta

Auth: **API key**  
Inputs: JSON body shown below

```bash
curl -X POST 'https://api.calculationtime.com/v1/astronomy/crux-current' \
  -H 'Authorization: Bearer ct_live_your_key_here' \
  -H 'Content-Type: application/json' \
  -d '{"timestamp":"2026-04-01T00:00:00+10:00"}'
```

Sample request body:

```json
{
  "timestamp": "2026-04-01T00:00:00+10:00"
}
```

Sample response shape:

```json
{
  "input": {},
  "position_degrees": 0.985647366,
  "sidereal_time": {},
  "method": "crux_sidereal_engine"
}
```

### POST `/v1/finance/loan-amortization-summary`

Loan payment, total interest, and total cost summary

Auth: **API key**  
Inputs: JSON body shown below

```bash
curl -X POST 'https://api.calculationtime.com/v1/finance/loan-amortization-summary' \
  -H 'Authorization: Bearer ct_live_your_key_here' \
  -H 'Content-Type: application/json' \
  -d '{"principal":250000,"annual_interest_rate_percent":6.25,"term_months":360}'
```

Sample request body:

```json
{
  "principal": 250000,
  "annual_interest_rate_percent": 6.25,
  "term_months": 360
}
```

Sample response shape:

```json
{
  "input": {},
  "result": {},
  "method": "finance_formula"
}
```

### POST `/v1/math/statistics-summary`

Mean, median, mode, variance, standard deviation, and IQR for numbers

Auth: **API key**  
Inputs: JSON body shown below

```bash
curl -X POST 'https://api.calculationtime.com/v1/math/statistics-summary' \
  -H 'Authorization: Bearer ct_live_your_key_here' \
  -H 'Content-Type: application/json' \
  -d '{"values":[1,2,2,4,9]}'
```

Sample request body:

```json
{
  "values": [
    1,
    2,
    2,
    4,
    9
  ]
}
```

Sample response shape:

```json
{
  "input": {},
  "result": {},
  "method": "math_formula"
}
```

### GET `/v1/canary`

Protected monitoring canary for API-key path checks

Auth: **API key**  
Inputs: -

```bash
curl 'https://api.calculationtime.com/v1/canary' \
  -H 'Authorization: Bearer ct_live_your_key_here'
```

Sample response shape:

```json
{
  "ok": true,
  "service": "time-coordinate-api",
  "canary": "protected_endpoint_reachable",
  "customer_id": "customer_id",
  "timestamp": "2026-09-21T00:00:00.000Z"
}
```

### GET `/v1/account/credits`

Authenticated customer credit balance

Auth: **API key**  
Inputs: -

```bash
curl 'https://api.calculationtime.com/v1/account/credits' \
  -H 'Authorization: Bearer ct_live_your_key_here'
```

Sample response shape:

```json
{
  "customer_id": "customer_id",
  "status": "active",
  "credits": {
    "configured": true,
    "balance": 999950,
    "unit": "api_credit"
  }
}
```


# Endpoint Reference

The following catalog is generated from the current OpenAPI contract. For POST routes, the example body shown is the documented sample request body. For GET routes, query parameters are listed where the OpenAPI generator declares them; public reference-data routes also support practical filters such as `q`, `limit`, and route-specific filters like `extension` for MIME types and `at` for timezones.

## Public status/docs

| Method | Path | Auth | Parameters / body | Summary |
|---|---|---|---|---|
| GET | `/` | Public | - | Markdown API documentation |
| GET | `/health` | Public | - | Low-level service health |
| GET | `/openapi.json` | Public | - | OpenAPI contract for live routes |
| GET | `/v1/status` | Public | - | Public measured service status and endpoint inventory |
| GET | `/v1/time/utc` | Public | - | Current UTC timestamp and clock-model metadata |
| GET | `/api/v1/utility/tagline` | Public | - | Deterministic daily CalculationTime tagline |

## Public reference data

| Method | Path | Auth | Parameters / body | Summary |
|---|---|---|---|---|
| GET | `/v1/data/countries` | Public | - | Country reference table with capitals, ISO codes, dialing codes, and currencies |
| GET | `/v1/data/timezones` | Public | - | IANA timezone reference with current UTC offsets and DST status |
| GET | `/v1/data/elements` | Public | - | Periodic table reference values |
| GET | `/v1/data/constants` | Public | - | Physical and mathematical constants reference table |
| GET | `/v1/data/materials/density` | Public | - | Common material density reference table |
| GET | `/v1/data/http-status` | Public | - | HTTP status code directory |
| GET | `/v1/data/mime-types` | Public | - | MIME type and extension reference table |
| GET | `/v1/data/unicode-blocks` | Public | - | Unicode block range reference table |
| GET | `/v1/data/constellations` | Public | - | IAU constellation names, genitives, abbreviations, and quadrants |
| GET | `/v1/data/stars/bright` | Public | - | Bright star reference table |
| GET | `/v1/data/meteor-showers` | Public | - | Major annual meteor shower reference table |
| GET | `/api/v1/data/countries` | Public | - | Alias: country reference table |
| GET | `/api/v1/data/timezones` | Public | - | Alias: IANA timezone reference |
| GET | `/api/v1/data/elements` | Public | - | Alias: periodic table reference values |
| GET | `/api/v1/data/constants` | Public | - | Alias: physical and mathematical constants |
| GET | `/api/v1/data/materials/density` | Public | - | Alias: common material density reference table |
| GET | `/api/v1/data/http-status` | Public | - | Alias: HTTP status code directory |
| GET | `/api/v1/data/mime-types` | Public | - | Alias: MIME type and extension reference table |
| GET | `/api/v1/data/unicode-blocks` | Public | - | Alias: Unicode block range reference table |
| GET | `/api/v1/data/constellations` | Public | - | Alias: IAU constellation reference |
| GET | `/api/v1/data/stars/bright` | Public | - | Alias: bright star reference table |
| GET | `/api/v1/data/meteor-showers` | Public | - | Alias: major annual meteor shower reference table |

## Time, date, holiday, geo, solar

| Method | Path | Auth | Parameters / body | Summary |
|---|---|---|---|---|
| GET | `/v1/time/utc` | Public | - | Current UTC timestamp and clock-model metadata |
| GET | `/v1/time` | API key | lat, lon, at | Get local time for one coordinate |
| POST | `/v1/time/batch` | API key | `{"points":[{"lat":48.137154,"lon":11.576124}],"at":"2026-07-29T12:00:00Z"}` | Get local time for up to 100 coordinates |
| GET | `/v1/date/difference` | API key | start, end | Calendar day difference |
| POST | `/v1/date/difference/batch` | API key | `{"ranges":[{"start":"2026-07-12","end":"2026-08-01"}]}` | Batch calendar day differences |
| GET | `/v1/date/add` | API key | date, days, months, years | Add calendar units to a date |
| POST | `/v1/date/business-days` | API key | `{"start":"2026-07-13","end":"2026-07-17","holidays":["2026-07-15"]}` | Business-day count with supplied holidays |
| POST | `/v1/date/business-days/jurisdiction` | API key | `{"start":"2026-07-13","end":"2026-07-17","jurisdiction":"US"}` | Business-day count for a supported jurisdiction |
| POST | `/v1/date/business-days-add` | API key | `{"start":"2026-07-13","business_days":10,"weekend_days":[6,7],"holidays":["2026-07-20"]}` | Add or subtract configurable business days |
| POST | `/v1/date/iso-week` | API key | `{"date":"2026-01-01"}` | ISO week number, week-year, and weekday |
| POST | `/v1/date/age-breakdown` | API key | `{"birth_date":"1990-05-15","as_of":"2026-09-21T00:00:00Z"}` | Exact age duration breakdown from birth date to timestamp |
| POST | `/v1/date/countdown-precise` | API key | `{"start":"2026-09-21T00:00:00Z","end":"2027-01-01T12:30:15Z"}` | Precise calendar delta between timestamps |
| POST | `/v1/date/epoch-converter` | API key | `{"epoch":1789941600,"unit":"seconds"}` | Unix epoch seconds or milliseconds to ISO/RFC strings |
| POST | `/v1/date/quarter-calculator` | API key | `{"date":"2026-09-21","fiscal_start_month":4}` | Calendar and fiscal quarter with progress percentage |
| POST | `/v1/date/leap-year-check` | API key | `{"year":2028}` | Gregorian and Julian leap-year proof check |
| POST | `/v1/date/days-in-month` | API key | `{"year":2028,"month":2}` | Days in a Gregorian month |
| POST | `/v1/date/timezone-offset` | API key | `{"timestamp":"2026-09-21T00:00:00Z","offset":"+10:00"}` | Fixed UTC offset conversion without DST lookup |
| POST | `/v1/date/calendar-range` | API key | `{"start":"2026-09-21","days":14,"weekend_days":[6,7]}` | Generate a deterministic date range with weekday and ISO week facts |
| GET | `/v1/holidays` | API key | jurisdiction, year | Holidays for a jurisdiction and year |
| GET | `/v1/holidays/next` | API key | jurisdiction, from | Next holiday for a jurisdiction |
| GET | `/v1/holidays/is-business-day` | API key | jurisdiction, date | Business-day check for one date |
| GET | `/v1/geo/distance` | API key | lat1, lon1, lat2, lon2 | Distance between two coordinates |
| POST | `/v1/geo/distance/batch` | API key | `{"pairs":[{"from":{"lat":48.137154,"lon":11.576124},"to":{"lat":51.5072,"lon":-0.1276}}]}` | Batch distance calculations |
| GET | `/v1/geo/midpoint` | API key | lat1, lon1, lat2, lon2 | Midpoint between two coordinates |
| GET | `/v1/geo/bounding-box` | API key | lat, lon, radius_km | Bounding box around a coordinate |
| GET | `/v1/geo/elevation` | API key | lat, lon | Elevation for one coordinate |
| GET | `/v1/geo/nearby` | API key | lat, lon, radius_km | Nearby stored geo points |
| GET | `/v1/solar/position` | API key | lat, lon, at | Solar position for date and coordinate |

## Astronomy and Crux engines

| Method | Path | Auth | Parameters / body | Summary |
|---|---|---|---|---|
| GET | `/v1/astronomy/ephemeris` | API key | date | Astronomy ephemeris for a date |
| POST | `/v1/astronomy/crux-midnight` | API key | `{"start_date":"2026-03-31","days":365,"timezone":"+10:00"}` | Crux clock hand midnight sidereal positions from Parkes Observatory calibration |
| POST | `/v1/astronomy/crux-hourly` | API key | `{"date":"2026-03-31","timezone":"+10:00"}` | Crux clock hand hourly sidereal breakdown for one local date |
| POST | `/v1/astronomy/crux-current` | API key | `{"timestamp":"2026-04-01T00:00:00+10:00"}` | Current Crux clock hand position and Parkes alignment delta |
| POST | `/v1/astronomy/solar-noon` | API key | `{"date":"2026-06-21","lat":48.137154,"lon":11.576124}` | Solar transit/noon timestamp for a coordinate and date |
| POST | `/v1/astronomy/equinox-solstice` | API key | `{"year":2026}` | Equinox and solstice timestamps for a year |
| POST | `/v1/astronomy/moon-phase` | API key | `{"timestamp":"2026-06-21T00:00:00Z"}` | Moon illumination, age, and phase name for a timestamp |
| POST | `/v1/astronomy/julian-date` | API key | `{"timestamp":"2026-06-21T00:00:00Z"}` | Gregorian timestamp to Julian Day and Modified Julian Date |
| POST | `/v1/astronomy/sidereal-time` | API key | `{"timestamp":"2026-06-21T00:00:00Z","lon":11.576124}` | Greenwich and local sidereal time for a timestamp and longitude |
| POST | `/v1/astronomy/twilight-calculator` | API key | `{"date":"2026-06-21","lat":48.137154,"lon":11.576124}` | Civil, nautical, and astronomical twilight crossings |
| POST | `/v1/astronomy/sun-position` | API key | `{"timestamp":"2026-06-21T12:00:00Z","lat":48.137154,"lon":11.576124}` | Sun right ascension, declination, azimuth, and elevation |
| POST | `/v1/astronomy/moon-position` | API key | `{"timestamp":"2026-06-21T00:00:00Z","lat":48.137154,"lon":11.576124}` | Moon right ascension, declination, azimuth, and elevation |
| POST | `/v1/astronomy/day-length` | API key | `{"date":"2026-06-21","lat":48.137154,"lon":11.576124}` | Daylight duration between sunrise and sunset |
| POST | `/v1/astronomy/polar-night-check` | API key | `{"date":"2026-06-21","lat":80,"lon":0}` | Check midnight sun or polar night state for a latitude/date |

## Finance, health, math, stats, payroll, tradie

| Method | Path | Auth | Parameters / body | Summary |
|---|---|---|---|---|
| POST | `/v1/finance/margin-markup` | API key | `{"cost":80,"selling_price":125,"actual_cost":92}` | Gross margin, markup, selling price, and cost variance |
| POST | `/v1/finance/loan-amortization` | API key | `{"principal":250000,"annual_interest_rate_percent":6.25,"term_months":360}` | Fixed-rate loan amortization schedule |
| POST | `/v1/finance/tax-extraction` | API key | `{"amounts":[{"label":"VAT inclusive","amount":120,"tax_rate_percent":20,"mode":"inclusive"}]}` | Tax add-on and inclusive reverse extraction |
| POST | `/v1/finance/freelancer-rate` | API key | `{"target_annual_income":80000,"annual_expenses":20000,"tax_overhead_percent":25,"billable_weeks":40,"billable_hours_per_week":25}` | Freelancer hourly and daily rate target |
| POST | `/v1/finance/simple-interest` | API key | `{"principal":1000,"annual_rate_percent":5,"years":3}` | Simple interest from principal, rate, and time |
| POST | `/v1/finance/compound-interest` | API key | `{"principal":1000,"annual_rate_percent":5,"years":10,"compounds_per_year":12}` | Future value with compound interest frequency options |
| POST | `/v1/finance/loan-amortization-summary` | API key | `{"principal":250000,"annual_interest_rate_percent":6.25,"term_months":360}` | Loan payment, total interest, and total cost summary |
| POST | `/v1/finance/rule-of-72` | API key | `{"annual_rate_percent":6}` | Estimated investment doubling time using the rule of 72 |
| POST | `/v1/finance/roi` | API key | `{"cost":1000,"net_gain":250}` | Return on investment percentage from cost and net gain |
| POST | `/v1/finance/discount-calculator` | API key | `{"original_price":120,"discount_percent":15}` | Final price and savings from original price and discount rate |
| POST | `/v1/finance/markup-margin` | API key | `{"margin_percent":40}` | Convert between gross margin and markup percentages |
| POST | `/v1/finance/break-even` | API key | `{"fixed_costs":10000,"price_per_unit":50,"variable_cost_per_unit":30}` | Break-even units from fixed costs, variable cost, and price |
| POST | `/v1/finance/salestax` | API key | `{"amount":120,"tax_rate_percent":20,"mode":"inclusive"}` | Add or extract sales tax/GST from an amount and tax rate |
| POST | `/v1/finance/cagr` | API key | `{"beginning_value":1000,"ending_value":1500,"years":5}` | Compound annual growth rate from beginning value, ending value, and years |
| POST | `/v1/health/bmi` | API key | `{"unit":"metric","weight_kg":70,"height_cm":175}` | Body Mass Index and category classification |
| POST | `/v1/health/bmr` | API key | `{"unit":"metric","weight_kg":70,"height_cm":175,"age":35,"sex":"male"}` | Basal Metabolic Rate using Mifflin-St Jeor |
| POST | `/v1/health/tdee` | API key | `{"unit":"metric","weight_kg":70,"height_cm":175,"age":35,"sex":"male","activity_level":"moderate"}` | Total Daily Energy Expenditure from BMR and activity multiplier |
| POST | `/v1/health/macro-split` | API key | `{"calories":2000,"protein_percent":30,"carbs_percent":40,"fat_percent":30}` | Protein, carbs, and fat grams from calories and macro percentages |
| POST | `/v1/health/pace-calculator` | API key | `{"distance":5,"unit":"km","minutes":25}` | Running or walking pace and speed from distance and duration |
| POST | `/v1/math/quadratic-solver` | API key | `{"a":1,"b":-3,"c":2}` | Solve a quadratic equation with real or complex roots and vertex coordinates |
| POST | `/v1/math/pythagorean-solve` | API key | `{"a":3,"b":4}` | Solve the missing side of a right triangle from any two sides |
| POST | `/v1/math/triangle-heron` | API key | `{"a":3,"b":4,"c":5}` | Triangle area, perimeter, and angles from three side lengths |
| POST | `/v1/math/circle-geometry` | API key | `{"radius":10,"angle_degrees":90}` | Circle area, circumference, diameter, arc length, and sector area |
| POST | `/v1/math/sphere-geometry` | API key | `{"radius":3}` | Sphere diameter, surface area, and volume from radius |
| POST | `/v1/math/cylinder-geometry` | API key | `{"radius":3,"height":10}` | Cylinder base area, surface area, and volume from radius and height |
| POST | `/v1/math/statistics-summary` | API key | `{"values":[1,2,2,4,9]}` | Mean, median, mode, variance, standard deviation, and IQR for numbers |
| POST | `/v1/math/percentage-change` | API key | `{"baseline":80,"current":100}` | Absolute and percentage change from baseline to current value |
| POST | `/v1/math/percent-error` | API key | `{"true_value":100,"measured_value":96}` | Absolute, relative, and percent error against an accepted true value |
| POST | `/v1/math/gcd-lcm` | API key | `{"values":[12,18,30]}` | Greatest common divisor and least common multiple for integer sets |
| POST | `/v1/math/matrix-determinant` | API key | `{"matrix":[[1,2],[3,4]]}` | Determinants for 2x2 and 3x3 matrices |
| POST | `/v1/math/proportion-solver` | API key | `{"a":2,"b":5,"c":8}` | Solve x in equivalent ratios a/b = c/x |
| POST | `/v1/math/logarithm-eval` | API key | `{"value":1000,"base":10}` | Evaluate logarithms with custom bases using change of base |
| POST | `/v1/math/exponent-eval` | API key | `{"base":27,"exponent":2,"root":3}` | Evaluate exponentiation and optional real root extraction |
| POST | `/v1/math/combinatorics` | API key | `{"n":10,"r":3}` | Permutations and combinations for n and r |
| POST | `/v1/stats/summary` | API key | `{"values":[1,2,2,4,9]}` | Descriptive statistics for a numeric dataset |
| POST | `/v1/payroll/decimal-hours` | API key | `{"hours":1,"minutes":30,"overtime_multiplier":1.5}` | Clock time to decimal hours and overtime conversion |
| POST | `/v1/tradie/job-margin` | API key | `{"labour_hours":16,"labour_rate":45,"materials_cost":380,"subcontractor_cost":250,"overhead_percent":12,"quoted_price":2200}` | Tradie job margin from labour, materials, subcontractors, overhead, and quote |
| POST | `/v1/tradie/vat-return-summary` | API key | `{"sales":[{"amount":1200,"tax_rate_percent":20,"mode":"inclusive"}],"purchases":[{"amount":300,"tax_rate_percent":20,"mode":"exclusive"}]}` | Tradie VAT return summary from sales and purchases |
| POST | `/v1/tradie/cis-deduction` | API key | `{"gross_labour":1000,"materials":200,"deduction_rate_percent":20}` | UK CIS-style deduction model for labour and materials |
| POST | `/v1/tradie/mileage-claim` | API key | `{"miles":120,"rate_per_mile":0.45,"reimbursed_amount":20}` | Mileage claim and unreimbursed/reimbursed excess calculation |
| POST | `/v1/tradie/tool-depreciation` | API key | `{"purchase_price":1200,"salvage_value":200,"useful_life_years":5}` | Straight-line tool and equipment depreciation schedule |
| POST | `/v1/tradie/invoice-aging` | API key | `{"as_of":"2026-09-19","invoices":[{"invoice_id":"INV-1","due_date":"2026-08-01","amount":400}]}` | Receivables aging buckets for unpaid invoices |

## Account, admin, observatory

| Method | Path | Auth | Parameters / body | Summary |
|---|---|---|---|---|
| GET | `/v1/canary` | API key | - | Protected monitoring canary for API-key path checks |
| GET | `/v1/account/profile` | API key | - | Authenticated customer profile |
| GET | `/v1/account/usage` | API key | - | Authenticated customer usage summary |
| GET | `/v1/account/limits` | API key | - | Authenticated customer plan and batch limits |
| GET | `/v1/account/credits` | API key | - | Authenticated customer credit balance |
| GET | `/v1/admin/customers` | Admin key | limit, include_inactive | Admin customer list and usage summary |
| POST | `/v1/admin/customers` | Admin key | `{"customer_id":"taxserve-demo","display_name":"Tax Serve Demo","rate_limit_per_minute":240,"status":"active"}` | Admin create or update customer |
| GET | `/v1/admin/customers/{customer_id}` | Admin key | customer_id (required) | Admin customer detail |
| POST | `/v1/admin/customers/{customer_id}/credits` | Admin key | `{"delta":1000000,"reason":"trial grant","reference":"manual:onboarding","metadata":{"trial_ends_at":"2027-09-19T00:00:00.000Z"}}` | Admin append credit ledger event |
| GET | `/v1/admin/customers/{customer_id}/credits` | Admin key | customer_id (required), limit | Admin customer credit ledger |
| GET | `/v1/admin/customers/{customer_id}/webhooks` | Admin key | customer_id (required) | Admin list customer webhooks |
| PUT | `/v1/admin/customers/{customer_id}/webhooks` | Admin key | `{"event_type":"calculation.heavy.completed","destination_url":"https://integrator.example/webhooks/calculationtime","status":"active"}` | Admin register or update customer webhook |
| POST | `/v1/observatory/share` | Public | `{"poster":"moment","date":"2026-08-01","ttl_days":7}` | Create private Observatory share token |
| GET | `/v1/observatory/share/{token}` | Public | token (required) | Resolve private Observatory share token |


## Webhooks

Tenant webhooks can be configured by admin endpoints for the event type:

```text
calculation.heavy.completed
```

Webhook-eligible heavy routes include current finance/tradie/statistics routes such as full loan amortization, tax extraction, stats summary, VAT return summary, tool depreciation, and invoice aging. Dispatch is non-blocking: webhook failure is logged but does not fail the customer calculation response.

## Safety And Accuracy Notes

- Timezone results depend on the server runtime's IANA timezone database.
- Astronomy, moon, solar, and Crux endpoints are calculation support tools, not navigation certification.
- Health endpoints are arithmetic reference tools, not medical advice.
- Finance and payroll endpoints are formula calculators, not tax, investment, legal, or payroll compliance advice.
- Material densities and reference tables are suitable for estimates and developer tools; certified engineering work needs source-specific material specifications.

## Machine-Readable Contract

Always prefer the live OpenAPI contract for generated clients and exact route inventory:

```bash
curl 'https://api.calculationtime.com/openapi.json'
```
