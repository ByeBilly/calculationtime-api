# CalculationTime API

Reliable time, date, geo, holiday, solar, astronomy, and utility calculations for apps, websites, dashboards, and AI agents.

Base URL:

```text
https://api.calculationtime.com
```

The API is built around visible assumptions and auditable calculation methods. It is useful when a product needs more than a loose snippet: scheduling rules, local time, business-day windows, geospatial estimates, solar geometry, or calculation utilities that should be repeatable and explainable.

New to APIs? Start with the clickable [`GET /learn`](https://api.calculationtime.com/learn) page, then [`GET /beginner`](https://api.calculationtime.com/beginner) or [`docs/beginner-api-gateway.md`](./beginner-api-gateway.md). These start with button-led public learning demos before introducing keys, curl, JSON, or the full contract.

For the current running route inventory, see [`docs/running-endpoints-directory.md`](./running-endpoints-directory.md). It is generated from the OpenAPI contract after the live service has loaded the latest code.

For endpoint creation and pruning rules, see [`docs/api-governance-rulebook.md`](./api-governance-rulebook.md). New routes must pass all four gates in that rulebook before implementation.

## Public Demo Endpoint

### `GET /v1/time/utc`

Returns the API host's current UTC timestamp, Unix seconds, Unix milliseconds, and clock-accuracy wording. This is public and exists for proof/status surfaces, not as a hard SLA statement.

```bash
curl 'https://api.calculationtime.com/v1/time/utc'
```

### `GET /v1/status`

Returns live service status, route-family inventory, uptime for the current API process, and measured-status wording. This endpoint deliberately reports that no public SLA is claimed yet.

```bash
curl 'https://api.calculationtime.com/v1/status'
```

### `GET /api/v1/utility/tagline`

Returns one deterministic daily tagline for the current UTC date. It is public, lightweight, and edge-cacheable.

```bash
curl 'https://api.calculationtime.com/api/v1/utility/tagline'
```

Example response:

```json
{
  "date": "2026-07-29",
  "tagline": "Pi never repeats itself, but it keeps the circle honest.",
  "category": "Mathematical Anomalies"
}
```

The selected tagline is seeded by `YYYY-MM-DD` in UTC, so every user receives the same line for the same global calendar day.

## Public Reference Data Endpoints

These endpoints are public, cacheable JSON reference tables designed for developer docs, dropdowns, calculators, and lightweight lookup tools. Most support `q` text filtering and `limit`.

```bash
curl 'https://api.calculationtime.com/api/v1/data/countries?q=aus'
curl 'https://api.calculationtime.com/api/v1/data/materials/density?q=steel'
curl 'https://api.calculationtime.com/api/v1/data/mime-types?extension=json'

curl 'https://api.calculationtime.com/v1/data/countries?q=aus'
curl 'https://api.calculationtime.com/v1/data/timezones?q=Australia&at=2026-09-21T00:00:00Z'
curl 'https://api.calculationtime.com/v1/data/elements?q=oxygen'
curl 'https://api.calculationtime.com/v1/data/constants?q=planck'
curl 'https://api.calculationtime.com/v1/data/materials/density?q=aluminium'
curl 'https://api.calculationtime.com/v1/data/http-status?q=429'
curl 'https://api.calculationtime.com/v1/data/mime-types?extension=json'
curl 'https://api.calculationtime.com/v1/data/unicode-blocks?q=currency'
curl 'https://api.calculationtime.com/v1/data/constellations?q=crux'
curl 'https://api.calculationtime.com/v1/data/stars/bright?q=sirius'
curl 'https://api.calculationtime.com/v1/data/meteor-showers?q=perseids'
```

Current reference-data routes:

- `GET /v1/data/countries`
- `GET /v1/data/timezones`
- `GET /v1/data/elements`
- `GET /v1/data/constants`
- `GET /v1/data/materials/density`
- `GET /v1/data/http-status`
- `GET /v1/data/mime-types`
- `GET /v1/data/unicode-blocks`
- `GET /v1/data/constellations`
- `GET /v1/data/stars/bright`
- `GET /v1/data/meteor-showers`

The same data routes are also available under `/api/v1/data/...` for frontend and documentation workflows that expect the API prefix.

Reference data is bundled into the API deployment or generated from the host runtime's ICU/tzdb. These endpoints make no external network calls at request time.

## API Families

- Time by coordinate.
- Geospatial calculations.
- Date calculations.
- Holiday/business-day helpers.
- Solar position calculations.
- Astronomy ephemeris calculations.
- Public reference data.
- Account credits and usage visibility.
- Observatory private share links.
- Daily utility content.

## Accuracy Model

This API does not estimate time from longitude. It resolves the coordinate to an IANA timezone identifier using geographic timezone boundary lookup, then calculates local time with IANA timezone rules from the server runtime.

This matters because real time is political as well as geographic: daylight saving rules, island territories, border towns, and historical rule changes cannot be handled by simple UTC offset math.

## Time Endpoints

### `GET /v1/time`

Query parameters:

- `lat`: latitude, `-90` to `90`.
- `lon`: longitude, `-180` to `180`.
- `at`: optional ISO-8601 timestamp, epoch seconds, or epoch milliseconds. Defaults to now.

Example:

```bash
curl 'https://api.calculationtime.com/v1/time?lat=48.137154&lon=11.576124&at=2026-07-29T12:00:00Z' \
  -H 'X-API-Key: your-key'
```

### `POST /v1/time/batch`

Body:

```json
{
  "at": "2026-07-12T12:00:00Z",
  "points": [
    { "lat": 48.137154, "lon": 11.576124 },
    { "lat": -33.8688, "lon": 151.2093 }
  ]
}
```

Maximum batch size: 100 points.

### `GET /health`

Basic service health response. Public.

### `GET /v1/canary`

Protected monitoring endpoint for external uptime probes that need to verify the API-key path as well as the public health path.

```bash
curl 'https://api.calculationtime.com/v1/canary' \
  -H 'X-API-Key: monitoring-key'
```

Use a private monitoring-only key for this endpoint. Do not place that key in public site code, public docs, screenshots, or client-side JavaScript.

## Account Endpoint

### `GET /v1/account/profile`

Returns the authenticated customer's account identity, plan rate limit, and which account features are backed by persistent storage.

```bash
curl 'https://api.calculationtime.com/v1/account/profile' \
  -H 'X-API-Key: your-key'
```

This is the safest endpoint for a customer dashboard or agent to verify that a key works without running a calculation.

### `GET /v1/account/usage`

Returns current-month usage totals and a per-route breakdown when the persistent usage database is configured.

```bash
curl 'https://api.calculationtime.com/v1/account/usage' \
  -H 'X-API-Key: your-key'
```

If the API is running with environment-only keys, the endpoint returns `usage.configured: false` rather than inventing request history.

### `GET /v1/account/limits`

Returns the authenticated customer's rate limit and documented batch limits.

```bash
curl 'https://api.calculationtime.com/v1/account/limits' \
  -H 'X-API-Key: your-key'
```

### `GET /v1/account/credits`

Returns the authenticated customer's account status, rate limit, current-month request count, and API credit balance when the persistent credit ledger is configured.

```bash
curl 'https://api.calculationtime.com/v1/account/credits' \
  -H 'X-API-Key: your-key'
```

If the API is running with environment-only keys or without the credit ledger table, the endpoint returns `credits.configured: false` and does not invent a balance.

To enable database-backed credits, apply:

```text
docs/credit-ledger-schema.sql
```

## Commercial Enforcement

Protected calculation endpoints are billable. Before a billable request runs, the API checks that the authenticated customer is active, has not passed a recorded trial expiry, and has a positive API-credit balance. Successful billable responses append a `-1` `billable_request` event to `calculationtime_api.credit_ledger`.

Default developer onboarding is intentionally generous:

- Trial length: `365` days.
- Trial grant: `1,000,000` API credits.
- Trial expiry is stored in credit-ledger metadata as `trial_ends_at`.

Server-side onboarding command:

```bash
node scripts/onboard-trial-customer.js \
  --customer customer_slug \
  --name "Customer Name" \
  --reference "source-or-sales-note"
```

The onboarding command prints the raw API key once. Store it securely outside chat, public logs, screenshots, or client-side code.

Free routes remain unaffected:

- `GET /`
- `GET /health`
- `GET /openapi.json`
- `GET /v1/status`
- `GET /v1/time/utc`
- `GET /api/v1/utility/tagline`
- Protected account visibility routes.
- Protected monitoring canary.

Commercial errors:

- `403 trial_expired`: recorded trial window has lapsed.
- `403 account_suspended`: customer status is not active.
- `402 credits_exhausted`: credit balance is zero or below.

Server-side reports:

```bash
node scripts/export-customer-summary.js
node scripts/export-customer-summary.js --format json
node scripts/export-customer-summary.js --format csv
```

## Observatory Share Endpoints

### `POST /v1/observatory/share`

Creates an unlisted private share token for Observatory/Orrery links. The response includes an expiry timestamp and a `https://calculationtime.com/observatory/share/{token}/` URL. Share responses set `X-Robots-Tag: noindex, nofollow`.

```bash
curl 'https://api.calculationtime.com/v1/observatory/share' \
  -H 'Content-Type: application/json' \
  -d '{"poster":"moment","date":"2026-08-01","location":{"name":"Munich","lat":48.137154,"lng":11.576124},"time":"12:00","ttl_days":30}'
```

### `GET /v1/observatory/share/{token}`

Resolves a valid, unexpired token into the stored Observatory parameters. Expired or invalid tokens return `404`.

## Astronomy Endpoints

### `GET /v1/astronomy/ephemeris`

Returns geocentric and heliocentric telemetry for the Sun, Moon, and planets on a requested UTC date or timestamp.

```bash
curl 'https://api.calculationtime.com/v1/astronomy/ephemeris?date=2029-10-21' \
  -H 'X-API-Key: your-key'
```

Query parameters:

- `date`: ISO date or timestamp, for example `2029-10-21` or `2029-10-21T00:00:00Z`.

The beta endpoint accepts dates from `1900-01-01` through `2100-12-31`. Results include astronomical-unit vectors, heliocentric distance, geocentric distance, right ascension, declination, and ecliptic longitude/latitude. It is designed as the backend feed for semantic astronomy pages and interactive orrery hydration, not as a location-specific sky visibility forecast.

### `POST /v1/astronomy/crux-midnight`

Returns Parkes-calibrated midnight positions for the Hand of Crux clock face. The zero reference is `2026-03-31T00:00:00+10:00` at Parkes Observatory coordinates `32.99° S, 148.26° E`.

```bash
curl 'https://api.calculationtime.com/v1/astronomy/crux-midnight' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"start_date":"2026-03-31","days":365,"timezone":"+10:00"}'
```

Credit cost: `2`.

### `POST /v1/astronomy/crux-hourly`

Returns a 24-hour local-date table from `00:00` through `23:00`, using the same Parkes calibration and the sidereal hourly rate of roughly `15.041°` per solar hour.

```bash
curl 'https://api.calculationtime.com/v1/astronomy/crux-hourly' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"date":"2026-03-31","timezone":"+10:00"}'
```

Credit cost: `5`.

### `POST /v1/astronomy/crux-current`

Returns the Crux hand angle for an exact timestamp, sidereal hours, and the Parkes alignment delta from the March 31, 2026 zero point. If `timestamp` is omitted, the API uses the server's current UTC time.

```bash
curl 'https://api.calculationtime.com/v1/astronomy/crux-current' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"timestamp":"2026-04-01T00:00:00+10:00"}'
```

Credit cost: `2`.

### `POST /v1/astronomy/solar-noon`

Returns the solar transit/noon timestamp for a coordinate and date.

```bash
curl 'https://api.calculationtime.com/v1/astronomy/solar-noon' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"date":"2026-06-21","lat":48.137154,"lon":11.576124}'
```

Credit cost: `1`.

### `POST /v1/astronomy/equinox-solstice`

Returns March equinox, June solstice, September equinox, and December solstice timestamps for a Gregorian year.

```bash
curl 'https://api.calculationtime.com/v1/astronomy/equinox-solstice' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"year":2026}'
```

Credit cost: `1`.

### `POST /v1/astronomy/moon-phase`

Returns lunar phase angle, age, illumination percentage, phase name, apparent magnitude, and Earth-Moon distance for a timestamp.

```bash
curl 'https://api.calculationtime.com/v1/astronomy/moon-phase' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"timestamp":"2026-06-21T00:00:00Z"}'
```

Credit cost: `1`.

### `POST /v1/astronomy/julian-date`

Converts an ISO timestamp to Julian Day, Julian Day Number, and Modified Julian Date.

```bash
curl 'https://api.calculationtime.com/v1/astronomy/julian-date' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"timestamp":"2000-01-01T12:00:00Z"}'
```

Credit cost: `1`.

### `POST /v1/astronomy/sidereal-time`

Returns Greenwich Mean Sidereal Time and Local Sidereal Time for a timestamp and longitude.

```bash
curl 'https://api.calculationtime.com/v1/astronomy/sidereal-time' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"timestamp":"2026-06-21T00:00:00Z","lon":11.576124}'
```

Credit cost: `1`.

### `POST /v1/astronomy/twilight-calculator`

Returns civil, nautical, and astronomical twilight morning/evening crossings for a coordinate and date.

```bash
curl 'https://api.calculationtime.com/v1/astronomy/twilight-calculator' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"date":"2026-06-21","lat":48.137154,"lon":11.576124}'
```

Credit cost: `1`.

### `POST /v1/astronomy/sun-position`

Returns solar right ascension, declination, azimuth, elevation, and distance for a coordinate and timestamp.

```bash
curl 'https://api.calculationtime.com/v1/astronomy/sun-position' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"timestamp":"2026-06-21T12:00:00Z","lat":48.137154,"lon":11.576124}'
```

Credit cost: `1`.

### `POST /v1/astronomy/moon-position`

Returns lunar right ascension, declination, azimuth, elevation, and distance for a coordinate and timestamp.

```bash
curl 'https://api.calculationtime.com/v1/astronomy/moon-position' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"timestamp":"2026-06-21T00:00:00Z","lat":48.137154,"lon":11.576124}'
```

Credit cost: `1`.

### `POST /v1/astronomy/day-length`

Returns sunrise, sunset, daylight duration, and polar-state classification for a coordinate and date.

```bash
curl 'https://api.calculationtime.com/v1/astronomy/day-length' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"date":"2026-06-21","lat":48.137154,"lon":11.576124}'
```

Credit cost: `1`.

### `POST /v1/astronomy/polar-night-check`

Returns deterministic midnight-sun or polar-night booleans for a coordinate and date.

```bash
curl 'https://api.calculationtime.com/v1/astronomy/polar-night-check' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"date":"2026-06-21","lat":80,"lon":0}'
```

Credit cost: `1`.

These endpoints use local deterministic astronomy calculations. They do not call external providers, databases, weather feeds, or paid ephemeris services. They are suitable for developer tooling, calculators, explainers, and repeatable page hydration; they are not navigation, survey, legal, or safety certification.

## Geospatial Endpoints

### `GET /v1/geo/distance`

Calculates distance and initial bearing between two coordinates.

```bash
curl 'https://api.calculationtime.com/v1/geo/distance?from_lat=48.137154&from_lon=11.576124&to_lat=52.52&to_lon=13.405' \
  -H 'X-API-Key: your-key'
```

Returns kilometers, miles, meters, nautical miles, bearing degrees, and compass direction.

### `GET /v1/geo/midpoint`

Calculates the great-circle midpoint between two coordinates.

```bash
curl 'https://api.calculationtime.com/v1/geo/midpoint?from_lat=48.137154&from_lon=11.576124&to_lat=52.52&to_lon=13.405' \
  -H 'X-API-Key: your-key'
```

### `GET /v1/geo/bounding-box`

Returns a spherical-approximation bounding box around a coordinate and radius.

```bash
curl 'https://api.calculationtime.com/v1/geo/bounding-box?lat=48.137154&lon=11.576124&radius_km=50' \
  -H 'X-API-Key: your-key'
```

### `GET /v1/geo/elevation`

Returns terrain elevation for a latitude/longitude using the Open-Meteo Elevation API backed by Copernicus DEM GLO-90.

```bash
curl 'https://api.calculationtime.com/v1/geo/elevation?lat=48.137154&lon=11.576124' \
  -H 'X-API-Key: your-key'
```

This is open-data terrain elevation, not survey-grade property elevation, building height, or tree-canopy height.

## Solar Endpoints

### `GET /v1/solar/position`

Returns local solar geometry for a coordinate and UTC timestamp without calling a paid provider.

```bash
curl 'https://api.calculationtime.com/v1/solar/position?lat=48.137154&lon=11.576124&at=2026-07-26T12:00:00Z' \
  -H 'X-API-Key: your-key'
```

The response includes solar azimuth, elevation, apparent elevation, zenith, hour angle, declination, equation of time, and daylight state. Terrain horizon, buildings, trees, weather, and local obstructions are not included in this endpoint.

## Date Endpoints

### `GET /v1/date/difference`

Calculates calendar day difference.

```bash
curl 'https://api.calculationtime.com/v1/date/difference?start=2026-07-12&end=2026-08-01' \
  -H 'X-API-Key: your-key'
```

### `GET /v1/date/add`

Adds years, months, weeks, and days to a date.

```bash
curl 'https://api.calculationtime.com/v1/date/add?start=2026-07-12&months=1&days=5' \
  -H 'X-API-Key: your-key'
```

### `POST /v1/date/business-days`

Counts business days between two dates, excluding Saturdays, Sundays, and optional holiday dates.

```json
{
  "start": "2026-07-12",
  "end": "2026-07-31",
  "holidays": ["2026-07-20"]
}
```

### `POST /v1/date/business-days-add`

Adds or subtracts business days from a start date with configurable weekend weekdays and optional holidays.

```bash
curl 'https://api.calculationtime.com/v1/date/business-days-add' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"start":"2026-07-13","business_days":10,"weekend_days":[6,7],"holidays":["2026-07-20"]}'
```

### `POST /v1/date/iso-week`

Returns ISO week-year, ISO week number, weekday number, and weekday name.

```bash
curl 'https://api.calculationtime.com/v1/date/iso-week' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"date":"2026-01-01"}'
```

### `POST /v1/date/age-breakdown`

Returns age as years, months, days, hours, minutes, seconds, plus total days/weeks/seconds.

```bash
curl 'https://api.calculationtime.com/v1/date/age-breakdown' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"birth_date":"1990-05-15","as_of":"2026-09-21T00:00:00Z"}'
```

### `POST /v1/date/countdown-precise`

Returns precise calendar delta and total seconds/milliseconds between two ISO timestamps.

```bash
curl 'https://api.calculationtime.com/v1/date/countdown-precise' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"start":"2026-09-21T00:00:00Z","end":"2027-01-01T12:30:15Z"}'
```

### `POST /v1/date/epoch-converter`

Converts Unix epoch seconds or milliseconds into ISO, RFC 2822, HTTP-date, and UTC calendar formats.

```bash
curl 'https://api.calculationtime.com/v1/date/epoch-converter' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"epoch":1789941600,"unit":"seconds"}'
```

### `POST /v1/date/quarter-calculator`

Returns calendar quarter and fiscal quarter with start/end dates and progress percentage.

```bash
curl 'https://api.calculationtime.com/v1/date/quarter-calculator' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"date":"2026-09-21","fiscal_start_month":4}'
```

### `POST /v1/date/leap-year-check`

Returns Gregorian and Julian leap-year booleans with a short proof statement.

```bash
curl 'https://api.calculationtime.com/v1/date/leap-year-check' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"year":2028}'
```

### `POST /v1/date/days-in-month`

Returns the number of days in a Gregorian month.

```bash
curl 'https://api.calculationtime.com/v1/date/days-in-month' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"year":2028,"month":2}'
```

### `POST /v1/date/timezone-offset`

Converts a UTC timestamp to a fixed UTC offset without DST or timezone-database lookup.

```bash
curl 'https://api.calculationtime.com/v1/date/timezone-offset' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"timestamp":"2026-09-21T00:00:00Z","offset":"+10:00"}'
```

### `POST /v1/date/calendar-range`

Generates a deterministic date range with weekday, weekend, and ISO-week metadata.

```bash
curl 'https://api.calculationtime.com/v1/date/calendar-range' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"start":"2026-09-21","days":14,"weekend_days":[6,7]}'
```

Credit cost: `1` each. These date endpoints are pure local calendar math. They do not call external APIs, databases, holiday services, or timezone providers.

## API Keys

## Financial, Statistical, And Payroll Endpoints

These endpoints are protected and billable. They use strict JSON validation and return `400` errors for malformed payloads.

Credit weights:

- Standard finance/payroll math: 1-2 credits.
- Dataset summary: 3 credits.
- Loan amortization schedule: 5 credits.

### `POST /v1/finance/margin-markup`

Calculates gross profit, margin percentage, markup percentage, selling price from target margin/markup, and cost variance.

```bash
curl 'https://api.calculationtime.com/v1/finance/margin-markup' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"cost":60,"selling_price":100,"actual_cost":66}'
```

Example response fields:

```json
{
  "gross_profit": 40,
  "gross_margin_percent": 40,
  "markup_percent": 66.6667
}
```

Credit cost: `1`.

### `POST /v1/finance/loan-amortization`

Generates a fixed-rate payment schedule with per-period principal, interest, payment, and remaining balance, plus annual totals.

```bash
curl 'https://api.calculationtime.com/v1/finance/loan-amortization' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"principal":250000,"annual_interest_rate_percent":6.25,"term_months":360}'
```

Credit cost: `5`.

### `POST /v1/finance/tax-extraction`

Calculates tax add-on and reverse tax-inclusive extraction across line items and tax rates.

```bash
curl 'https://api.calculationtime.com/v1/finance/tax-extraction' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"amounts":[{"label":"VAT inclusive","amount":120,"tax_rate_percent":20,"mode":"inclusive"},{"label":"GST exclusive","amount":100,"tax_rate_percent":10,"mode":"exclusive"}]}'
```

Credit cost: `2`.

### `POST /v1/finance/freelancer-rate`

Calculates required revenue, hourly rate, daily rate, and weekly revenue target from income, expenses, tax overhead, and billable capacity.

```bash
curl 'https://api.calculationtime.com/v1/finance/freelancer-rate' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"target_annual_income":80000,"annual_expenses":20000,"tax_overhead_percent":25,"billable_weeks":40,"billable_hours_per_week":25}'
```

Credit cost: `2`.

### Phase 4 Finance Utility Endpoints

These endpoints are pure local arithmetic and cost `1` credit each.

```bash
curl 'https://api.calculationtime.com/v1/finance/simple-interest' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"principal":1000,"annual_rate_percent":5,"years":3}'

curl 'https://api.calculationtime.com/v1/finance/compound-interest' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"principal":1000,"annual_rate_percent":5,"years":10,"compounds_per_year":12}'

curl 'https://api.calculationtime.com/v1/finance/loan-amortization-summary' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"principal":250000,"annual_interest_rate_percent":6.25,"term_months":360}'

curl 'https://api.calculationtime.com/v1/finance/rule-of-72' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"annual_rate_percent":6}'

curl 'https://api.calculationtime.com/v1/finance/roi' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"cost":1000,"net_gain":250}'

curl 'https://api.calculationtime.com/v1/finance/discount-calculator' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"original_price":120,"discount_percent":15}'

curl 'https://api.calculationtime.com/v1/finance/markup-margin' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"margin_percent":40}'

curl 'https://api.calculationtime.com/v1/finance/break-even' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"fixed_costs":10000,"price_per_unit":50,"variable_cost_per_unit":30}'

curl 'https://api.calculationtime.com/v1/finance/salestax' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"amount":120,"tax_rate_percent":20,"mode":"inclusive"}'

curl 'https://api.calculationtime.com/v1/finance/cagr' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"beginning_value":1000,"ending_value":1500,"years":5}'
```

### `POST /v1/stats/summary`

Returns count, min, max, sum, mean, median, modes, population/sample variance, population/sample standard deviation, and quartiles.

```bash
curl 'https://api.calculationtime.com/v1/stats/summary' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"values":[1,2,2,4,9]}'
```

Credit cost: `3`.

### `POST /v1/payroll/decimal-hours`

Converts clock parts to decimal hours, or decimal hours back to clock parts. Includes optional overtime multiplier output.

```bash
curl 'https://api.calculationtime.com/v1/payroll/decimal-hours' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"hours":1,"minutes":30,"seconds":0,"overtime_multiplier":1.5}'
```

Reverse conversion:

```bash
curl 'https://api.calculationtime.com/v1/payroll/decimal-hours' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"decimal_hours":2.75}'
```

Credit cost: `1`.

## Mathematical, Geometric, And Statistical Utility Endpoints

These endpoints are protected, billable, pure local arithmetic, and cost `1` credit each.

```bash
curl 'https://api.calculationtime.com/v1/math/quadratic-solver' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"a":1,"b":-3,"c":2}'

curl 'https://api.calculationtime.com/v1/math/pythagorean-solve' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"a":3,"b":4}'

curl 'https://api.calculationtime.com/v1/math/triangle-heron' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"a":3,"b":4,"c":5}'

curl 'https://api.calculationtime.com/v1/math/circle-geometry' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"radius":10,"angle_degrees":90}'

curl 'https://api.calculationtime.com/v1/math/sphere-geometry' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"radius":3}'

curl 'https://api.calculationtime.com/v1/math/cylinder-geometry' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"radius":3,"height":10}'

curl 'https://api.calculationtime.com/v1/math/statistics-summary' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"values":[1,2,2,4,9]}'

curl 'https://api.calculationtime.com/v1/math/percentage-change' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"baseline":80,"current":100}'

curl 'https://api.calculationtime.com/v1/math/percent-error' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"true_value":100,"measured_value":96}'

curl 'https://api.calculationtime.com/v1/math/gcd-lcm' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"values":[12,18,30]}'

curl 'https://api.calculationtime.com/v1/math/matrix-determinant' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"matrix":[[1,2],[3,4]]}'

curl 'https://api.calculationtime.com/v1/math/proportion-solver' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"a":2,"b":5,"c":8}'

curl 'https://api.calculationtime.com/v1/math/logarithm-eval' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"value":1000,"base":10}'

curl 'https://api.calculationtime.com/v1/math/exponent-eval' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"base":27,"exponent":2,"root":3}'

curl 'https://api.calculationtime.com/v1/math/combinatorics' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"n":10,"r":3}'
```

## Batch Two Developer Utility Endpoints

The following `/api/v1/...` endpoints are staged as zero-cost developer utilities: pure local JavaScript arithmetic, deterministic astronomy approximations, or existing local astronomy-engine calculations. All are `POST`, API-key protected, and cost `1` credit per call.

### Unit conversion

- `/api/v1/convert/length` — `{ "value": 1, "from": "mile", "to": "kilometer" }`
- `/api/v1/convert/weight` — `{ "value": 10, "from": "pound", "to": "kilogram" }`
- `/api/v1/convert/temperature` — `{ "value": 32, "from": "fahrenheit", "to": "celsius" }`
- `/api/v1/convert/area` — `{ "value": 1, "from": "acre", "to": "square_meter" }`
- `/api/v1/convert/volume` — `{ "value": 1, "from": "gallon", "to": "liter" }`
- `/api/v1/convert/speed` — `{ "value": 100, "from": "kmh", "to": "mph" }`
- `/api/v1/convert/pressure` — `{ "value": 1, "from": "atmosphere", "to": "psi" }`
- `/api/v1/convert/energy` — `{ "value": 1, "from": "kilowatt_hour", "to": "joule" }`
- `/api/v1/convert/power` — `{ "value": 1, "from": "horsepower", "to": "watt" }`
- `/api/v1/convert/data-storage` — `{ "value": 1, "from": "gigabyte", "to": "megabyte" }`

### Cryptography and encoding

- `/api/v1/crypto/hash-sha256` — `{ "text": "calculationtime" }`
- `/api/v1/crypto/hash-sha512` — `{ "text": "calculationtime" }`
- `/api/v1/crypto/base64-encode` — `{ "text": "calculationtime" }`
- `/api/v1/crypto/base64-decode` — `{ "base64": "Y2FsY3VsYXRpb250aW1l" }`

### Astronomy

- `/api/v1/astronomy/solar-declination`
- `/api/v1/astronomy/equation-of-time`
- `/api/v1/astronomy/moon-illumination`
- `/api/v1/astronomy/sidereal-conversion`
- `/api/v1/astronomy/golden-hour`
- `/api/v1/astronomy/blue-hour`
- `/api/v1/astronomy/season-progress`
- `/api/v1/astronomy/zodiac-sign`
- `/api/v1/astronomy/daylight-delta`

### Engineering, physics, and geometry math

- `/api/v1/math/ohm-law`
- `/api/v1/math/projectile-range`
- `/api/v1/math/kinetic-energy`
- `/api/v1/math/potential-energy`
- `/api/v1/math/circle-sector`
- `/api/v1/math/sphere-surface`
- `/api/v1/math/cone-geometry`
- `/api/v1/math/torus-geometry`
- `/api/v1/math/arithmetic-progression`
- `/api/v1/math/geometric-progression`

## Batch Three Zero-Cost Developer Endpoints

Batch three adds 50 more deterministic `/api/v1/...` utility endpoints for scheduling, colour/design, network debugging, finance, and specialist math. All are `POST`, API-key protected, locally computed, and cost `1` credit per call.

### Scheduling and recurrence

- `/api/v1/schedule/cron-parser`
- `/api/v1/schedule/workday-shift`
- `/api/v1/schedule/date-range-split`
- `/api/v1/schedule/interval-overlap`
- `/api/v1/schedule/project-timeline`
- `/api/v1/schedule/shift-calculator`
- `/api/v1/schedule/countdown-workdays`
- `/api/v1/schedule/recurring-monthly`
- `/api/v1/schedule/age-in-days`
- `/api/v1/schedule/time-blocks`

### Colour, design, and typography

- `/api/v1/color/hex-to-rgb`
- `/api/v1/color/rgb-to-hex`
- `/api/v1/color/rgb-to-hsl`
- `/api/v1/color/hsl-to-rgb`
- `/api/v1/color/contrast-ratio`
- `/api/v1/color/luminance`
- `/api/v1/color/tint-shade`
- `/api/v1/color/cmyk-conversion`
- `/api/v1/typography/px-to-rem`
- `/api/v1/typography/line-height`

### Network, IP, and request utilities

- `/api/v1/network/ip-parse`
- `/api/v1/network/cidr-range`
- `/api/v1/network/user-agent-parse`
- `/api/v1/network/query-string-parse`
- `/api/v1/network/slug-sanitize`
- `/api/v1/network/port-lookup`
- `/api/v1/network/http-status-lookup`
- `/api/v1/network/mime-lookup`
- `/api/v1/network/uuid-v5`
- `/api/v1/network/mac-format`

### Finance and investment extensions

- `/api/v1/finance/npv`
- `/api/v1/finance/irr-approximation`
- `/api/v1/finance/bond-yield`
- `/api/v1/finance/depreciation-straight-line`
- `/api/v1/finance/depreciation-declining`
- `/api/v1/finance/loan-payoff-extra`
- `/api/v1/finance/effective-annual-rate`
- `/api/v1/finance/markup-margin-split`
- `/api/v1/finance/break-even-multi`
- `/api/v1/finance/tip-split`

### Specialist math extensions

- `/api/v1/math/matrix-multiply`
- `/api/v1/math/vector-magnitude`
- `/api/v1/math/vector-dot-product`
- `/api/v1/math/quadratic-vertex`
- `/api/v1/math/factorial-gamma`
- `/api/v1/math/fibonacci`
- `/api/v1/math/base-n-convert`
- `/api/v1/math/percentile-calc`
- `/api/v1/math/wind-chill`
- `/api/v1/math/heat-index`

## Health And Practical Body Math Endpoints

These endpoints are protected, billable, and cost `1` credit each. They are arithmetic support tools, not medical advice.

```bash
curl 'https://api.calculationtime.com/v1/health/bmi' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"unit":"metric","weight_kg":70,"height_cm":175}'

curl 'https://api.calculationtime.com/v1/health/bmr' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"unit":"metric","weight_kg":70,"height_cm":175,"age":35,"sex":"male"}'

curl 'https://api.calculationtime.com/v1/health/tdee' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"unit":"metric","weight_kg":70,"height_cm":175,"age":35,"sex":"male","activity_level":"moderate"}'

curl 'https://api.calculationtime.com/v1/health/macro-split' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"calories":2000,"protein_percent":30,"carbs_percent":40,"fat_percent":30}'

curl 'https://api.calculationtime.com/v1/health/pace-calculator' \
  -H 'Content-Type: application/json' -H 'X-API-Key: your-key' \
  -d '{"distance":5,"unit":"km","minutes":25}'
```

## Tradie Accounting Endpoints

These endpoints are built for accounting teams serving trade clients such as painters, builders, decorators, electricians, and subcontractors. They are protected, billable, and return clean `400` validation errors for malformed JSON.

Credit weights:

- Simple claim/deduction math: 1-2 credits.
- VAT summaries, depreciation schedules, and invoice aging: 3 credits.

### `POST /v1/tradie/job-margin`

Calculates quote profitability from labour, materials, subcontractor costs, overhead, and quoted price.

```bash
curl 'https://api.calculationtime.com/v1/tradie/job-margin' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"labour_hours":40,"labour_rate":35,"materials_cost":600,"subcontractor_cost":300,"overhead_percent":10,"quoted_price":3200}'
```

Example response fields:

```json
{
  "total_cost": 2530,
  "gross_profit": 670,
  "gross_margin_percent": 20.9375
}
```

Credit cost: `2`.

### `POST /v1/tradie/vat-return-summary`

Summarizes sales output VAT and purchase input VAT, including mixed inclusive and exclusive line items.

```bash
curl 'https://api.calculationtime.com/v1/tradie/vat-return-summary' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"sales":[{"amount":1200,"tax_rate_percent":20,"mode":"inclusive"}],"purchases":[{"amount":300,"tax_rate_percent":20,"mode":"exclusive"}]}'
```

Credit cost: `3`.

### `POST /v1/tradie/cis-deduction`

Models a UK CIS-style deduction from labour after materials are excluded.

```bash
curl 'https://api.calculationtime.com/v1/tradie/cis-deduction' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"gross_labour":1000,"materials":200,"deduction_rate_percent":20}'
```

Credit cost: `2`.

### `POST /v1/tradie/mileage-claim`

Calculates a business mileage claim, unreimbursed amount, and any reimbursed excess.

```bash
curl 'https://api.calculationtime.com/v1/tradie/mileage-claim' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"miles":120,"rate_per_mile":0.45,"reimbursed_amount":20}'
```

Credit cost: `1`.

### `POST /v1/tradie/tool-depreciation`

Generates a straight-line depreciation schedule for trade tools and equipment, adjusted for business use.

```bash
curl 'https://api.calculationtime.com/v1/tradie/tool-depreciation' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"purchase_price":1200,"salvage_value":200,"useful_life_years":5,"business_use_percent":80}'
```

Credit cost: `3`.

### `POST /v1/tradie/invoice-aging`

Buckets unpaid invoices into current, 1-30, 31-60, 61-90, and 90+ day aging bands.

```bash
curl 'https://api.calculationtime.com/v1/tradie/invoice-aging' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"as_of":"2026-09-30","invoices":[{"invoice_id":"INV-1","customer":"Painter A","due_date":"2026-09-15","amount":1000,"paid_amount":200}]}'
```

Credit cost: `3`.

Set `TIME_API_KEYS` to a comma-separated list of accepted keys. Clients may send either:

- `Authorization: Bearer <key>`
- `X-API-Key: <key>`

Most calculation endpoints require an API key on the public service. Public demo and health endpoints do not.

Keys can optionally be scoped as `customer_id:key-value` so rate limits and usage logs can identify the customer without logging the secret.

## Webhooks

Heavy successful calculations can optionally notify a tenant-owned HTTPS endpoint. The current event group is:

```text
calculation.heavy.completed
```

Eligible routes:

- `POST /v1/finance/loan-amortization`
- `POST /v1/finance/tax-extraction`
- `POST /v1/stats/summary`
- `POST /v1/tradie/vat-return-summary`
- `POST /v1/tradie/tool-depreciation`
- `POST /v1/tradie/invoice-aging`

Webhook payloads include event id, event type, customer id, route, method, status code, duration, and credit cost. Delivery is non-blocking: a webhook timeout or remote error is logged but does not fail the customer's calculation response.

## CORS

Browser access is deliberately allowlisted, not wildcarded. The default allowed origins are:

- `https://www.calculationtime.com`
- `https://calculationtime.com`
- `https://buildaiops.com`
- `http://localhost:3000`
- `http://127.0.0.1:3000`

Override with `CORS_ORIGINS` as a comma-separated list when staging or production origins change.

## Rate Limiting

Set `RATE_LIMIT_PER_MINUTE` to control basic in-process rate limiting. The default is `120` requests per minute per customer. Set `TIME_API_CUSTOMER_RATE_LIMITS` to a JSON object such as `{"customer_a":240}` for customer-specific limits. Set the default to `0` only behind a stronger gateway-level limiter.

## Deterministic Cache

Set `TIME_API_CACHE=memory` for the default in-process cache, `TIME_API_CACHE=off` to disable it, or `TIME_API_CACHE=redis` only after Redis is deliberately provisioned and `REDIS_URL` is configured.

The API does not cache current-time responses where `at` is omitted. It can cache deterministic inputs such as explicit timestamp coordinate conversions, date calculations, business-day calculations, distance, midpoint, and bounding-box results.

## Logging

The Fastify HTTP layer emits structured request logs with route, status, latency, customer id, API key fingerprint, and cache status. It avoids logging request bodies, query inputs, or raw API keys.

## Use Cases

CalculationTime API is useful for:

- Local time and timezone-aware scheduling.
- Payroll, billing, SLA, and deadline windows.
- Business-day and holiday-aware planning.
- Field-service distance/radius checks.
- Delivery, dispatch, and branch proximity tools.
- Solar angle, outdoor-work, and education prototypes.
- Astronomy and time explainer pages.
- AI-agent workflows that need repeatable calculation calls.

## Commercial Notes

This API is suitable for scheduling, compliance timestamps, logistics, CRM records, remote workforce tools, event planning, travel, billing cutoffs, and time-sensitive customer notifications.

Geospatial endpoints are suitable for territory checks, routing estimates, field-service assignment, delivery radius filters, branch proximity tools, and customer segmentation. They are not a replacement for surveyed legal boundaries or turn-by-turn routing engines.

Date endpoints are suitable for billing windows, SLA calculations, business-day estimates, subscription periods, due dates, and payroll-like date workflows. Jurisdiction-specific holidays should be supplied by the client or a future jurisdiction-holiday module.

Public commercial usage should account for:

- API keys per customer.
- Rate limits per customer.
- Usage logging without storing unnecessary personal data.
- SLA wording tied to IANA timezone database freshness.
- Versioned response schema.
- Monitoring and external uptime checks.

## Example Files

Internal example pack:

```text
/root/.openclaw/workspace/ops/calculationtime/promotion/api-examples/
```

That pack contains curl, Node.js, Python, and agent-integration notes.
