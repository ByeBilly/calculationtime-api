import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import Fastify, { LogController } from 'fastify';
import { createApiKeyAuth, createRateLimiter } from './auth.js';
import { createCache, stableCacheKey } from './cache.js';
import { createGeoStore } from './geo-store.js';
import { createKeyStore } from './key-store.js';
import { getTimeForCoordinate } from './time-service.js';
import { batchDistanceBetweenPoints, boundingBox, distanceBetweenPoints, midpointBetweenPoints } from './geo-service.js';
import { elevationForCoordinate } from './elevation-service.js';
import {
  addToDate,
  ageBreakdown,
  batchDateDifference,
  businessDays,
  businessDaysAdd,
  calendarRange,
  countdownPrecise,
  dateDifference,
  daysInMonth,
  epochConverter,
  isoWeek,
  leapYearCheck,
  quarterCalculator,
  timezoneOffset
} from './date-service.js';
import {
  businessDaysInJurisdiction,
  holidaysForYear,
  isBusinessDayInJurisdiction,
  nextHoliday
} from './holiday-service.js';
import {
  cruxCurrent,
  cruxHourly,
  cruxMidnightRange,
  blueHour,
  dayLength,
  daylightDelta,
  ephemerisForDate,
  equationOfTime,
  equinoxSolstice,
  goldenHour,
  julianDate,
  moonIllumination,
  moonPhase,
  moonPosition,
  polarNightCheck,
  seasonProgress,
  siderealTime,
  siderealConversion,
  solarDeclination,
  solarNoon,
  sunPosition,
  twilightCalculator,
  zodiacSign
} from './astronomy-service.js';
import { unitConversion } from './conversion-service.js';
import { base64Decode, base64Encode, hashPayload } from './crypto-service.js';
import {
  ageInDays,
  baseNConvert,
  bondYield,
  breakEvenMulti,
  cmykConversion,
  cidrRange,
  contrastRatio,
  countdownWorkdays,
  cronParser,
  dateRangeSplit,
  depreciationDeclining,
  depreciationStraightLine,
  effectiveAnnualRate,
  factorialGamma,
  fibonacci,
  heatIndex,
  hexToRgb,
  hslToRgb,
  httpStatusLookup,
  intervalOverlap,
  ipParse,
  irrApproximation,
  lineHeight,
  loanPayoffExtra,
  luminance,
  macFormat,
  markupMarginSplit,
  matrixMultiply,
  mimeLookup,
  npv,
  percentileCalc,
  portLookup,
  projectTimeline,
  pxToRem,
  queryStringParse,
  quadraticVertex,
  recurringMonthly,
  rgbToHex,
  rgbToHsl,
  shiftCalculator,
  slugSanitize,
  timeBlocks,
  tintShade,
  tipSplit,
  userAgentParse,
  uuidV5,
  vectorDotProduct,
  vectorMagnitude,
  windChill,
  workdayShift
} from './batch3-service.js';
import { solarPosition } from './solar-service.js';
import { dailyTagline, secondsUntilNextUtcMidnight } from './tagline-service.js';
import { createObservatoryShareStore } from './observatory-share-store.js';
import {
  breakEven,
  cagr,
  compoundInterest,
  decimalHours,
  discountCalculator,
  freelancerRate,
  loanAmortization,
  loanAmortizationSummary,
  marginMarkup,
  markupMargin,
  roi,
  ruleOf72,
  salesTax,
  simpleInterest,
  statsSummary,
  taxExtraction,
  tradieCisDeduction,
  tradieInvoiceAging,
  tradieJobMargin,
  tradieMileageClaim,
  tradieToolDepreciation,
  tradieVatReturnSummary
} from './business-service.js';
import { bmi, bmr, macroSplit, paceCalculator, tdee } from './health-service.js';
import {
  circleGeometry,
  combinatorics,
  arithmeticProgression,
  circleSector,
  coneGeometry,
  cylinderGeometry,
  exponentEval,
  geometricProgression,
  gcdLcm,
  kineticEnergy,
  logarithmEval,
  matrixDeterminant,
  ohmLaw,
  percentError,
  percentageChange,
  potentialEnergy,
  projectileRange,
  proportionSolver,
  pythagoreanSolve,
  quadraticSolver,
  sphereGeometry,
  statisticsSummary,
  torusGeometry,
  triangleHeron
} from './math-service.js';
import {
  brightStarsReference,
  constantsReference,
  constellationsReference,
  countriesReference,
  elementsReference,
  httpStatusReference,
  materialDensitiesReference,
  meteorShowersReference,
  mimeTypesReference,
  timezonesReference,
  unicodeBlocksReference
} from './reference-data-service.js';
import { dispatchWebhookEvent } from './webhook-dispatcher.js';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4110);
const SERVICE_VERSION = '0.1.0';
const CACHE_KEY_VERSION = `time-coordinate-api@${SERVICE_VERSION}`;
const STARTED_AT = new Date();

const ENDPOINT_FAMILIES = [
  {
    family: 'public',
    routes: [
      'GET /',
      'GET /beginner',
      'GET /learn',
      'GET /v1/learn/date-add-30',
      'GET /v1/learn/next-saturday-business-day',
      'GET /v1/learn/random-id',
      'GET /health',
      'GET /openapi.json',
      'GET /v1/status',
      'GET /v1/time/utc',
      'GET /api/v1/utility/tagline'
    ]
  },
  {
    family: 'data',
    routes: [
      'GET /v1/data/countries',
      'GET /v1/data/timezones',
      'GET /v1/data/elements',
      'GET /v1/data/constants',
      'GET /v1/data/materials/density',
      'GET /v1/data/http-status',
      'GET /v1/data/mime-types',
      'GET /v1/data/unicode-blocks',
      'GET /v1/data/constellations',
      'GET /v1/data/stars/bright',
      'GET /v1/data/meteor-showers'
    ]
  },
  {
    family: 'conversion',
    routes: [
      'POST /api/v1/convert/length',
      'POST /api/v1/convert/weight',
      'POST /api/v1/convert/temperature',
      'POST /api/v1/convert/area',
      'POST /api/v1/convert/volume',
      'POST /api/v1/convert/speed',
      'POST /api/v1/convert/pressure',
      'POST /api/v1/convert/energy',
      'POST /api/v1/convert/power',
      'POST /api/v1/convert/data-storage'
    ]
  },
  {
    family: 'crypto',
    routes: [
      'POST /api/v1/crypto/hash-sha256',
      'POST /api/v1/crypto/hash-sha512',
      'POST /api/v1/crypto/base64-encode',
      'POST /api/v1/crypto/base64-decode'
    ]
  },
  {
    family: 'schedule',
    routes: [
      'POST /api/v1/schedule/cron-parser',
      'POST /api/v1/schedule/workday-shift',
      'POST /api/v1/schedule/date-range-split',
      'POST /api/v1/schedule/interval-overlap',
      'POST /api/v1/schedule/project-timeline',
      'POST /api/v1/schedule/shift-calculator',
      'POST /api/v1/schedule/countdown-workdays',
      'POST /api/v1/schedule/recurring-monthly',
      'POST /api/v1/schedule/age-in-days',
      'POST /api/v1/schedule/time-blocks'
    ]
  },
  {
    family: 'color',
    routes: [
      'POST /api/v1/color/hex-to-rgb',
      'POST /api/v1/color/rgb-to-hex',
      'POST /api/v1/color/rgb-to-hsl',
      'POST /api/v1/color/hsl-to-rgb',
      'POST /api/v1/color/contrast-ratio',
      'POST /api/v1/color/luminance',
      'POST /api/v1/color/tint-shade',
      'POST /api/v1/color/cmyk-conversion',
      'POST /api/v1/typography/px-to-rem',
      'POST /api/v1/typography/line-height'
    ]
  },
  {
    family: 'network',
    routes: [
      'POST /api/v1/network/ip-parse',
      'POST /api/v1/network/cidr-range',
      'POST /api/v1/network/user-agent-parse',
      'POST /api/v1/network/query-string-parse',
      'POST /api/v1/network/slug-sanitize',
      'POST /api/v1/network/port-lookup',
      'POST /api/v1/network/http-status-lookup',
      'POST /api/v1/network/mime-lookup',
      'POST /api/v1/network/uuid-v5',
      'POST /api/v1/network/mac-format'
    ]
  },
  {
    family: 'time',
    routes: ['GET /v1/time', 'POST /v1/time/batch']
  },
  {
    family: 'date',
    routes: [
      'GET /v1/date/difference',
      'POST /v1/date/difference/batch',
      'GET /v1/date/add',
      'POST /v1/date/business-days',
      'POST /v1/date/business-days/jurisdiction',
      'POST /v1/date/business-days-add',
      'POST /v1/date/iso-week',
      'POST /v1/date/age-breakdown',
      'POST /v1/date/countdown-precise',
      'POST /v1/date/epoch-converter',
      'POST /v1/date/quarter-calculator',
      'POST /v1/date/leap-year-check',
      'POST /v1/date/days-in-month',
      'POST /v1/date/timezone-offset',
      'POST /v1/date/calendar-range'
    ]
  },
  {
    family: 'holiday',
    routes: ['GET /v1/holidays', 'GET /v1/holidays/next', 'GET /v1/holidays/is-business-day']
  },
  {
    family: 'geospatial',
    routes: ['GET /v1/geo/distance', 'POST /v1/geo/distance/batch', 'GET /v1/geo/midpoint', 'GET /v1/geo/bounding-box', 'GET /v1/geo/elevation', 'GET /v1/geo/nearby']
  },
  {
    family: 'solar',
    routes: ['GET /v1/solar/position']
  },
  {
    family: 'astronomy',
    routes: [
      'GET /v1/astronomy/ephemeris',
      'POST /v1/astronomy/crux-midnight',
      'POST /v1/astronomy/crux-hourly',
      'POST /v1/astronomy/crux-current',
      'POST /v1/astronomy/solar-noon',
      'POST /v1/astronomy/equinox-solstice',
      'POST /v1/astronomy/moon-phase',
      'POST /v1/astronomy/julian-date',
      'POST /v1/astronomy/sidereal-time',
      'POST /v1/astronomy/twilight-calculator',
      'POST /v1/astronomy/sun-position',
      'POST /v1/astronomy/moon-position',
      'POST /v1/astronomy/day-length',
      'POST /v1/astronomy/polar-night-check',
      'POST /api/v1/astronomy/solar-declination',
      'POST /api/v1/astronomy/equation-of-time',
      'POST /api/v1/astronomy/moon-illumination',
      'POST /api/v1/astronomy/sidereal-conversion',
      'POST /api/v1/astronomy/golden-hour',
      'POST /api/v1/astronomy/blue-hour',
      'POST /api/v1/astronomy/season-progress',
      'POST /api/v1/astronomy/zodiac-sign',
      'POST /api/v1/astronomy/daylight-delta'
    ]
  },
  {
    family: 'finance',
    routes: [
      'POST /v1/finance/margin-markup',
      'POST /v1/finance/loan-amortization',
      'POST /v1/finance/tax-extraction',
      'POST /v1/finance/freelancer-rate',
      'POST /v1/finance/simple-interest',
      'POST /v1/finance/compound-interest',
      'POST /v1/finance/loan-amortization-summary',
      'POST /v1/finance/rule-of-72',
      'POST /v1/finance/roi',
      'POST /v1/finance/discount-calculator',
      'POST /v1/finance/markup-margin',
      'POST /v1/finance/break-even',
      'POST /v1/finance/salestax',
      'POST /v1/finance/cagr',
      'POST /api/v1/finance/npv',
      'POST /api/v1/finance/irr-approximation',
      'POST /api/v1/finance/bond-yield',
      'POST /api/v1/finance/depreciation-straight-line',
      'POST /api/v1/finance/depreciation-declining',
      'POST /api/v1/finance/loan-payoff-extra',
      'POST /api/v1/finance/effective-annual-rate',
      'POST /api/v1/finance/markup-margin-split',
      'POST /api/v1/finance/break-even-multi',
      'POST /api/v1/finance/tip-split'
    ]
  },
  {
    family: 'health',
    routes: [
      'POST /v1/health/bmi',
      'POST /v1/health/bmr',
      'POST /v1/health/tdee',
      'POST /v1/health/macro-split',
      'POST /v1/health/pace-calculator'
    ]
  },
  {
    family: 'math',
    routes: [
      'POST /v1/math/quadratic-solver',
      'POST /v1/math/pythagorean-solve',
      'POST /v1/math/triangle-heron',
      'POST /v1/math/circle-geometry',
      'POST /v1/math/sphere-geometry',
      'POST /v1/math/cylinder-geometry',
      'POST /v1/math/statistics-summary',
      'POST /v1/math/percentage-change',
      'POST /v1/math/percent-error',
      'POST /v1/math/gcd-lcm',
      'POST /v1/math/matrix-determinant',
      'POST /v1/math/proportion-solver',
      'POST /v1/math/logarithm-eval',
      'POST /v1/math/exponent-eval',
      'POST /v1/math/combinatorics',
      'POST /api/v1/math/ohm-law',
      'POST /api/v1/math/projectile-range',
      'POST /api/v1/math/kinetic-energy',
      'POST /api/v1/math/potential-energy',
      'POST /api/v1/math/circle-sector',
      'POST /api/v1/math/sphere-surface',
      'POST /api/v1/math/cone-geometry',
      'POST /api/v1/math/torus-geometry',
      'POST /api/v1/math/arithmetic-progression',
      'POST /api/v1/math/geometric-progression',
      'POST /api/v1/math/matrix-multiply',
      'POST /api/v1/math/vector-magnitude',
      'POST /api/v1/math/vector-dot-product',
      'POST /api/v1/math/quadratic-vertex',
      'POST /api/v1/math/factorial-gamma',
      'POST /api/v1/math/fibonacci',
      'POST /api/v1/math/base-n-convert',
      'POST /api/v1/math/percentile-calc',
      'POST /api/v1/math/wind-chill',
      'POST /api/v1/math/heat-index'
    ]
  },
  {
    family: 'stats',
    routes: ['POST /v1/stats/summary']
  },
  {
    family: 'payroll',
    routes: ['POST /v1/payroll/decimal-hours']
  },
  {
    family: 'tradie',
    routes: ['POST /v1/tradie/job-margin', 'POST /v1/tradie/vat-return-summary', 'POST /v1/tradie/cis-deduction', 'POST /v1/tradie/mileage-claim', 'POST /v1/tradie/tool-depreciation', 'POST /v1/tradie/invoice-aging']
  },
  {
    family: 'monitoring',
    routes: ['GET /v1/canary']
  },
  {
    family: 'account',
    routes: ['GET /v1/account/profile', 'GET /v1/account/usage', 'GET /v1/account/limits', 'GET /v1/account/credits']
  },
  {
    family: 'observatory',
    routes: ['POST /v1/observatory/share', 'GET /v1/observatory/share/:token']
  }
];

export async function buildServer({
  env = process.env,
  logger,
  keyStore: suppliedKeyStore,
  geoStore: suppliedGeoStore,
  observatoryShareStore: suppliedObservatoryShareStore
} = {}) {
  const app = Fastify({
    logger: logger ?? loggerConfig(env),
    logController: new LogController({
      disableRequestLogging: true
    }),
    bodyLimit: 1024 * 1024
  });
  const keyStore = suppliedKeyStore === undefined ? createKeyStore(env) : suppliedKeyStore;
  const geoStore = suppliedGeoStore === undefined ? createGeoStore(env) : suppliedGeoStore;
  const observatoryShareStore = suppliedObservatoryShareStore === undefined
    ? createObservatoryShareStore(env)
    : suppliedObservatoryShareStore;
  const apiKeyAuth = createApiKeyAuth(env, keyStore);
  const rateLimiter = createRateLimiter(env);
  const cache = await createCache({ env, logger: app.log });
  const corsOrigins = parseCorsOrigins(env);

  app.decorate('apiKeyAuth', apiKeyAuth);
  app.decorate('cache', cache);
  app.decorate('keyStore', keyStore);
  app.decorate('geoStore', geoStore);
  app.decorate('observatoryShareStore', observatoryShareStore);

  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
  });

  app.addHook('onRequest', async (request, reply) => {
    applyCors(request, reply, corsOrigins);
    if (request.method === 'OPTIONS') {
      reply.status(204).send();
    }
  });

  app.addHook('preHandler', async (request, reply) => {
    if (!request.routeOptions.config?.protected) {
      const limitState = rateLimiter.checkPublic(request);
      applyRateLimitHeaders(reply, limitState);
      return;
    }
    if (request.routeOptions.config?.admin) {
      authenticateAdmin(request, env);
      return;
    }
    const customer = await apiKeyAuth.authenticate(request);
    const limitState = rateLimiter.check(customer);
    applyRateLimitHeaders(reply, limitState);
    request.customer = customer;
    if (request.routeOptions.config?.billable && request.server.keyStore?.checkBillableAccess) {
      request.commercialAccess = await request.server.keyStore.checkBillableAccess(customer.customerId, {
        creditCost: request.routeOptions.config?.creditCost || 1
      });
    }
  });

  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url || request.url.split('?')[0];
    const usageEvent = {
      customerId: request.customer?.customerId,
      route,
      method: request.method,
      statusCode: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
      creditCost: request.routeOptions.config?.creditCost || 1
    };
    if (request.server.keyStore && request.customer?.authenticated) {
      request.server.keyStore.recordUsage(usageEvent)
        .catch((error) => request.log.warn({ error: error.message }, 'usage_record_failed'));
      if (request.routeOptions.config?.billable && reply.statusCode >= 200 && reply.statusCode < 400) {
        request.server.keyStore.debitBillableRequest?.(request.customer.customerId, usageEvent)
          .catch((error) => request.log.error({ error: error.message, code: error.code }, 'credit_debit_failed'));
        dispatchWebhookEvent({ request, reply, usageEvent })
          .catch((error) => request.log.warn({ error: error.message, route }, 'webhook_dispatch_failed'));
      }
    }

    request.log.info({
      method: request.method,
      route,
      status_code: reply.statusCode,
      duration_ms: Math.round(reply.elapsedTime),
      customer_id: request.customer?.customerId || 'public',
      api_key_fingerprint: request.customer?.keyFingerprint,
      cache: request.cacheStatus || 'not_applicable'
    }, 'api_request_completed');
  });

  app.addHook('onClose', async () => {
    await keyStore?.close?.();
    await geoStore?.close?.();
  });

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = error.statusCode || 500;
    const isInvalidJson = error.code === 'FST_ERR_CTP_INVALID_JSON_BODY';
    if (error.rateLimit) {
      applyRateLimitHeaders(reply, error.rateLimit);
      reply.header('Retry-After', String(error.rateLimit.retryAfterSeconds));
    }
    reply.status(statusCode).send({
      error: {
        code: isInvalidJson ? 'invalid_json' : error.code || 'internal_error',
        message: isInvalidJson ? 'Request body must be valid JSON' : error.message || 'Internal server error'
      }
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      error: {
        code: 'not_found',
        message: 'Endpoint not found'
      }
    });
  });

  app.get('/health', async () => ({
    ok: true,
    service: 'time-coordinate-api',
    version: SERVICE_VERSION,
    api_key_required: apiKeyAuth.enabled,
    api_keys_configured: apiKeyAuth.configured,
    persistent_key_store: Boolean(keyStore),
    cache: cache.name
  }));

  app.get('/v1/time/utc', async () => {
    const now = new Date();
    return {
      utc_time: now.toISOString(),
      unix_seconds: Math.floor(now.getTime() / 1000),
      unix_milliseconds: now.getTime(),
      precision: 'server_clock_millisecond_timestamp',
      clock_source: 'host_system_clock',
      accuracy_model: {
        statement: 'Current UTC is read from the API host system clock. Public accuracy claims require external monitoring evidence.',
        sla_claimed: false
      }
    };
  });

  app.get('/v1/status', async () => ({
    ok: true,
    service: 'time-coordinate-api',
    version: SERVICE_VERSION,
    started_at: STARTED_AT.toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    api_key_required: apiKeyAuth.enabled,
    cache: cache.name,
    endpoint_families: ENDPOINT_FAMILIES,
    measured_status_wording: 'Live single-origin beta API. Health and route tests pass, but no public SLA is claimed yet.',
    sla_claimed: false,
    monitoring: {
      low_level_health: '/health',
      public_status: '/v1/status',
      protected_canary: '/v1/canary',
      external_sla_history: 'not_yet_published'
    }
  }));

  app.get('/', async (_request, reply) => {
    const readme = await readFile(new URL('../docs/README.md', import.meta.url), 'utf8');
    reply.type('text/markdown; charset=utf-8').send(readme);
  });

  app.get('/beginner', async (_request, reply) => {
    const guide = await readFile(new URL('../docs/beginner-api-gateway.md', import.meta.url), 'utf8');
    reply.type('text/markdown; charset=utf-8').send(guide);
  });

  app.get('/learn', async (_request, reply) => {
    const page = await readFile(new URL('../docs/api-learning-ladder.html', import.meta.url), 'utf8');
    reply.type('text/html; charset=utf-8').send(page);
  });

  app.get('/openapi.json', async (_request, reply) => {
    const spec = await readFile(new URL('../docs/openapi.json', import.meta.url), 'utf8');
    reply.type('application/json; charset=utf-8').send(spec);
  });

  app.get('/api/v1/utility/tagline', async (_request, reply) => {
    const ttlSeconds = Math.min(43_200, secondsUntilNextUtcMidnight());
    reply.header('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}, stale-while-revalidate=3600`);
    reply.header('CDN-Cache-Control', `public, max-age=${ttlSeconds}`);
    reply.header('Vercel-CDN-Cache-Control', `public, s-maxage=${ttlSeconds}`);
    return dailyTagline();
  });

  app.get('/v1/learn/date-add-30', async () => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      lesson: 'add_30_days_to_today',
      ...addToDate({ start: today, days: 30 }),
      note: 'Public fixed learning demo. The full date-add endpoint requires an API key.'
    };
  });

  app.get('/v1/learn/next-saturday-business-day', async () => {
    const today = new Date();
    const currentDay = today.getUTCDay();
    const daysUntilSaturday = (6 - currentDay + 7) % 7 || 7;
    const saturday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysUntilSaturday));
    const date = saturday.toISOString().slice(0, 10);
    return {
      lesson: 'is_next_saturday_a_business_day',
      input: { date },
      is_business_day: false,
      answer: 'No. Saturday is treated as a weekend day in this beginner demo.',
      weekend_definition: 'Saturday and Sunday excluded',
      note: 'Public fixed learning demo. Jurisdiction-aware business-day endpoints require an API key.'
    };
  });

  app.get('/v1/learn/random-id', async () => ({
    lesson: 'generate_a_random_id',
    id: randomUUID(),
    format: 'uuid_v4',
    note: 'Public fixed learning demo. Production UUID and network utility endpoints may require an API key.'
  }));

  registerReferenceRoute(app, '/v1/data/countries', 'data.countries', countriesReference);
  registerReferenceRoute(app, '/v1/data/timezones', 'data.timezones', timezonesReference, { ttlSeconds: 86_400 });
  registerReferenceRoute(app, '/v1/data/elements', 'data.elements', elementsReference);
  registerReferenceRoute(app, '/v1/data/constants', 'data.constants', constantsReference);
  registerReferenceRoute(app, '/v1/data/materials/density', 'data.materials_density', materialDensitiesReference);
  registerReferenceRoute(app, '/v1/data/http-status', 'data.http_status', httpStatusReference);
  registerReferenceRoute(app, '/v1/data/mime-types', 'data.mime_types', mimeTypesReference);
  registerReferenceRoute(app, '/v1/data/unicode-blocks', 'data.unicode_blocks', unicodeBlocksReference);
  registerReferenceRoute(app, '/v1/data/constellations', 'data.constellations', constellationsReference);
  registerReferenceRoute(app, '/v1/data/stars/bright', 'data.stars_bright', brightStarsReference);
  registerReferenceRoute(app, '/v1/data/meteor-showers', 'data.meteor_showers', meteorShowersReference);

  registerReferenceRoute(app, '/api/v1/data/countries', 'data.countries.alias', countriesReference);
  registerReferenceRoute(app, '/api/v1/data/timezones', 'data.timezones.alias', timezonesReference, { ttlSeconds: 86_400 });
  registerReferenceRoute(app, '/api/v1/data/elements', 'data.elements.alias', elementsReference);
  registerReferenceRoute(app, '/api/v1/data/constants', 'data.constants.alias', constantsReference);
  registerReferenceRoute(app, '/api/v1/data/materials/density', 'data.materials_density.alias', materialDensitiesReference);
  registerReferenceRoute(app, '/api/v1/data/http-status', 'data.http_status.alias', httpStatusReference);
  registerReferenceRoute(app, '/api/v1/data/mime-types', 'data.mime_types.alias', mimeTypesReference);
  registerReferenceRoute(app, '/api/v1/data/unicode-blocks', 'data.unicode_blocks.alias', unicodeBlocksReference);
  registerReferenceRoute(app, '/api/v1/data/constellations', 'data.constellations.alias', constellationsReference);
  registerReferenceRoute(app, '/api/v1/data/stars/bright', 'data.stars_bright.alias', brightStarsReference);
  registerReferenceRoute(app, '/api/v1/data/meteor-showers', 'data.meteor_showers.alias', meteorShowersReference);

  app.post('/v1/observatory/share', async (request, reply) => {
    reply.header('X-Robots-Tag', 'noindex, nofollow');
    const share = await request.server.observatoryShareStore.create(request.body || {});
    reply.status(201).send({
      token: share.token,
      share_url: `https://calculationtime.com/observatory/share/${share.token}/`,
      expires_at: share.expires_at
    });
  });

  app.get('/v1/observatory/share/:token', async (request, reply) => {
    reply.header('X-Robots-Tag', 'noindex, nofollow');
    const record = await request.server.observatoryShareStore.get(request.params.token);
    if (!record) {
      reply.status(404).send({
        error: {
          code: 'share_not_found',
          message: 'Share token not found or expired'
        }
      });
      return;
    }
    reply.send({
      token: record.token,
      ...record.payload,
      expires_at: record.expires_at
    });
  });

  app.get('/v1/canary', protectedRoute(), async (request) => ({
    ok: true,
    service: 'time-coordinate-api',
    version: SERVICE_VERSION,
    canary: 'protected_endpoint_reachable',
    customer_id: request.customer?.customerId || 'unknown',
    timestamp: new Date().toISOString()
  }));

  app.get('/v1/account/credits', protectedRoute(), async (request) => {
    if (!request.server.keyStore?.getAccountCredits) {
      return {
        customer_id: request.customer?.customerId || 'local_development',
        status: 'local_development',
        plan: {
          rate_limit_per_minute: request.customer?.rateLimitPerMinute || null
        },
        usage: {
          requests_this_month: null
        },
        credits: {
          configured: false,
          balance: null,
          unit: 'api_credit',
          note: 'A persistent API database is required for credit balances.'
        }
      };
    }

    const account = await request.server.keyStore.getAccountCredits(request.customer.customerId);
    if (!account) {
      throw Object.assign(new Error('Authenticated customer account was not found'), {
        statusCode: 404,
        code: 'account_not_found'
      });
    }

    return account;
  });

  app.get('/v1/account/profile', protectedRoute(), async (request) => {
    if (!request.server.keyStore?.getAccountProfile) {
      return localAccountProfile(request);
    }

    const account = await request.server.keyStore.getAccountProfile(request.customer.customerId);
    if (!account) {
      throw Object.assign(new Error('Authenticated customer account was not found'), {
        statusCode: 404,
        code: 'account_not_found'
      });
    }

    return account;
  });

  app.get('/v1/account/usage', protectedRoute(), async (request) => {
    if (!request.server.keyStore?.getAccountUsage) {
      return {
        customer_id: request.customer?.customerId || 'local_development',
        status: 'local_development',
        usage: {
          configured: false,
          window: 'current_month',
          requests_this_month: null,
          successful_requests_this_month: null,
          error_requests_this_month: null,
          by_route: [],
          note: 'A persistent API database is required for usage breakdowns.'
        }
      };
    }

    const account = await request.server.keyStore.getAccountUsage(request.customer.customerId);
    if (!account) {
      throw Object.assign(new Error('Authenticated customer account was not found'), {
        statusCode: 404,
        code: 'account_not_found'
      });
    }

    return account;
  });

  app.get('/v1/account/limits', protectedRoute(), async (request) => {
    if (!request.server.keyStore?.getAccountLimits) {
      return {
        customer_id: request.customer?.customerId || 'local_development',
        status: 'local_development',
        limits: {
          configured: false,
          rate_limit_per_minute: request.customer?.rateLimitPerMinute || null,
          batch_limits: ACCOUNT_BATCH_LIMITS,
          note: 'Persistent customer plan limits are not configured for this API database.'
        }
      };
    }

    const account = await request.server.keyStore.getAccountLimits(request.customer.customerId);
    if (!account) {
      throw Object.assign(new Error('Authenticated customer account was not found'), {
        statusCode: 404,
        code: 'account_not_found'
      });
    }

    return account;
  });

  app.post('/v1/admin/customers', adminRoute(), async (request, reply) => {
    if (!request.server.keyStore?.createOrUpdateCustomer) {
      throw Object.assign(new Error('A persistent API database is required for customer management'), {
        statusCode: 503,
        code: 'account_database_unavailable'
      });
    }

    const body = request.body || {};
    const customer = await request.server.keyStore.createOrUpdateCustomer({
      slug: body.customer_id || body.slug,
      displayName: body.display_name,
      rateLimitPerMinute: body.rate_limit_per_minute || 120,
      status: body.status || 'active'
    });
    reply.status(201).send(customer);
  });

  app.get('/v1/admin/customers', adminRoute(), async (request) => {
    if (!request.server.keyStore?.listCustomers) {
      throw Object.assign(new Error('A persistent API database is required for customer listing'), {
        statusCode: 503,
        code: 'account_database_unavailable'
      });
    }

    return request.server.keyStore.listCustomers({
      limit: request.query.limit,
      includeInactive: request.query.include_inactive === 'true' || request.query.include_inactive === '1'
    });
  });

  app.get('/v1/admin/customers/:customer_id', adminRoute(), async (request) => {
    if (!request.server.keyStore?.getCustomerDetail) {
      throw Object.assign(new Error('A persistent API database is required for customer details'), {
        statusCode: 503,
        code: 'account_database_unavailable'
      });
    }

    const customer = await request.server.keyStore.getCustomerDetail(request.params.customer_id);
    if (!customer) {
      throw Object.assign(new Error('Customer account was not found'), {
        statusCode: 404,
        code: 'account_not_found'
      });
    }
    return customer;
  });

  app.post('/v1/admin/customers/:customer_id/credits', adminRoute(), async (request, reply) => {
    if (!request.server.keyStore?.grantCredits) {
      throw Object.assign(new Error('A persistent API database is required for credit grants'), {
        statusCode: 503,
        code: 'account_database_unavailable'
      });
    }

    const grant = await request.server.keyStore.grantCredits(request.params.customer_id, {
      delta: request.body?.delta,
      reason: request.body?.reason,
      reference: request.body?.reference,
      metadata: request.body?.metadata,
      createdBy: 'api_admin'
    });
    if (!grant) {
      throw Object.assign(new Error('Customer account was not found'), {
        statusCode: 404,
        code: 'account_not_found'
      });
    }
    reply.status(201).send(grant);
  });

  app.get('/v1/admin/customers/:customer_id/credits', adminRoute(), async (request) => {
    if (!request.server.keyStore?.listCreditLedger) {
      throw Object.assign(new Error('A persistent API database is required for credit ledger history'), {
        statusCode: 503,
        code: 'account_database_unavailable'
      });
    }

    const ledger = await request.server.keyStore.listCreditLedger(request.params.customer_id, {
      limit: request.query.limit
    });
    if (!ledger) {
      throw Object.assign(new Error('Customer account was not found'), {
        statusCode: 404,
        code: 'account_not_found'
      });
    }
    return ledger;
  });

  app.get('/v1/admin/customers/:customer_id/webhooks', adminRoute(), async (request) => {
    if (!request.server.keyStore?.listCustomerWebhooks) {
      throw Object.assign(new Error('A persistent API database is required for webhook management'), {
        statusCode: 503,
        code: 'account_database_unavailable'
      });
    }

    const webhooks = await request.server.keyStore.listCustomerWebhooks(request.params.customer_id);
    if (!webhooks) {
      throw Object.assign(new Error('Customer account was not found'), {
        statusCode: 404,
        code: 'account_not_found'
      });
    }
    return webhooks;
  });

  app.put('/v1/admin/customers/:customer_id/webhooks', adminRoute(), async (request, reply) => {
    if (!request.server.keyStore?.upsertCustomerWebhook) {
      throw Object.assign(new Error('A persistent API database is required for webhook management'), {
        statusCode: 503,
        code: 'account_database_unavailable'
      });
    }

    const webhook = await request.server.keyStore.upsertCustomerWebhook(request.params.customer_id, request.body || {});
    if (!webhook) {
      throw Object.assign(new Error('Customer account was not found'), {
        statusCode: 404,
        code: 'account_not_found'
      });
    }
    reply.status(201).send(webhook);
  });

  app.get('/v1/time', billableRoute(), async (request, reply) => {
    const input = {
      lat: request.query.lat,
      lon: request.query.lon,
      at: request.query.at
    };

    if (!input.at) {
      return getTimeForCoordinate(input);
    }

    return cached(request, reply, 'time.coordinate.explicit', input, () => getTimeForCoordinate(input));
  });

  app.post('/v1/time/batch', billableRoute(), async (request, reply) => {
    const body = request.body || {};
    const points = Array.isArray(body.points) ? body.points : [];
    if (points.length === 0 || points.length > 100) {
      throw Object.assign(new Error('points must contain 1 to 100 coordinate objects'), {
        statusCode: 400,
        code: 'invalid_batch'
      });
    }

    const input = {
      at: body.at,
      points: points.map((point) => ({
        lat: point.lat,
        lon: point.lon,
        at: point.at ?? body.at
      }))
    };

    if (!body.at && points.some((point) => !point.at)) {
      const results = points.map((point, index) => ({
        index,
        ...getTimeForCoordinate({
          lat: point.lat,
          lon: point.lon,
          at: point.at ?? body.at
        })
      }));
      return { count: results.length, results };
    }

    return cached(request, reply, 'time.batch.explicit', input, () => {
      const results = points.map((point, index) => ({
        index,
        ...getTimeForCoordinate({
          lat: point.lat,
          lon: point.lon,
          at: point.at ?? body.at
        })
      }));
      return { count: results.length, results };
    });
  });

  app.get('/v1/geo/distance', billableRoute(), async (request, reply) => (
    cached(request, reply, 'geo.distance', request.query, () => distanceBetweenPoints(request.query))
  ));

  app.post('/v1/geo/distance/batch', billableRoute(), async (request, reply) => {
    const input = request.body || {};
    return cached(request, reply, 'geo.distance_batch', input, () => batchDistanceBetweenPoints(input));
  });

  app.get('/v1/geo/midpoint', billableRoute(), async (request, reply) => (
    cached(request, reply, 'geo.midpoint', request.query, () => midpointBetweenPoints(request.query))
  ));

  app.get('/v1/geo/bounding-box', billableRoute(), async (request, reply) => (
    cached(request, reply, 'geo.bounding_box', request.query, () => boundingBox(request.query))
  ));

  app.get('/v1/geo/elevation', billableRoute(), async (request, reply) => (
    cached(
      request,
      reply,
      'geo.elevation',
      request.query,
      () => elevationForCoordinate(request.query, { env }),
      deterministicCache(2_592_000)
    )
  ));

  app.get('/v1/geo/nearby', billableRoute(), async (request) => {
    if (!request.server.geoStore) {
      throw Object.assign(new Error('Geo point store is not configured'), {
        statusCode: 503,
        code: 'geo_store_unavailable'
      });
    }
    return request.server.geoStore.nearby(request.query);
  });

  app.get('/v1/date/difference', billableRoute(), async (request, reply) => (
    cached(request, reply, 'date.difference', request.query, () => dateDifference(request.query))
  ));

  app.post('/v1/date/difference/batch', billableRoute(), async (request, reply) => {
    const input = request.body || {};
    return cached(request, reply, 'date.difference_batch', input, () => batchDateDifference(input));
  });

  app.get('/v1/date/add', billableRoute(), async (request, reply) => (
    cached(request, reply, 'date.add', request.query, () => addToDate(request.query))
  ));

  app.post('/v1/date/business-days', billableRoute(), async (request, reply) => {
    const input = request.body || {};
    return cached(request, reply, 'date.business_days', input, () => businessDays(input));
  });

  app.post('/v1/date/business-days/jurisdiction', billableRoute(), async (request, reply) => {
    const input = request.body || {};
    return cached(request, reply, 'date.business_days_jurisdiction', input, () => businessDaysInJurisdiction(input));
  });

  app.post('/v1/date/business-days-add', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'date.business_days_add', request.body || {}, () => businessDaysAdd(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/date/iso-week', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'date.iso_week', request.body || {}, () => isoWeek(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/date/age-breakdown', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'date.age_breakdown', request.body || {}, () => ageBreakdown(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/date/countdown-precise', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'date.countdown_precise', request.body || {}, () => countdownPrecise(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/date/epoch-converter', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'date.epoch_converter', request.body || {}, () => epochConverter(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/date/quarter-calculator', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'date.quarter_calculator', request.body || {}, () => quarterCalculator(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/date/leap-year-check', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'date.leap_year_check', request.body || {}, () => leapYearCheck(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/date/days-in-month', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'date.days_in_month', request.body || {}, () => daysInMonth(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/date/timezone-offset', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'date.timezone_offset', request.body || {}, () => timezoneOffset(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/date/calendar-range', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'date.calendar_range', request.body || {}, () => calendarRange(request.body || {}), deterministicCache(604_800))
  ));

  app.get('/v1/holidays', billableRoute(), async (request, reply) => (
    cached(request, reply, 'holidays.year', request.query, () => holidaysForYear(request.query))
  ));

  app.get('/v1/holidays/next', billableRoute(), async (request, reply) => (
    cached(request, reply, 'holidays.next', request.query, () => nextHoliday(request.query))
  ));

  app.get('/v1/holidays/is-business-day', billableRoute(), async (request, reply) => (
    cached(request, reply, 'holidays.is_business_day', request.query, () => isBusinessDayInJurisdiction(request.query))
  ));

  for (const group of ['length', 'weight', 'temperature', 'area', 'volume', 'speed', 'pressure', 'energy', 'power', 'data-storage']) {
    const serviceGroup = group.replace('-', '_');
    app.post(`/api/v1/convert/${group}`, billableRoute(1), async (request, reply) => (
      cached(request, reply, `convert.${group}`, request.body || {}, () => unitConversion(serviceGroup, request.body || {}), deterministicCache(604_800))
    ));
  }

  app.post('/api/v1/crypto/hash-sha256', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'crypto.hash_sha256', request.body || {}, () => hashPayload('sha256', request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/crypto/hash-sha512', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'crypto.hash_sha512', request.body || {}, () => hashPayload('sha512', request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/crypto/base64-encode', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'crypto.base64_encode', request.body || {}, () => base64Encode(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/crypto/base64-decode', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'crypto.base64_decode', request.body || {}, () => base64Decode(request.body || {}), deterministicCache(604_800))
  ));

  const batch3Routes = [
    ['/api/v1/schedule/cron-parser', 'schedule.cron_parser', cronParser],
    ['/api/v1/schedule/workday-shift', 'schedule.workday_shift', workdayShift],
    ['/api/v1/schedule/date-range-split', 'schedule.date_range_split', dateRangeSplit],
    ['/api/v1/schedule/interval-overlap', 'schedule.interval_overlap', intervalOverlap],
    ['/api/v1/schedule/project-timeline', 'schedule.project_timeline', projectTimeline],
    ['/api/v1/schedule/shift-calculator', 'schedule.shift_calculator', shiftCalculator],
    ['/api/v1/schedule/countdown-workdays', 'schedule.countdown_workdays', countdownWorkdays],
    ['/api/v1/schedule/recurring-monthly', 'schedule.recurring_monthly', recurringMonthly],
    ['/api/v1/schedule/age-in-days', 'schedule.age_in_days', ageInDays],
    ['/api/v1/schedule/time-blocks', 'schedule.time_blocks', timeBlocks],
    ['/api/v1/color/hex-to-rgb', 'color.hex_to_rgb', hexToRgb],
    ['/api/v1/color/rgb-to-hex', 'color.rgb_to_hex', rgbToHex],
    ['/api/v1/color/rgb-to-hsl', 'color.rgb_to_hsl', rgbToHsl],
    ['/api/v1/color/hsl-to-rgb', 'color.hsl_to_rgb', hslToRgb],
    ['/api/v1/color/contrast-ratio', 'color.contrast_ratio', contrastRatio],
    ['/api/v1/color/luminance', 'color.luminance', luminance],
    ['/api/v1/color/tint-shade', 'color.tint_shade', tintShade],
    ['/api/v1/color/cmyk-conversion', 'color.cmyk_conversion', cmykConversion],
    ['/api/v1/typography/px-to-rem', 'typography.px_to_rem', pxToRem],
    ['/api/v1/typography/line-height', 'typography.line_height', lineHeight],
    ['/api/v1/network/ip-parse', 'network.ip_parse', ipParse],
    ['/api/v1/network/cidr-range', 'network.cidr_range', cidrRange],
    ['/api/v1/network/user-agent-parse', 'network.user_agent_parse', userAgentParse],
    ['/api/v1/network/query-string-parse', 'network.query_string_parse', queryStringParse],
    ['/api/v1/network/slug-sanitize', 'network.slug_sanitize', slugSanitize],
    ['/api/v1/network/port-lookup', 'network.port_lookup', portLookup],
    ['/api/v1/network/http-status-lookup', 'network.http_status_lookup', httpStatusLookup],
    ['/api/v1/network/mime-lookup', 'network.mime_lookup', mimeLookup],
    ['/api/v1/network/uuid-v5', 'network.uuid_v5', uuidV5],
    ['/api/v1/network/mac-format', 'network.mac_format', macFormat],
    ['/api/v1/finance/npv', 'finance.npv', npv],
    ['/api/v1/finance/irr-approximation', 'finance.irr_approximation', irrApproximation],
    ['/api/v1/finance/bond-yield', 'finance.bond_yield', bondYield],
    ['/api/v1/finance/depreciation-straight-line', 'finance.depreciation_straight_line', depreciationStraightLine],
    ['/api/v1/finance/depreciation-declining', 'finance.depreciation_declining', depreciationDeclining],
    ['/api/v1/finance/loan-payoff-extra', 'finance.loan_payoff_extra', loanPayoffExtra],
    ['/api/v1/finance/effective-annual-rate', 'finance.effective_annual_rate', effectiveAnnualRate],
    ['/api/v1/finance/markup-margin-split', 'finance.markup_margin_split', markupMarginSplit],
    ['/api/v1/finance/break-even-multi', 'finance.break_even_multi', breakEvenMulti],
    ['/api/v1/finance/tip-split', 'finance.tip_split', tipSplit],
    ['/api/v1/math/matrix-multiply', 'math.matrix_multiply', matrixMultiply],
    ['/api/v1/math/vector-magnitude', 'math.vector_magnitude', vectorMagnitude],
    ['/api/v1/math/vector-dot-product', 'math.vector_dot_product', vectorDotProduct],
    ['/api/v1/math/quadratic-vertex', 'math.quadratic_vertex', quadraticVertex],
    ['/api/v1/math/factorial-gamma', 'math.factorial_gamma', factorialGamma],
    ['/api/v1/math/fibonacci', 'math.fibonacci', fibonacci],
    ['/api/v1/math/base-n-convert', 'math.base_n_convert', baseNConvert],
    ['/api/v1/math/percentile-calc', 'math.percentile_calc', percentileCalc],
    ['/api/v1/math/wind-chill', 'math.wind_chill', windChill],
    ['/api/v1/math/heat-index', 'math.heat_index', heatIndex]
  ];

  for (const [path, namespace, handler] of batch3Routes) {
    app.post(path, billableRoute(1), async (request, reply) => (
      cached(request, reply, namespace, request.body || {}, () => handler(request.body || {}), deterministicCache(604_800))
    ));
  }

  app.get('/v1/astronomy/ephemeris', billableRoute(), async (request, reply) => (
    cached(request, reply, 'astronomy.ephemeris', request.query, () => ephemerisForDate(request.query))
  ));

  app.post('/v1/astronomy/crux-midnight', billableRoute(2), async (request) => cruxMidnightRange(request.body || {}));

  app.post('/v1/astronomy/crux-hourly', billableRoute(5), async (request) => cruxHourly(request.body || {}));

  app.post('/v1/astronomy/crux-current', billableRoute(2), async (request) => cruxCurrent(request.body || {}));

  app.post('/v1/astronomy/solar-noon', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.solar_noon', request.body || {}, () => solarNoon(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/astronomy/equinox-solstice', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.equinox_solstice', request.body || {}, () => equinoxSolstice(request.body || {}), deterministicCache(2_592_000))
  ));

  app.post('/v1/astronomy/moon-phase', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.moon_phase', request.body || {}, () => moonPhase(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/astronomy/julian-date', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.julian_date', request.body || {}, () => julianDate(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/astronomy/sidereal-time', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.sidereal_time', request.body || {}, () => siderealTime(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/astronomy/twilight-calculator', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.twilight', request.body || {}, () => twilightCalculator(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/astronomy/sun-position', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.sun_position', request.body || {}, () => sunPosition(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/astronomy/moon-position', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.moon_position', request.body || {}, () => moonPosition(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/astronomy/day-length', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.day_length', request.body || {}, () => dayLength(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/astronomy/polar-night-check', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.polar_night', request.body || {}, () => polarNightCheck(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/astronomy/solar-declination', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.solar_declination', request.body || {}, () => solarDeclination(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/astronomy/equation-of-time', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.equation_of_time', request.body || {}, () => equationOfTime(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/astronomy/moon-illumination', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.moon_illumination', request.body || {}, () => moonIllumination(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/astronomy/sidereal-conversion', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.sidereal_conversion', request.body || {}, () => siderealConversion(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/astronomy/golden-hour', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.golden_hour', request.body || {}, () => goldenHour(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/astronomy/blue-hour', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.blue_hour', request.body || {}, () => blueHour(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/astronomy/season-progress', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.season_progress', request.body || {}, () => seasonProgress(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/astronomy/zodiac-sign', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.zodiac_sign', request.body || {}, () => zodiacSign(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/astronomy/daylight-delta', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'astronomy.daylight_delta', request.body || {}, () => daylightDelta(request.body || {}), deterministicCache(604_800))
  ));

  app.get('/v1/solar/position', billableRoute(), async (request, reply) => (
    cached(
      request,
      reply,
      'solar.position',
      request.query,
      () => solarPosition(request.query),
      deterministicCache(604_800)
    )
  ));

  app.post('/v1/finance/margin-markup', billableRoute(1), async (request) => marginMarkup(request.body || {}));

  app.post('/v1/finance/loan-amortization', billableRoute(5), async (request) => loanAmortization(request.body || {}));

  app.post('/v1/finance/tax-extraction', billableRoute(2), async (request) => taxExtraction(request.body || {}));

  app.post('/v1/finance/freelancer-rate', billableRoute(2), async (request) => freelancerRate(request.body || {}));

  app.post('/v1/finance/simple-interest', billableRoute(1), async (request) => simpleInterest(request.body || {}));

  app.post('/v1/finance/compound-interest', billableRoute(1), async (request) => compoundInterest(request.body || {}));

  app.post('/v1/finance/loan-amortization-summary', billableRoute(1), async (request) => loanAmortizationSummary(request.body || {}));

  app.post('/v1/finance/rule-of-72', billableRoute(1), async (request) => ruleOf72(request.body || {}));

  app.post('/v1/finance/roi', billableRoute(1), async (request) => roi(request.body || {}));

  app.post('/v1/finance/discount-calculator', billableRoute(1), async (request) => discountCalculator(request.body || {}));

  app.post('/v1/finance/markup-margin', billableRoute(1), async (request) => markupMargin(request.body || {}));

  app.post('/v1/finance/break-even', billableRoute(1), async (request) => breakEven(request.body || {}));

  app.post('/v1/finance/salestax', billableRoute(1), async (request) => salesTax(request.body || {}));

  app.post('/v1/finance/cagr', billableRoute(1), async (request) => cagr(request.body || {}));

  app.post('/v1/stats/summary', billableRoute(3), async (request) => statsSummary(request.body || {}));

  app.post('/v1/payroll/decimal-hours', billableRoute(1), async (request) => decimalHours(request.body || {}));

  app.post('/v1/health/bmi', billableRoute(1), async (request) => bmi(request.body || {}));

  app.post('/v1/health/bmr', billableRoute(1), async (request) => bmr(request.body || {}));

  app.post('/v1/health/tdee', billableRoute(1), async (request) => tdee(request.body || {}));

  app.post('/v1/health/macro-split', billableRoute(1), async (request) => macroSplit(request.body || {}));

  app.post('/v1/health/pace-calculator', billableRoute(1), async (request) => paceCalculator(request.body || {}));

  app.post('/v1/math/quadratic-solver', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.quadratic_solver', request.body || {}, () => quadraticSolver(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/math/pythagorean-solve', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.pythagorean_solve', request.body || {}, () => pythagoreanSolve(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/math/triangle-heron', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.triangle_heron', request.body || {}, () => triangleHeron(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/math/circle-geometry', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.circle_geometry', request.body || {}, () => circleGeometry(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/math/sphere-geometry', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.sphere_geometry', request.body || {}, () => sphereGeometry(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/math/cylinder-geometry', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.cylinder_geometry', request.body || {}, () => cylinderGeometry(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/math/statistics-summary', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.statistics_summary', request.body || {}, () => statisticsSummary(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/math/percentage-change', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.percentage_change', request.body || {}, () => percentageChange(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/math/percent-error', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.percent_error', request.body || {}, () => percentError(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/math/gcd-lcm', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.gcd_lcm', request.body || {}, () => gcdLcm(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/math/matrix-determinant', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.matrix_determinant', request.body || {}, () => matrixDeterminant(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/math/proportion-solver', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.proportion_solver', request.body || {}, () => proportionSolver(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/math/logarithm-eval', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.logarithm_eval', request.body || {}, () => logarithmEval(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/math/exponent-eval', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.exponent_eval', request.body || {}, () => exponentEval(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/math/combinatorics', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.combinatorics', request.body || {}, () => combinatorics(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/math/ohm-law', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.ohm_law', request.body || {}, () => ohmLaw(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/math/projectile-range', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.projectile_range', request.body || {}, () => projectileRange(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/math/kinetic-energy', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.kinetic_energy', request.body || {}, () => kineticEnergy(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/math/potential-energy', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.potential_energy', request.body || {}, () => potentialEnergy(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/math/circle-sector', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.circle_sector', request.body || {}, () => circleSector(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/math/sphere-surface', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.sphere_surface', request.body || {}, () => sphereGeometry(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/math/cone-geometry', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.cone_geometry', request.body || {}, () => coneGeometry(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/math/torus-geometry', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.torus_geometry', request.body || {}, () => torusGeometry(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/math/arithmetic-progression', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.arithmetic_progression', request.body || {}, () => arithmeticProgression(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/api/v1/math/geometric-progression', billableRoute(1), async (request, reply) => (
    cached(request, reply, 'math.geometric_progression', request.body || {}, () => geometricProgression(request.body || {}), deterministicCache(604_800))
  ));

  app.post('/v1/tradie/job-margin', billableRoute(2), async (request) => tradieJobMargin(request.body || {}));

  app.post('/v1/tradie/vat-return-summary', billableRoute(3), async (request) => tradieVatReturnSummary(request.body || {}));

  app.post('/v1/tradie/cis-deduction', billableRoute(2), async (request) => tradieCisDeduction(request.body || {}));

  app.post('/v1/tradie/mileage-claim', billableRoute(1), async (request) => tradieMileageClaim(request.body || {}));

  app.post('/v1/tradie/tool-depreciation', billableRoute(3), async (request) => tradieToolDepreciation(request.body || {}));

  app.post('/v1/tradie/invoice-aging', billableRoute(3), async (request) => tradieInvoiceAging(request.body || {}));

  return app;
}

function registerReferenceRoute(app, path, namespace, resolver, options = {}) {
  app.get(path, async (request, reply) => (
    cached(request, reply, namespace, request.query || {}, () => resolver(request.query || {}), deterministicCache(options.ttlSeconds || 2_592_000))
  ));
}

async function cached(request, reply, namespace, input, calculator, options = {}) {
  const key = stableCacheKey(namespace, input, CACHE_KEY_VERSION);
  const cachedValue = await request.server.cache.get(key);
  if (cachedValue !== undefined) {
    request.cacheStatus = 'hit';
    reply.header('X-Cache', 'HIT');
    if (options.cacheControl) reply.header('Cache-Control', options.cacheControl);
    return cachedValue;
  }

  const value = await calculator();
  await request.server.cache.set(key, value, options.ttlSeconds);
  request.cacheStatus = 'miss';
  reply.header('X-Cache', 'MISS');
  if (options.cacheControl) reply.header('Cache-Control', options.cacheControl);
  return value;
}

function deterministicCache(ttlSeconds) {
  return {
    ttlSeconds,
    cacheControl: `private, max-age=${ttlSeconds}, stale-while-revalidate=86400`
  };
}

function protectedRoute() {
  return {
    config: {
      protected: true
    }
  };
}

function billableRoute(creditCost = 1) {
  return {
    config: {
      protected: true,
      billable: true,
      creditCost
    }
  };
}

function adminRoute() {
  return {
    config: {
      protected: true,
      admin: true
    }
  };
}

function authenticateAdmin(request, env) {
  const expected = env.TIME_API_ADMIN_KEY || env.ADMIN_API_KEY || '';
  if (!expected) {
    throw Object.assign(new Error('Admin API key is not configured'), {
      statusCode: 503,
      code: 'admin_key_unavailable'
    });
  }
  const supplied = String(request.headers['x-admin-key'] || '').trim();
  if (supplied !== expected) {
    throw Object.assign(new Error('A valid admin API key is required'), {
      statusCode: 401,
      code: 'unauthorized'
    });
  }
}

const ACCOUNT_BATCH_LIMITS = {
  time_batch_points: 100,
  date_difference_ranges: 100,
  geo_distance_pairs: 100
};

function localAccountProfile(request) {
  return {
    customer_id: request.customer?.customerId || 'local_development',
    status: 'local_development',
    authentication: {
      api_key_fingerprint: request.customer?.keyFingerprint || null,
      plan_id: request.customer?.planId || 'default'
    },
    plan: {
      rate_limit_per_minute: request.customer?.rateLimitPerMinute || null
    },
    capabilities: {
      account_database: false,
      credit_ledger: false,
      usage_breakdown: false
    }
  };
}

function loggerConfig(env) {
  return {
    level: env.LOG_LEVEL || 'info',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.x-api-key',
        'req.headers.x-admin-key',
        'headers.authorization',
        'headers.x-api-key',
        'headers.x-admin-key'
      ],
      censor: '[REDACTED]'
    }
  };
}

function parseCorsOrigins(env) {
  const configured = String(env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaults = [
    'https://www.calculationtime.com',
    'https://calculationtime.com',
    'https://buildaiops.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ];

  return new Set(configured.length > 0 ? configured : defaults);
}

function applyCors(request, reply, allowedOrigins) {
  const origin = request.headers.origin;
  if (origin && (allowedOrigins.has('*') || allowedOrigins.has(origin))) {
    reply.header('Access-Control-Allow-Origin', allowedOrigins.has('*') ? '*' : origin);
    if (!allowedOrigins.has('*')) reply.header('Vary', 'Origin');
  } else if (!origin && allowedOrigins.has('*')) {
    reply.header('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.has(origin)) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Vary', 'Origin');
  }

  reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-API-Key,X-Admin-Key');
  reply.header('Access-Control-Max-Age', '86400');
}

function applyRateLimitHeaders(reply, limitState) {
  if (!limitState) return;
  reply.header('X-RateLimit-Limit', String(limitState.limit));
  reply.header('X-RateLimit-Remaining', String(limitState.remaining));
  reply.header('X-RateLimit-Reset', String(limitState.reset));
}

async function start() {
  const app = await buildServer();
  await app.listen({ host: HOST, port: PORT });
}

const executedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (executedPath === import.meta.url || process.env.pm_id !== undefined) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
