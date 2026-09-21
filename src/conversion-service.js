const UNIT_GROUPS = {
  length: {
    base_unit: 'meter',
    units: {
      meter: 1,
      meters: 1,
      m: 1,
      kilometer: 1000,
      kilometers: 1000,
      km: 1000,
      centimeter: 0.01,
      centimeters: 0.01,
      cm: 0.01,
      millimeter: 0.001,
      millimeters: 0.001,
      mm: 0.001,
      inch: 0.0254,
      inches: 0.0254,
      in: 0.0254,
      foot: 0.3048,
      feet: 0.3048,
      ft: 0.3048,
      yard: 0.9144,
      yards: 0.9144,
      yd: 0.9144,
      mile: 1609.344,
      miles: 1609.344,
      mi: 1609.344,
      nautical_mile: 1852,
      nautical_miles: 1852,
      nmi: 1852
    }
  },
  weight: {
    base_unit: 'kilogram',
    units: {
      kilogram: 1,
      kilograms: 1,
      kg: 1,
      gram: 0.001,
      grams: 0.001,
      g: 0.001,
      milligram: 0.000001,
      milligrams: 0.000001,
      mg: 0.000001,
      pound: 0.45359237,
      pounds: 0.45359237,
      lb: 0.45359237,
      lbs: 0.45359237,
      ounce: 0.028349523125,
      ounces: 0.028349523125,
      oz: 0.028349523125,
      metric_ton: 1000,
      metric_tons: 1000,
      tonne: 1000,
      tonnes: 1000,
      stone: 6.35029318,
      stones: 6.35029318,
      st: 6.35029318
    }
  },
  area: {
    base_unit: 'square_meter',
    units: {
      square_meter: 1,
      square_meters: 1,
      m2: 1,
      square_foot: 0.09290304,
      square_feet: 0.09290304,
      ft2: 0.09290304,
      acre: 4046.8564224,
      acres: 4046.8564224,
      hectare: 10000,
      hectares: 10000,
      ha: 10000,
      square_mile: 2589988.110336,
      square_miles: 2589988.110336,
      mi2: 2589988.110336,
      square_kilometer: 1000000,
      square_kilometers: 1000000,
      km2: 1000000
    }
  },
  volume: {
    base_unit: 'liter',
    units: {
      liter: 1,
      liters: 1,
      litre: 1,
      litres: 1,
      l: 1,
      milliliter: 0.001,
      milliliters: 0.001,
      ml: 0.001,
      cubic_meter: 1000,
      cubic_meters: 1000,
      m3: 1000,
      gallon: 3.785411784,
      gallons: 3.785411784,
      gal: 3.785411784,
      fluid_ounce: 0.0295735295625,
      fluid_ounces: 0.0295735295625,
      floz: 0.0295735295625,
      cup: 0.2365882365,
      cups: 0.2365882365
    }
  },
  speed: {
    base_unit: 'meter_per_second',
    units: {
      meter_per_second: 1,
      meters_per_second: 1,
      mps: 1,
      'm/s': 1,
      kilometer_per_hour: 1 / 3.6,
      kilometers_per_hour: 1 / 3.6,
      kmh: 1 / 3.6,
      'km/h': 1 / 3.6,
      mile_per_hour: 0.44704,
      miles_per_hour: 0.44704,
      mph: 0.44704,
      knot: 0.514444444444,
      knots: 0.514444444444,
      kt: 0.514444444444,
      mach: 343,
      mach_sea_level: 343
    }
  },
  pressure: {
    base_unit: 'pascal',
    units: {
      pascal: 1,
      pascals: 1,
      pa: 1,
      kilopascal: 1000,
      kilopascals: 1000,
      kpa: 1000,
      bar: 100000,
      psi: 6894.757293168,
      atmosphere: 101325,
      atmospheres: 101325,
      atm: 101325,
      torr: 133.3223684211,
      mmhg: 133.3223684211
    }
  },
  energy: {
    base_unit: 'joule',
    units: {
      joule: 1,
      joules: 1,
      j: 1,
      kilojoule: 1000,
      kilojoules: 1000,
      kj: 1000,
      calorie: 4.184,
      calories: 4.184,
      cal: 4.184,
      kilocalorie: 4184,
      kilocalories: 4184,
      kcal: 4184,
      watt_hour: 3600,
      watt_hours: 3600,
      wh: 3600,
      kilowatt_hour: 3600000,
      kilowatt_hours: 3600000,
      kwh: 3600000,
      btu: 1055.05585262
    }
  }
};

export function unitConversion(group, input = {}) {
  if (group === 'temperature') return temperatureConversion(input);
  const config = UNIT_GROUPS[group];
  if (!config) throw badRequest('unknown conversion group', 'unknown_conversion_group');
  const value = number(input.value, 'value', -1_000_000_000_000, 1_000_000_000_000);
  const from = normalizeUnit(input.from ?? input.from_unit, config.units, 'from');
  const to = normalizeUnit(input.to ?? input.to_unit, config.units, 'to');
  const baseValue = value * config.units[from];
  const converted = baseValue / config.units[to];
  return {
    input: { value, from, to },
    result: round(converted, 12),
    base: { unit: config.base_unit, value: round(baseValue, 12) },
    method: `${group}_static_multiplier_conversion`
  };
}

export function temperatureConversion(input = {}) {
  const value = number(input.value, 'value', -1000000, 1000000);
  const from = normalizeTemperature(input.from ?? input.from_unit, 'from');
  const to = normalizeTemperature(input.to ?? input.to_unit, 'to');
  const kelvin = toKelvin(value, from);
  if (kelvin < 0) throw badRequest('temperature is below absolute zero', 'below_absolute_zero');
  return {
    input: { value, from, to },
    result: round(fromKelvin(kelvin, to), 12),
    base: { unit: 'kelvin', value: round(kelvin, 12) },
    method: 'temperature_affine_scale_conversion'
  };
}

function normalizeUnit(value, units, label) {
  const raw = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (units[raw] !== undefined) return raw;
  throw badRequest(`${label} must be one of: ${Object.keys(units).join(', ')}`, `invalid_${label}_unit`);
}

function normalizeTemperature(value, label) {
  const raw = String(value ?? '').trim().toLowerCase();
  const aliases = {
    c: 'celsius',
    celsius: 'celsius',
    fahrenheit: 'fahrenheit',
    f: 'fahrenheit',
    kelvin: 'kelvin',
    k: 'kelvin',
    rankine: 'rankine',
    r: 'rankine'
  };
  if (aliases[raw]) return aliases[raw];
  throw badRequest(`${label} must be celsius, fahrenheit, kelvin, or rankine`, `invalid_${label}_unit`);
}

function toKelvin(value, unit) {
  if (unit === 'kelvin') return value;
  if (unit === 'celsius') return value + 273.15;
  if (unit === 'fahrenheit') return (value - 32) * 5 / 9 + 273.15;
  return value * 5 / 9;
}

function fromKelvin(value, unit) {
  if (unit === 'kelvin') return value;
  if (unit === 'celsius') return value - 273.15;
  if (unit === 'fahrenheit') return (value - 273.15) * 9 / 5 + 32;
  return value * 9 / 5;
}

function number(value, name, min, max) {
  if (value === undefined || value === null || value === '') throw badRequest(`${name} is required`, 'missing_value');
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw badRequest(`${name} must be a finite number`, 'invalid_number');
  if (parsed < min || parsed > max) throw badRequest(`${name} must be between ${min} and ${max}`, 'value_out_of_range');
  return parsed;
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
