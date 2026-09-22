# CalculationTime API Endpoint Audit — 2026-09-22

Every live route audited against `api-governance-rulebook.md` (v2). Source: the endpoint spreadsheet cross-checked against the live OpenAPI contract, 2026-09-21/22. Public data endpoints were called and verified live; protected calculation endpoints were audited on their documented formula/summary — no key was available from this side to verify protected-route outputs, so treat those verdicts as a starting point for review, not a final word on implementation correctness.

**Tags**: `keep` (passes all gates as-is) · `keep-conditional` (passes, but needs a build/documentation decision, or an ownership clause) · `improve` (fails today, but a named concrete change would bring it into compliance — ship the change or let it lapse) · `merge` (duplicates or is a strict subset of another route — consolidate, don't delete the capability) · `cut` (fails Gate 1, no improvement path and no authentic demand) · `needs-verification` (can't be verdicted without seeing the actual response payload) · `infra` (not a calculation endpoint, gates don't apply as written).

Per the Pruning Rule in `api-governance-rulebook.md`: nothing below should be implemented as a code change without going through the documented controlled-change process (update route code → regenerate OpenAPI → update docs/endpoint directory → tests → approval → production restart → live verification). This document is the tagging step that rule calls for, not an instruction to remove anything unreviewed.

---

## astronomy (23 routes)

| Route(s) | Tag | Reason |
|---|---|---|
| `crux-current`, `crux-hourly`, `crux-midnight` | `keep` | Unique IP (Parkes sidereal calibration). No public library replicates this — the one clean architectural-necessity pass in the family. |
| `day-length`, `solar-noon`, `twilight-calculator`, `polar-night-check`, `golden-hour`, `blue-hour`, `sun-position`, `moon-position`, `moon-phase`, `moon-illumination`, `solar-declination`, `sidereal-time`, `sidereal-conversion`, `equation-of-time`, `season-progress`, `daylight-delta`, `julian-date` | `cut` | `SunCalc.js` (~5KB, industry-standard since 2014) computes sun position, moon position, moon illumination, and every sunrise/sunset/twilight/golden-hour/solar-noon timestamp entirely client-side. A bespoke API doesn't earn authentic third-party adoption over an established free standard in this exact niche. `sidereal-conversion` and `julian-date` are additionally just fixed-formula arithmetic with no data dependency at all. |
| `zodiac-sign` | `keep-conditional` | Trivial to compute (12-entry date lookup), but "zodiac sign calculator" is a genuinely, heavily searched general-audience category not served by `SunCalc` or any dominant technical-astronomy library — that's a separate market (astrology content) from timing/ephemeris. |
| `equinox-solstice` | `improve` | Sub-minute-precision timestamps need real orbital-mechanics work (VSOP87-class series) that a naive formula won't get right. Centralize with a stated precision contract (comparable to the IRR case in finance), or cut — don't keep on "obviously needs a server" reasoning alone. |
| `ephemeris` | `needs-verification` | No visible response schema from this side. If it's a bundle of the routes above, it's cut along with them. If it includes planetary positions beyond Sun/Moon, check against `astronomy-engine` (client-side, covers Mercury–Pluto) before assuming it needs a server. |

## color (8 routes)

| Route(s) | Tag | Reason |
|---|---|---|
| `hex-to-rgb`, `rgb-to-hex`, `hsl-to-rgb`, `rgb-to-hsl` | `keep-conditional` | Genuinely, heavily used developer/designer tool with authentic standalone demand. |
| `contrast-ratio`, `luminance`, `tint-shade` | `improve` | Consolidate into one **palette-audit** route: given a full palette (not one pair), check every combination against WCAG AA/AAA and return remediation (nearest compliant shade). That's a real feature; three bare single-pair formulas are not. |
| `cmyk-conversion` | `cut` | Print-specific, narrower audience, weaker standalone demand than the RGB/HEX/HSL cluster. |

## convert (10 routes)

| Route(s) | Tag | Reason |
|---|---|---|
| `length`, `weight`, `temperature`, `volume`, `speed`, `area`, `data-storage` | `keep-conditional` | Everyday, mass-searched conversion categories with real, authentic demand. `area` also fits the tradie/construction audience. |
| `energy`, `power`, `pressure` | `cut` | Specialized engineering/physics units — real but narrow audience, weaker standalone demand. |

Note: two of the ten are labeled "zero-cost" in their own current summary. If a route markets itself as zero-cost, that's already a signal it shouldn't be a metered, keyed API call.

## crypto (5 routes)

| Route(s) | Tag | Reason |
|---|---|---|
| `base64-encode`, `base64-decode`, `hash-sha256`, `hash-sha512` | `keep-conditional` | Real demand from a named consumer: no-code platforms (Zapier, Make) have no code-execution step, so encoding/hashing is a genuine gap for that audience. Quick online base64/hash tools also see real standalone traffic. |
| `hash-md5` | `cut` | Non-negotiable regardless of demand. MD5 is a broken hash function; making it easier to reach makes the liability worse, not better. |

## data (22 raw routes / 11 canonical operations)

| Operation(s) | Tag | Reason |
|---|---|---|
| `countries`, `timezones`, `mime-types` | `keep` | Change often enough (border/currency changes, DST law changes, new MIME registrations) that live delivery has real value over a bundled static file. |
| `elements`, `constants`, `materials/density`, `unicode-blocks`, `constellations`, `stars/bright`, `meteor-showers`, `http-status` | `keep` | Essentially static, but has real standalone value as a public reference-data product for third-party developers who don't want to fork a static file (comparable to public-good APIs like restcountries.com) — a product argument, not an architectural-necessity one. |
| all 11, served at `/api/v1/data/*` **and** `/v1/data/*` | `merge` | Identical payloads at two paths — the clearest Gate 2 violation in the contract. `/v1/data/*` should be canonical (matches `/v1/status`'s self-description); deprecate `/api/v1/data/*` with a redirect. |

## finance (24 routes)

| Route(s) | Tag | Reason |
|---|---|---|
| `tip-split`, `discount-calculator`, `salestax`, `simple-interest`, `compound-interest`, `roi`, `rule-of-72`, `cagr`, `freelancer-rate`, `tax-extraction`, `depreciation-declining`, `depreciation-straight-line` | `keep-conditional` | Mainstream personal/small-business finance calculators — among the most heavily used, authentically searched tools on the web. Depreciation and freelancer-rate serve a narrower but real small-business/gig-economy audience. |
| `loan-amortization` + `loan-amortization-summary` + `loan-payoff-extra` | `merge` → `keep-conditional` | Consolidate to one route (three routes for one calculation is a Gate 2 violation); mortgage/loan calculators are among the most-used financial tools on the internet on their own merits. Recommended (not required) enhancement: real weekend/holiday-aware payment dates via the jurisdiction holiday data, or a downloadable schedule. |
| `markup-margin` + `margin-markup` + `markup-margin-split` | `merge` → `keep-conditional` | One formula, three routes from different input variables — consolidate to one route accepting all input shapes. |
| `break-even` + `break-even-multi` | `merge` → `keep-conditional` | Same pattern as above. |
| `irr-approximation` + `npv` | `improve` | Stay on the precision-contract track, not the popularity track — the case here was always "easy to get subtly wrong," not "commonly searched for." Consolidate with a stated numerical-precision guarantee across batch scenarios, or cut. |
| `bond-yield` | `improve` | Only worth keeping if wired to a live market-data feed (real yield curves). As a bare formula it's too narrow an audience to clear the popularity bar on its own. |
| `effective-annual-rate` | `cut` | Technical/actuarial term, real use but thin standalone public demand — normally embedded inside other tools rather than searched for directly. |

## math (35 routes)

| Route(s) | Tag | Reason |
|---|---|---|
| `pythagorean-solve`, `quadratic-solver`, `percentage-change`, `gcd-lcm`, `combinatorics`, `base-n-convert`, `heat-index`, `wind-chill` | `keep-conditional` | Genuinely mainstream, heavily searched, authentic standalone demand. Heat-index/wind-chill are real weather-safety tools, not academic curiosities. |
| `percent-error`, `proportion-solver`, `triangle-heron`, `fibonacci`, `factorial-gamma`, `exponent-eval`, `logarithm-eval` | `keep-conditional` | Real demand, but a narrower homework-help/student/lab-science audience rather than mass-consumer — worth flagging the tier difference honestly. |
| `quadratic-vertex` | `merge` → `quadratic-solver` | Same underlying calculation. |
| `circle-sector` | `merge` → `circle-geometry` | Same shape, overlapping outputs. |
| `sphere-surface` | `merge` → `sphere-geometry` | Same shape, overlapping outputs. |
| `statistics-summary`, `percentile-calc` | `improve` | Only clears Gate 1 if it computes against a dataset the server already holds (a published table, or a customer's stored history), so the caller isn't shipping the full array just to get a summary back. Also doesn't pass the popularity test — it's an integration primitive, not something searched for directly. |
| `arithmetic-progression`, `geometric-progression`, `cone-geometry`, `torus-geometry`, `cylinder-geometry`, `matrix-multiply`, `matrix-determinant`, `vector-dot-product`, `vector-magnitude`, `ohm-law`, `kinetic-energy`, `potential-energy`, `projectile-range` | `cut` | Academic/engineering-textbook formulas. Technically usable by someone, but thin real-world standalone demand and no authentic-recommendation case — the bar that matters more than technical possibility. |

## network (10 routes)

| Route(s) | Tag | Reason |
|---|---|---|
| `uuid-v5`, `cidr-range`, `slug-sanitize` | `keep-conditional` | Genuine, authentic professional tools with real standalone traffic (UUID generators, subnet calculators, slug generators are classic bookmarked utilities). |
| `mime-lookup`, `http-status-lookup`, `port-lookup` | `improve` | Bare lookup wrappers today; two duplicate `/v1/data/mime-types` and `/v1/data/http-status` directly (Gate 2). Back all three with a genuinely maintained, versioned dataset (publish `/v1/data/ports` the same way) with real cache headers, or cut them. |
| `ip-parse`, `mac-format`, `query-string-parse`, `user-agent-parse` | `cut` | Thin standalone demand, and `user-agent-parse` specifically is already well-served by `ua-parser-js`, a standard free client-side library — the caller already has the UA string in hand (it's a POST input), so there's no scenario where the server holds information the client doesn't. |

## date + schedule (25 routes)

| Route(s) | Tag | Reason |
|---|---|---|
| `business-days/jurisdiction` | `keep` | Genuine external-data dependency (maintained per-country holiday calendars). |
| `business-days`, `business-days-add`, `countdown-workdays`, `workday-shift` | `improve` | Currently take caller-supplied holidays, which is why they're pure client-doable math today. Wire to the jurisdiction holiday data instead, so working-day math is correct without the caller sourcing their own holiday list. |
| `add`, `age-breakdown`, `age-in-days`, `calendar-range`, `countdown-precise`, `days-in-month`, `difference`, `difference/batch`, `epoch-converter`, `iso-week`, `leap-year-check`, `quarter-calculator` | `keep-conditional` | Age/date-difference calculators and Unix timestamp converters are among the most-used calculator tools on the web. ISO-week/quarter-calculator serve a real payroll/fiscal-reporting audience. `calendar-range` rests on the polyglot-consistency case rather than standalone popularity. |
| `timezone-offset` | `cut` | Explicitly incomplete per its own summary ("without DST lookup") — recommend removing rather than shipping a route that's admittedly wrong for half the year in DST regions. |
| `cron-parser` | `cut` | `crontab.guru` already owns this exact niche; a lesser-known competitor doesn't earn authentic recommendations over the established standard. |
| `date-range-split`, `interval-overlap`, `project-timeline`, `recurring-monthly`, `shift-calculator`, `time-blocks` | `cut` | Niche ops/scheduling-specific tools, thin standalone consumer demand. |

## holidays (3 routes)

| Route(s) | Tag | Reason |
|---|---|---|
| `holidays`, `is-business-day`, `next` | `keep-conditional` | Genuine external-data dependency, clean Gate 1 pass. **Condition**: needs a named owner and an annual per-jurisdiction review date — undated, this quietly goes wrong every time a country changes a public holiday. |

## geo (6 routes)

| Route(s) | Tag | Reason |
|---|---|---|
| `elevation`, `nearby` | `keep` | Elevation needs a real terrain dataset (can't ship to a browser); `nearby` is a database query over stored points, not a formula. |
| `midpoint` | `keep-conditional` | "Find the midpoint between two addresses to meet someone" is a real, authentic consumer use case — dedicated sites for exactly this exist and get real traffic. |
| `distance`, `distance/batch` | `improve` | Flat haversine math today (client-doable). Extended to account for elevation gain/loss along the path, this becomes a genuine composite of two datasets — a "trail distance" feature worth a server route. Without that, cut. |
| `bounding-box` | `cut` | Developer/GIS-integration primitive, thin standalone demand. |

## health (5 routes)

| Route(s) | Tag | Reason |
|---|---|---|
| `bmi`, `bmr`, `tdee`, `macro-split`, `pace-calculator` | `keep-conditional` | Some of the most heavily used, authentically searched-for tools on the internet — fitness apps, trainers, and health content all lean on exactly these. A population-percentile dataset would make them richer, but isn't a precondition for keeping them. |

## payroll (1 route)

| Route(s) | Tag | Reason |
|---|---|---|
| `decimal-hours` | `keep-conditional` | Real, if niche, tool for anyone doing manual payroll or timesheets. |

## solar (1 route)

| Route(s) | Tag | Reason |
|---|---|---|
| `solar/position` | `merge` → `astronomy/sun-position` | Same operation split across two families — but note `sun-position` itself is tagged `cut` above (`SunCalc.js` covers it), so this is effectively a double-cut, not a true merge. |

## stats (1 route)

| Route(s) | Tag | Reason |
|---|---|---|
| `stats/summary` | `merge` → `math/statistics-summary` | Duplicates the same output under a different family name. Follows `statistics-summary`'s fate above (`improve` if rebuilt against server-held data, otherwise both are cut). |

## time (3 routes)

| Route(s) | Tag | Reason |
|---|---|---|
| `time`, `time/batch` | `keep` | DST/offset rules are already in every browser (`Intl.DateTimeFormat`) — the genuinely hard client-side piece is coordinate → IANA timezone *name* resolution, which needs geographic boundary polygon data. Small client packages (`tz-lookup`, `geo-tz`) exist, so the real argument for keeping this server-side is page-weight (not bundling multi-MB boundary data into every page), not technical impossibility. |
| `time/utc` | `improve` | Currently mirrors the client's own clock (`new Date().toISOString()`). The response already carries an unused `sla_claimed: false` field — if clock accuracy is backed by real external monitoring evidence, this becomes a legitimate sync-check endpoint. Ship that claim for real, or cut. |

## tradie (6 routes)

| Route(s) | Tag | Reason |
|---|---|---|
| `cis-deduction`, `invoice-aging`, `job-margin`, `mileage-claim`, `tool-depreciation`, `vat-return-summary` | `improve` | The underlying math isn't "heavy" — comparable in complexity to finance routes cut elsewhere. What legitimizes it is the same argument as `holidays`: tie these to a maintained, versioned tax-year rate table (UK CIS %, VAT rates, mileage reimbursement rates) instead of hardcoded constants. Do that and it's a clean `keep`; ship bare formulas with no rate table behind them and it's no different from the finance routes that were cut. Same ownership/review-date clause as `holidays` applies once the rate table exists. |

## Infrastructure (not calculation endpoints)

| Route(s) | Tag | Reason |
|---|---|---|
| `/`, `/health`, `/openapi.json`, `/v1/status`, `/v1/canary`, `/v1/account/*` | `infra` | Keep as-is, gates don't apply. |
| `/v1/admin/*` (7 routes) | `infra`, but **remove from the public `openapi.json`** | Internal customer-management routes; a third-party developer has no reason to see them (Rulebook §Public Contract Hygiene). |
| `/v1/observatory/share*` | `infra` | Storage/session carve-out (Rulebook) — state persistence, not a calculation. |
| `utility/tagline` | `keep` | Harmless, no cost, arguably marketing rather than API surface. |
| `px-to-rem` | `keep-conditional` | Genuinely commonly used frontend-dev tool (responsive design work). |
| `line-height` | `cut` | Usually wanted as part of a broader type-scale tool rather than requested alone. |

---

## Summary

Of the ~105 canonical operations (deduplicating the `/api/v1/data` vs `/v1/data` split):

- **`keep`**: ~13 — the Crux clock, the 11 reference-data tables (once deduplicated), geo elevation/nearby, time/time-batch, observatory, infra.
- **`keep-conditional`**: ~51 — genuinely, authentically popular calculator categories that are pure formulas but real. Condition: each needs to actually ship with real documentation as part of a deliberate utility layer, not survive as an undocumented leftover route. Includes `holidays` (3, condition is ownership/review-date rather than documentation).
- **`improve`**: ~9 — ships only with the named enhancement (precision contract, live data feed, holiday-awareness, rate-table backing, dataset backing). Treat "improve" as "ship the change or let the deprecation deadline pass," not as a soft keep.
- **`needs-verification`**: `ephemeris` (1) — can't be tagged confidently without seeing its actual response payload.
- **`merge`**: ~7 — collapse into a surviving sibling route; the capability survives, the duplication doesn't.
- **`cut`**: ~26 — the routes with neither an architectural-necessity case nor authentic real-world demand. Concentrated in `astronomy` (21 of 23 — a single dominant free library already owns that niche), academic/engineering-textbook `math` (13), niche `network`/`date` utilities (12 combined), specialist `convert`/`finance` units (4), plus `hash-md5` (security, non-negotiable), `cmyk-conversion`, `line-height`, `bounding-box`.

This is a tagging pass, not an execution order. Anything tagged `cut` or `merge` should go through the Pruning Rule's controlled-change process before code changes, and anything tagged `keep-conditional` needs an explicit decision to actually document and ship it as a supported part of the API — silence defaults to neither removed nor properly supported, which is worse than either.
