# Running Endpoint Directory

Generated from the CalculationTime API OpenAPI contract after the live Node service restart.

- Public base URL: `https://api.calculationtime.com`
- Generated at: `2026-09-21T14:21:59.385Z`
- OpenAPI path count: `206`
- Service: `time-coordinate-api`

Protected routes accept either `X-API-Key` or `Authorization: Bearer ...`. A protected route returning `401 unauthorized` without a key means the route is loaded and live, but requires credentials.

## Public Status And Docs

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| GET | `/` | Public | - | Markdown API documentation |
| GET | `/health` | Public | - | Low-level service health |
| GET | `/openapi.json` | Public | - | OpenAPI contract for live routes |

## Data

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| GET | `/api/v1/data/constants` | Public | - | Alias: physical and mathematical constants |
| GET | `/api/v1/data/constellations` | Public | - | Alias: IAU constellation reference |
| GET | `/api/v1/data/countries` | Public | - | Alias: country reference table |
| GET | `/api/v1/data/elements` | Public | - | Alias: periodic table reference values |
| GET | `/api/v1/data/http-status` | Public | - | Alias: HTTP status code directory |
| GET | `/api/v1/data/materials/density` | Public | - | Alias: common material density reference table |
| GET | `/api/v1/data/meteor-showers` | Public | - | Alias: major annual meteor shower reference table |
| GET | `/api/v1/data/mime-types` | Public | - | Alias: MIME type and extension reference table |
| GET | `/api/v1/data/stars/bright` | Public | - | Alias: bright star reference table |
| GET | `/api/v1/data/timezones` | Public | - | Alias: IANA timezone reference |
| GET | `/api/v1/data/unicode-blocks` | Public | - | Alias: Unicode block range reference table |
| GET | `/v1/data/constants` | Public | - | Physical and mathematical constants reference table |
| GET | `/v1/data/constellations` | Public | - | IAU constellation names, genitives, abbreviations, and quadrants |
| GET | `/v1/data/countries` | Public | - | Country reference table with capitals, ISO codes, dialing codes, and currencies |
| GET | `/v1/data/elements` | Public | - | Periodic table reference values |
| GET | `/v1/data/http-status` | Public | - | HTTP status code directory |
| GET | `/v1/data/materials/density` | Public | - | Common material density reference table |
| GET | `/v1/data/meteor-showers` | Public | - | Major annual meteor shower reference table |
| GET | `/v1/data/mime-types` | Public | - | MIME type and extension reference table |
| GET | `/v1/data/stars/bright` | Public | - | Bright star reference table |
| GET | `/v1/data/timezones` | Public | - | IANA timezone reference with current UTC offsets and DST status |
| GET | `/v1/data/unicode-blocks` | Public | - | Unicode block range reference table |

## Utility

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| GET | `/api/v1/utility/tagline` | Public | - | Deterministic daily CalculationTime tagline |

## Time

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| GET | `/v1/time` | API key | 1 | Get local time for one coordinate |
| POST | `/v1/time/batch` | API key | 1 | Get local time for up to 100 coordinates |
| GET | `/v1/time/utc` | Public | - | Current UTC timestamp and clock-model metadata |

## Date

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| GET | `/v1/date/add` | API key | 1 | Add calendar units to a date |
| POST | `/v1/date/age-breakdown` | API key | 1 | Exact age duration breakdown from birth date to timestamp |
| POST | `/v1/date/business-days` | API key | 1 | Business-day count with supplied holidays |
| POST | `/v1/date/business-days-add` | API key | 1 | Add or subtract configurable business days |
| POST | `/v1/date/business-days/jurisdiction` | API key | 1 | Business-day count for a supported jurisdiction |
| POST | `/v1/date/calendar-range` | API key | 1 | Generate a deterministic date range with weekday and ISO week facts |
| POST | `/v1/date/countdown-precise` | API key | 1 | Precise calendar delta between timestamps |
| POST | `/v1/date/days-in-month` | API key | 1 | Days in a Gregorian month |
| GET | `/v1/date/difference` | API key | 1 | Calendar day difference |
| POST | `/v1/date/difference/batch` | API key | 1 | Batch calendar day differences |
| POST | `/v1/date/epoch-converter` | API key | 1 | Unix epoch seconds or milliseconds to ISO/RFC strings |
| POST | `/v1/date/iso-week` | API key | 1 | ISO week number, week-year, and weekday |
| POST | `/v1/date/leap-year-check` | API key | 1 | Gregorian and Julian leap-year proof check |
| POST | `/v1/date/quarter-calculator` | API key | 1 | Calendar and fiscal quarter with progress percentage |
| POST | `/v1/date/timezone-offset` | API key | 1 | Fixed UTC offset conversion without DST lookup |

## Geo

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| GET | `/v1/geo/bounding-box` | API key | 1 | Bounding box around a coordinate |
| GET | `/v1/geo/distance` | API key | 1 | Distance between two coordinates |
| POST | `/v1/geo/distance/batch` | API key | 1 | Batch distance calculations |
| GET | `/v1/geo/elevation` | API key | 1 | Elevation for one coordinate |
| GET | `/v1/geo/midpoint` | API key | 1 | Midpoint between two coordinates |
| GET | `/v1/geo/nearby` | API key | 1 | Nearby stored geo points |

## Solar

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| GET | `/v1/solar/position` | API key | 1 | Solar position for date and coordinate |

## Astronomy

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| POST | `/api/v1/astronomy/blue-hour` | API key | 1 | Morning and evening blue-hour windows |
| POST | `/api/v1/astronomy/daylight-delta` | API key | 1 | Day-length gain or loss versus previous day |
| POST | `/api/v1/astronomy/equation-of-time` | API key | 1 | Approximate equation of time for a date |
| POST | `/api/v1/astronomy/golden-hour` | API key | 1 | Morning and evening golden-hour windows |
| POST | `/api/v1/astronomy/moon-illumination` | API key | 1 | Moon illumination fraction and phase angle |
| POST | `/api/v1/astronomy/season-progress` | API key | 1 | Astronomical season progress at a timestamp |
| POST | `/api/v1/astronomy/sidereal-conversion` | API key | 1 | Convert solar hours to sidereal interval |
| POST | `/api/v1/astronomy/solar-declination` | API key | 1 | Approximate solar declination angle for a date |
| POST | `/api/v1/astronomy/zodiac-sign` | API key | 1 | Tropical zodiac sign by calendar date |
| POST | `/v1/astronomy/crux-current` | API key | 2 | Current Crux clock hand position and Parkes alignment delta |
| POST | `/v1/astronomy/crux-hourly` | API key | 5 | Crux clock hand hourly sidereal breakdown for one local date |
| POST | `/v1/astronomy/crux-midnight` | API key | 2 | Crux clock hand midnight sidereal positions from Parkes Observatory calibration |
| POST | `/v1/astronomy/day-length` | API key | 1 | Daylight duration between sunrise and sunset |
| GET | `/v1/astronomy/ephemeris` | API key | 1 | Astronomy ephemeris for a date |
| POST | `/v1/astronomy/equinox-solstice` | API key | 1 | Equinox and solstice timestamps for a year |
| POST | `/v1/astronomy/julian-date` | API key | 1 | Gregorian timestamp to Julian Day and Modified Julian Date |
| POST | `/v1/astronomy/moon-phase` | API key | 1 | Moon illumination, age, and phase name for a timestamp |
| POST | `/v1/astronomy/moon-position` | API key | 1 | Moon right ascension, declination, azimuth, and elevation |
| POST | `/v1/astronomy/polar-night-check` | API key | 1 | Check midnight sun or polar night state for a latitude/date |
| POST | `/v1/astronomy/sidereal-time` | API key | 1 | Greenwich and local sidereal time for a timestamp and longitude |
| POST | `/v1/astronomy/solar-noon` | API key | 1 | Solar transit/noon timestamp for a coordinate and date |
| POST | `/v1/astronomy/sun-position` | API key | 1 | Sun right ascension, declination, azimuth, and elevation |
| POST | `/v1/astronomy/twilight-calculator` | API key | 1 | Civil, nautical, and astronomical twilight crossings |

## Crypto

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| POST | `/api/v1/crypto/base64-decode` | API key | 1 | Decode Base64 text |
| POST | `/api/v1/crypto/base64-encode` | API key | 1 | Encode text to Base64 |
| POST | `/api/v1/crypto/hash-md5` | API key | 1 | Compute MD5 checksum for a small payload |
| POST | `/api/v1/crypto/hash-sha256` | API key | 1 | Compute SHA-256 hash for a small payload |
| POST | `/api/v1/crypto/hash-sha512` | API key | 1 | Compute SHA-512 hash for a small payload |

## Schedule

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| POST | `/api/v1/schedule/age-in-days` | API key | 1 | Calculate an exact age milestone date in days |
| POST | `/api/v1/schedule/countdown-workdays` | API key | 1 | Count business days remaining until a deadline |
| POST | `/api/v1/schedule/cron-parser` | API key | 1 | List upcoming UTC run timestamps for a 5-field cron expression |
| POST | `/api/v1/schedule/date-range-split` | API key | 1 | Split a date range into week, month, or quarter chunks |
| POST | `/api/v1/schedule/interval-overlap` | API key | 1 | Calculate overlap between two timestamp intervals |
| POST | `/api/v1/schedule/project-timeline` | API key | 1 | Forward-pass project timeline and critical finish calculation |
| POST | `/api/v1/schedule/recurring-monthly` | API key | 1 | Generate nth-weekday monthly recurrence dates |
| POST | `/api/v1/schedule/shift-calculator` | API key | 1 | Calculate shift hours, overtime, and night differential hours |
| POST | `/api/v1/schedule/time-blocks` | API key | 1 | Divide a 24-hour day into equal booking blocks |
| POST | `/api/v1/schedule/workday-shift` | API key | 1 | Shift a date by configurable working days |

## Color And Typography

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| POST | `/api/v1/typography/line-height` | API key | 1 | Calculate proportional line height and type scale steps |
| POST | `/api/v1/typography/px-to-rem` | API key | 1 | Convert pixel values to rem units |

## Network

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| POST | `/api/v1/network/cidr-range` | API key | 1 | Calculate IPv4 CIDR network, broadcast, and usable hosts |
| POST | `/api/v1/network/http-status-lookup` | API key | 1 | Look up HTTP status phrase and status class |
| POST | `/api/v1/network/ip-parse` | API key | 1 | Parse IPv4 or IPv6 address metadata |
| POST | `/api/v1/network/mac-format` | API key | 1 | Normalize and validate MAC address formatting |
| POST | `/api/v1/network/mime-lookup` | API key | 1 | Resolve file extension to MIME type |
| POST | `/api/v1/network/port-lookup` | API key | 1 | Look up standard TCP/UDP port service names |
| POST | `/api/v1/network/query-string-parse` | API key | 1 | Encode or decode URL query strings |
| POST | `/api/v1/network/slug-sanitize` | API key | 1 | Normalize arbitrary text into a URL-safe slug |
| POST | `/api/v1/network/user-agent-parse` | API key | 1 | Extract browser, OS, and device class from a user-agent string |
| POST | `/api/v1/network/uuid-v5` | API key | 1 | Generate deterministic name-based UUID v5 |

## Finance

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| POST | `/api/v1/finance/bond-yield` | API key | 1 | Calculate current yield and approximate yield to maturity |
| POST | `/api/v1/finance/break-even-multi` | API key | 1 | Calculate weighted break-even across multiple products |
| POST | `/api/v1/finance/depreciation-declining` | API key | 1 | Generate a declining-balance depreciation schedule |
| POST | `/api/v1/finance/depreciation-straight-line` | API key | 1 | Generate a straight-line depreciation schedule |
| POST | `/api/v1/finance/effective-annual-rate` | API key | 1 | Convert nominal APR to effective annual rate |
| POST | `/api/v1/finance/irr-approximation` | API key | 1 | Approximate internal rate of return from cash flows |
| POST | `/api/v1/finance/loan-payoff-extra` | API key | 1 | Calculate loan payoff impact from extra monthly principal |
| POST | `/api/v1/finance/markup-margin-split` | API key | 1 | Convert between markup, margin, cost, and selling price |
| POST | `/api/v1/finance/npv` | API key | 1 | Calculate net present value for uneven cash flows |
| POST | `/api/v1/finance/tip-split` | API key | 1 | Calculate tip, total, and per-person split |
| POST | `/v1/finance/break-even` | API key | 1 | Break-even units from fixed costs, variable cost, and price |
| POST | `/v1/finance/cagr` | API key | 1 | Compound annual growth rate from beginning value, ending value, and years |
| POST | `/v1/finance/compound-interest` | API key | 1 | Future value with compound interest frequency options |
| POST | `/v1/finance/discount-calculator` | API key | 1 | Final price and savings from original price and discount rate |
| POST | `/v1/finance/freelancer-rate` | API key | 2 | Freelancer hourly and daily rate target |
| POST | `/v1/finance/loan-amortization` | API key | 5 | Fixed-rate loan amortization schedule |
| POST | `/v1/finance/loan-amortization-summary` | API key | 1 | Loan payment, total interest, and total cost summary |
| POST | `/v1/finance/margin-markup` | API key | 1 | Gross margin, markup, selling price, and cost variance |
| POST | `/v1/finance/markup-margin` | API key | 1 | Convert between gross margin and markup percentages |
| POST | `/v1/finance/roi` | API key | 1 | Return on investment percentage from cost and net gain |
| POST | `/v1/finance/rule-of-72` | API key | 1 | Estimated investment doubling time using the rule of 72 |
| POST | `/v1/finance/salestax` | API key | 1 | Add or extract sales tax/GST from an amount and tax rate |
| POST | `/v1/finance/simple-interest` | API key | 1 | Simple interest from principal, rate, and time |
| POST | `/v1/finance/tax-extraction` | API key | 2 | Tax add-on and inclusive reverse extraction |

## Health

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| POST | `/v1/health/bmi` | API key | 1 | Body Mass Index and category classification |
| POST | `/v1/health/bmr` | API key | 1 | Basal Metabolic Rate using Mifflin-St Jeor |
| POST | `/v1/health/macro-split` | API key | 1 | Protein, carbs, and fat grams from calories and macro percentages |
| POST | `/v1/health/pace-calculator` | API key | 1 | Running or walking pace and speed from distance and duration |
| POST | `/v1/health/tdee` | API key | 1 | Total Daily Energy Expenditure from BMR and activity multiplier |

## Math

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| POST | `/api/v1/math/arithmetic-progression` | API key | 1 | Arithmetic progression nth term and partial sum |
| POST | `/api/v1/math/base-n-convert` | API key | 1 | Convert integers between base 2 and base 36 |
| POST | `/api/v1/math/circle-sector` | API key | 1 | Circle sector area, arc, and chord length |
| POST | `/api/v1/math/cone-geometry` | API key | 1 | Cone slant height, surface area, and volume |
| POST | `/api/v1/math/factorial-gamma` | API key | 1 | Calculate factorials and gamma approximations |
| POST | `/api/v1/math/fibonacci` | API key | 1 | Calculate Fibonacci number and sequence |
| POST | `/api/v1/math/geometric-progression` | API key | 1 | Geometric progression nth term and partial sum |
| POST | `/api/v1/math/heat-index` | API key | 1 | Calculate heat index apparent temperature |
| POST | `/api/v1/math/kinetic-energy` | API key | 1 | Kinetic energy from mass and velocity |
| POST | `/api/v1/math/matrix-multiply` | API key | 1 | Multiply two 2x2 or 3x3-compatible matrices |
| POST | `/api/v1/math/ohm-law` | API key | 1 | Ohm law solver for voltage, current, resistance, and power |
| POST | `/api/v1/math/percentile-calc` | API key | 1 | Calculate statistical percentile from raw values |
| POST | `/api/v1/math/potential-energy` | API key | 1 | Gravitational potential energy |
| POST | `/api/v1/math/projectile-range` | API key | 1 | Ideal projectile range, flight time, and max height |
| POST | `/api/v1/math/quadratic-vertex` | API key | 1 | Calculate parabola vertex, axis, and roots |
| POST | `/api/v1/math/sphere-surface` | API key | 1 | Sphere surface area and volume alias |
| POST | `/api/v1/math/torus-geometry` | API key | 1 | Torus surface area and volume |
| POST | `/api/v1/math/vector-dot-product` | API key | 1 | Calculate vector dot product and angle |
| POST | `/api/v1/math/vector-magnitude` | API key | 1 | Calculate vector magnitude and unit vector |
| POST | `/api/v1/math/wind-chill` | API key | 1 | Calculate wind chill apparent temperature |
| POST | `/v1/math/circle-geometry` | API key | 1 | Circle area, circumference, diameter, arc length, and sector area |
| POST | `/v1/math/combinatorics` | API key | 1 | Permutations and combinations for n and r |
| POST | `/v1/math/cylinder-geometry` | API key | 1 | Cylinder base area, surface area, and volume from radius and height |
| POST | `/v1/math/exponent-eval` | API key | 1 | Evaluate exponentiation and optional real root extraction |
| POST | `/v1/math/gcd-lcm` | API key | 1 | Greatest common divisor and least common multiple for integer sets |
| POST | `/v1/math/logarithm-eval` | API key | 1 | Evaluate logarithms with custom bases using change of base |
| POST | `/v1/math/matrix-determinant` | API key | 1 | Determinants for 2x2 and 3x3 matrices |
| POST | `/v1/math/percent-error` | API key | 1 | Absolute, relative, and percent error against an accepted true value |
| POST | `/v1/math/percentage-change` | API key | 1 | Absolute and percentage change from baseline to current value |
| POST | `/v1/math/proportion-solver` | API key | 1 | Solve x in equivalent ratios a/b = c/x |
| POST | `/v1/math/pythagorean-solve` | API key | 1 | Solve the missing side of a right triangle from any two sides |
| POST | `/v1/math/quadratic-solver` | API key | 1 | Solve a quadratic equation with real or complex roots and vertex coordinates |
| POST | `/v1/math/sphere-geometry` | API key | 1 | Sphere diameter, surface area, and volume from radius |
| POST | `/v1/math/statistics-summary` | API key | 1 | Mean, median, mode, variance, standard deviation, and IQR for numbers |
| POST | `/v1/math/triangle-heron` | API key | 1 | Triangle area, perimeter, and angles from three side lengths |

## Stats

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| POST | `/v1/stats/summary` | API key | 3 | Descriptive statistics for a numeric dataset |

## Payroll

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| POST | `/v1/payroll/decimal-hours` | API key | 1 | Clock time to decimal hours and overtime conversion |

## Tradie

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| POST | `/v1/tradie/cis-deduction` | API key | 2 | UK CIS-style deduction model for labour and materials |
| POST | `/v1/tradie/invoice-aging` | API key | 3 | Receivables aging buckets for unpaid invoices |
| POST | `/v1/tradie/job-margin` | API key | 2 | Tradie job margin from labour, materials, subcontractors, overhead, and quote |
| POST | `/v1/tradie/mileage-claim` | API key | 1 | Mileage claim and unreimbursed/reimbursed excess calculation |
| POST | `/v1/tradie/tool-depreciation` | API key | 3 | Straight-line tool and equipment depreciation schedule |
| POST | `/v1/tradie/vat-return-summary` | API key | 3 | Tradie VAT return summary from sales and purchases |

## Account

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| GET | `/v1/account/credits` | API key | - | Authenticated customer credit balance |
| GET | `/v1/account/limits` | API key | - | Authenticated customer plan and batch limits |
| GET | `/v1/account/profile` | API key | - | Authenticated customer profile |
| GET | `/v1/account/usage` | API key | - | Authenticated customer usage summary |

## Admin

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| GET | `/v1/admin/customers` | API key | - | Admin customer list and usage summary |
| POST | `/v1/admin/customers` | API key | - | Admin create or update customer |
| GET | `/v1/admin/customers/{customer_id}` | API key | - | Admin customer detail |
| POST | `/v1/admin/customers/{customer_id}/credits` | API key | - | Admin append credit ledger event |
| GET | `/v1/admin/customers/{customer_id}/credits` | API key | - | Admin customer credit ledger |
| GET | `/v1/admin/customers/{customer_id}/webhooks` | API key | - | Admin list customer webhooks |
| PUT | `/v1/admin/customers/{customer_id}/webhooks` | API key | - | Admin register or update customer webhook |

## Observatory

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| POST | `/v1/observatory/share` | Public | - | Create private Observatory share token |
| GET | `/v1/observatory/share/{token}` | Public | - | Resolve private Observatory share token |

## Canary

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| GET | `/v1/canary` | API key | - | Protected monitoring canary for API-key path checks |

## Color

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| POST | `/api/v1/color/cmyk-conversion` | API key | 1 | Approximate CMYK values from RGB input |
| POST | `/api/v1/color/contrast-ratio` | API key | 1 | Calculate WCAG contrast ratio between two colours |
| POST | `/api/v1/color/hex-to-rgb` | API key | 1 | Convert HEX colour to RGB array |
| POST | `/api/v1/color/hsl-to-rgb` | API key | 1 | Convert HSL colour to RGB and HEX |
| POST | `/api/v1/color/luminance` | API key | 1 | Calculate WCAG relative luminance for a colour |
| POST | `/api/v1/color/rgb-to-hex` | API key | 1 | Convert RGB values to HEX colour |
| POST | `/api/v1/color/rgb-to-hsl` | API key | 1 | Convert RGB colour to HSL |
| POST | `/api/v1/color/tint-shade` | API key | 1 | Generate tint and shade palette steps from a base colour |

## Convert

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| POST | `/api/v1/convert/area` | API key | 1 | Area unit conversion |
| POST | `/api/v1/convert/data-storage` | API key | 1 | Data storage unit conversion |
| POST | `/api/v1/convert/energy` | API key | 1 | Energy unit conversion |
| POST | `/api/v1/convert/length` | API key | 1 | Zero-cost length unit conversion |
| POST | `/api/v1/convert/power` | API key | 1 | Power unit conversion |
| POST | `/api/v1/convert/pressure` | API key | 1 | Pressure unit conversion |
| POST | `/api/v1/convert/speed` | API key | 1 | Speed unit conversion |
| POST | `/api/v1/convert/temperature` | API key | 1 | Temperature scale conversion |
| POST | `/api/v1/convert/volume` | API key | 1 | Volume unit conversion |
| POST | `/api/v1/convert/weight` | API key | 1 | Zero-cost weight and mass unit conversion |

## Holidays

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| GET | `/v1/holidays` | API key | 1 | Holidays for a jurisdiction and year |
| GET | `/v1/holidays/is-business-day` | API key | 1 | Business-day check for one date |
| GET | `/v1/holidays/next` | API key | 1 | Next holiday for a jurisdiction |

## Status

| Method | Path | Auth | Credits | Summary |
|---|---|---|---:|---|
| GET | `/v1/status` | Public | - | Public measured service status and endpoint inventory |

