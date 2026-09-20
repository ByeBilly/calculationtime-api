export function bmi(input = {}) {
  const measurements = bodyMeasurements(input);
  const value = measurements.weight_kg / (measurements.height_m ** 2);
  return {
    input: measurements.input,
    bmi: round(value, 2),
    category: bmiCategory(value),
    method: 'body_mass_index_metric'
  };
}

export function bmr(input = {}) {
  const measurements = bodyMeasurements(input);
  const age = number(input.age, 'age', 1, 130);
  const sex = enumValue(String(input.sex || '').toLowerCase(), 'sex', ['male', 'female']);
  const value = 10 * measurements.weight_kg + 6.25 * measurements.height_cm - 5 * age + (sex === 'male' ? 5 : -161);
  return {
    input: { ...measurements.input, age, sex },
    bmr_calories_per_day: round(value, 2),
    method: 'mifflin_st_jeor_bmr'
  };
}

export function tdee(input = {}) {
  const bmrResult = input.bmr_calories_per_day
    ? { bmr_calories_per_day: number(input.bmr_calories_per_day, 'bmr_calories_per_day', 1, 10000), input: {} }
    : bmr(input);
  const activityLevel = String(input.activity_level || input.activity || 'moderate').toLowerCase();
  const multiplier = input.activity_multiplier !== undefined
    ? number(input.activity_multiplier, 'activity_multiplier', 1, 3)
    : activityMultiplier(activityLevel);
  return {
    input: { ...bmrResult.input, activity_level: activityLevel, activity_multiplier: multiplier },
    bmr_calories_per_day: bmrResult.bmr_calories_per_day,
    tdee_calories_per_day: round(bmrResult.bmr_calories_per_day * multiplier, 2),
    method: 'bmr_times_activity_multiplier'
  };
}

export function macroSplit(input = {}) {
  const calories = number(input.calories, 'calories', 1, 100000);
  const proteinPercent = number(input.protein_percent ?? input.protein, 'protein_percent', 0, 100);
  const carbsPercent = number(input.carbs_percent ?? input.carbs, 'carbs_percent', 0, 100);
  const fatPercent = number(input.fat_percent ?? input.fat, 'fat_percent', 0, 100);
  const totalPercent = proteinPercent + carbsPercent + fatPercent;
  if (Math.abs(totalPercent - 100) > 0.000001) throw badRequest('macro percentages must total 100', 'invalid_macro_total');
  return {
    input: { calories, protein_percent: proteinPercent, carbs_percent: carbsPercent, fat_percent: fatPercent },
    grams: {
      protein: round(calories * (proteinPercent / 100) / 4, 2),
      carbs: round(calories * (carbsPercent / 100) / 4, 2),
      fat: round(calories * (fatPercent / 100) / 9, 2)
    },
    calories: {
      protein: round(calories * (proteinPercent / 100), 2),
      carbs: round(calories * (carbsPercent / 100), 2),
      fat: round(calories * (fatPercent / 100), 2)
    },
    method: 'macro_calories_to_grams_4_4_9'
  };
}

export function paceCalculator(input = {}) {
  const distance = number(input.distance, 'distance', 0.000001, 1_000_000);
  const unit = enumValue(String(input.unit || 'km').toLowerCase(), 'unit', ['km', 'kilometer', 'kilometre', 'mile', 'mi']);
  const seconds = durationSeconds(input);
  const distanceKm = unit === 'mile' || unit === 'mi' ? distance * 1.609344 : distance;
  const distanceMiles = unit === 'km' || unit === 'kilometer' || unit === 'kilometre' ? distance / 1.609344 : distance;
  return {
    input: { distance, unit, total_seconds: seconds },
    pace_per_km: formatPace(seconds / distanceKm),
    pace_per_mile: formatPace(seconds / distanceMiles),
    speed_kph: round(distanceKm / (seconds / 3600), 4),
    speed_mph: round(distanceMiles / (seconds / 3600), 4),
    method: 'distance_duration_pace_speed'
  };
}

function bodyMeasurements(input) {
  const unit = String(input.unit || 'metric').toLowerCase();
  if (unit === 'imperial') {
    const weightLb = number(input.weight_lb ?? input.weight_pounds ?? input.weight, 'weight_lb', 1, 2000);
    const heightIn = input.height_in !== undefined || input.height_inches !== undefined
      ? number(input.height_in ?? input.height_inches, 'height_in', 1, 120)
      : number(input.feet ?? 0, 'feet', 0, 10) * 12 + number(input.inches ?? 0, 'inches', 0, 11.999);
    if (heightIn <= 0) throw badRequest('height must be greater than zero', 'invalid_height');
    return {
      weight_kg: weightLb * 0.45359237,
      height_m: heightIn * 0.0254,
      height_cm: heightIn * 2.54,
      input: { unit, weight_lb: weightLb, height_in: round(heightIn, 4) }
    };
  }
  const weightKg = number(input.weight_kg ?? input.weight, 'weight_kg', 1, 1000);
  const heightCm = number(input.height_cm ?? input.height, 'height_cm', 30, 300);
  return {
    weight_kg: weightKg,
    height_m: heightCm / 100,
    height_cm: heightCm,
    input: { unit: 'metric', weight_kg: weightKg, height_cm: heightCm }
  };
}

function durationSeconds(input) {
  if (input.total_seconds !== undefined) return number(input.total_seconds, 'total_seconds', 0.001, 10_000_000);
  return number(input.hours ?? 0, 'hours', 0, 100000) * 3600
    + number(input.minutes ?? 0, 'minutes', 0, 59) * 60
    + number(input.seconds ?? 0, 'seconds', 0, 59.999);
}

function formatPace(seconds) {
  const whole = Math.round(seconds);
  return {
    seconds: whole,
    minutes: Math.floor(whole / 60),
    remaining_seconds: whole % 60,
    label: `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
  };
}

function activityMultiplier(level) {
  const values = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
    athlete: 1.9
  };
  if (values[level]) return values[level];
  throw badRequest('activity_level must be sedentary, light, moderate, active, very_active, or athlete', 'invalid_activity_level');
}

function bmiCategory(value) {
  if (value < 18.5) return 'underweight';
  if (value < 25) return 'normal';
  if (value < 30) return 'overweight';
  return 'obesity';
}

function number(value, name, min, max) {
  if (value === undefined || value === null || value === '') throw badRequest(`${name} is required`, 'missing_value');
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw badRequest(`${name} must be a finite number`, 'invalid_number');
  if (parsed < min || parsed > max) throw badRequest(`${name} must be between ${min} and ${max}`, 'value_out_of_range');
  return parsed;
}

function enumValue(value, name, allowed) {
  if (allowed.includes(value)) return value;
  throw badRequest(`${name} must be one of: ${allowed.join(', ')}`, 'invalid_enum');
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
