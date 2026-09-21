const MAX_NUMBER_ARRAY = 10_000;

export function quadraticSolver(input = {}) {
  const a = number(input.a, 'a', -1_000_000_000, 1_000_000_000);
  const b = number(input.b, 'b', -1_000_000_000, 1_000_000_000);
  const c = number(input.c, 'c', -1_000_000_000, 1_000_000_000);
  if (a === 0) throw badRequest('a must not be zero for a quadratic equation', 'invalid_quadratic');
  const discriminant = b ** 2 - 4 * a * c;
  const vertexX = -b / (2 * a);
  const vertexY = a * vertexX ** 2 + b * vertexX + c;
  const roots = discriminant >= 0
    ? {
        type: 'real',
        values: [
          round((-b + Math.sqrt(discriminant)) / (2 * a), 12),
          round((-b - Math.sqrt(discriminant)) / (2 * a), 12)
        ]
      }
    : {
        type: 'complex',
        values: [
          { real: round(-b / (2 * a), 12), imaginary: round(Math.sqrt(Math.abs(discriminant)) / (2 * a), 12) },
          { real: round(-b / (2 * a), 12), imaginary: round(-Math.sqrt(Math.abs(discriminant)) / (2 * a), 12) }
        ]
      };
  return {
    input: { a, b, c },
    discriminant: round(discriminant, 12),
    roots,
    vertex: { x: round(vertexX, 12), y: round(vertexY, 12) },
    axis_of_symmetry: round(vertexX, 12),
    method: 'quadratic_formula_and_vertex_form'
  };
}

export function pythagoreanSolve(input = {}) {
  const a = optionalPositive(input.a, 'a');
  const b = optionalPositive(input.b, 'b');
  const c = optionalPositive(input.c, 'c');
  const supplied = [a, b, c].filter((value) => value !== null).length;
  if (supplied !== 2) throw badRequest('exactly two of a, b, and c are required', 'invalid_side_count');
  if (c !== null && (a ?? b) >= c) throw badRequest('hypotenuse must be greater than either leg', 'invalid_hypotenuse');
  const result = {
    a: a ?? Math.sqrt(c ** 2 - b ** 2),
    b: b ?? Math.sqrt(c ** 2 - a ** 2),
    c: c ?? Math.sqrt(a ** 2 + b ** 2)
  };
  return {
    input: { a, b, c },
    sides: roundedObject(result, 12),
    area: round((result.a * result.b) / 2, 12),
    perimeter: round(result.a + result.b + result.c, 12),
    method: 'pythagorean_theorem'
  };
}

export function triangleHeron(input = {}) {
  const a = positive(input.a, 'a');
  const b = positive(input.b, 'b');
  const c = positive(input.c, 'c');
  if (a + b <= c || a + c <= b || b + c <= a) throw badRequest('side lengths must satisfy the triangle inequality', 'invalid_triangle');
  const s = (a + b + c) / 2;
  const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
  return {
    input: { a, b, c },
    perimeter: round(a + b + c, 12),
    semi_perimeter: round(s, 12),
    area: round(area, 12),
    angles_degrees: {
      A: round(angleFromSides(b, c, a), 8),
      B: round(angleFromSides(a, c, b), 8),
      C: round(angleFromSides(a, b, c), 8)
    },
    method: 'heron_formula_and_law_of_cosines'
  };
}

export function circleGeometry(input = {}) {
  const radius = positive(input.radius ?? input.r, 'radius');
  const angleDegrees = optionalNumber(input.angle_degrees ?? input.arc_degrees ?? input.theta_degrees, 'angle_degrees', 0, 360);
  const diameter = 2 * radius;
  const circumference = 2 * Math.PI * radius;
  return {
    input: { radius, angle_degrees: angleDegrees },
    diameter: round(diameter, 12),
    circumference: round(circumference, 12),
    area: round(Math.PI * radius ** 2, 12),
    arc_length: angleDegrees === null ? null : round(circumference * (angleDegrees / 360), 12),
    sector_area: angleDegrees === null ? null : round(Math.PI * radius ** 2 * (angleDegrees / 360), 12),
    method: 'circle_radius_geometry'
  };
}

export function sphereGeometry(input = {}) {
  const radius = positive(input.radius ?? input.r, 'radius');
  return {
    input: { radius },
    diameter: round(2 * radius, 12),
    surface_area: round(4 * Math.PI * radius ** 2, 12),
    volume: round((4 / 3) * Math.PI * radius ** 3, 12),
    method: 'sphere_radius_geometry'
  };
}

export function cylinderGeometry(input = {}) {
  const radius = positive(input.radius ?? input.r, 'radius');
  const height = positive(input.height ?? input.h, 'height');
  return {
    input: { radius, height },
    base_area: round(Math.PI * radius ** 2, 12),
    lateral_surface_area: round(2 * Math.PI * radius * height, 12),
    total_surface_area: round(2 * Math.PI * radius * (radius + height), 12),
    volume: round(Math.PI * radius ** 2 * height, 12),
    method: 'cylinder_radius_height_geometry'
  };
}

export function statisticsSummary(input = {}) {
  const values = numberArray(input.values ?? input.numbers, 'values');
  const sorted = [...values].sort((a, b) => a - b);
  const count = values.length;
  const mean = values.reduce((total, value) => total + value, 0) / count;
  const variancePopulation = values.reduce((total, value) => total + (value - mean) ** 2, 0) / count;
  const varianceSample = count > 1 ? variancePopulation * count / (count - 1) : null;
  const modes = mode(sorted);
  const q1 = median(sorted.slice(0, Math.floor(count / 2)));
  const q3 = median(sorted.slice(Math.ceil(count / 2)));
  return {
    input: { count },
    min: sorted[0],
    max: sorted.at(-1),
    range: round(sorted.at(-1) - sorted[0], 12),
    sum: round(values.reduce((total, value) => total + value, 0), 12),
    mean: round(mean, 12),
    median: round(median(sorted), 12),
    mode: modes,
    variance: {
      population: round(variancePopulation, 12),
      sample: varianceSample === null ? null : round(varianceSample, 12)
    },
    standard_deviation: {
      population: round(Math.sqrt(variancePopulation), 12),
      sample: varianceSample === null ? null : round(Math.sqrt(varianceSample), 12)
    },
    quartiles: { q1: round(q1, 12), q3: round(q3, 12), iqr: round(q3 - q1, 12) },
    method: 'descriptive_statistics_sorted_dataset'
  };
}

export function percentageChange(input = {}) {
  const baseline = number(input.baseline ?? input.old_value ?? input.original, 'baseline', -1_000_000_000_000, 1_000_000_000_000);
  const current = number(input.current ?? input.new_value ?? input.new, 'current', -1_000_000_000_000, 1_000_000_000_000);
  if (baseline === 0) throw badRequest('baseline must not be zero for percentage change', 'invalid_baseline');
  const change = current - baseline;
  return {
    input: { baseline, current },
    absolute_change: round(change, 12),
    percentage_change: round((change / baseline) * 100, 12),
    direction: change > 0 ? 'increase' : change < 0 ? 'decrease' : 'no_change',
    method: 'new_minus_baseline_over_baseline'
  };
}

export function percentError(input = {}) {
  const trueValue = number(input.true_value ?? input.actual ?? input.accepted, 'true_value', -1_000_000_000_000, 1_000_000_000_000);
  const measuredValue = number(input.measured_value ?? input.observed ?? input.experimental, 'measured_value', -1_000_000_000_000, 1_000_000_000_000);
  if (trueValue === 0) throw badRequest('true_value must not be zero for percent error', 'invalid_true_value');
  const absoluteError = Math.abs(measuredValue - trueValue);
  return {
    input: { true_value: trueValue, measured_value: measuredValue },
    absolute_error: round(absoluteError, 12),
    relative_error: round(absoluteError / Math.abs(trueValue), 12),
    percent_error: round((absoluteError / Math.abs(trueValue)) * 100, 12),
    signed_error: round(measuredValue - trueValue, 12),
    method: 'absolute_error_over_true_value'
  };
}

export function gcdLcm(input = {}) {
  const values = integerArray(input.values ?? input.integers ?? input.numbers, 'values');
  const absValues = values.map((value) => Math.abs(value));
  const gcdValue = absValues.reduce((current, value) => gcd(current, value));
  const lcmValue = absValues.reduce((current, value) => lcm(current, value));
  return {
    input: { values },
    gcd: gcdValue,
    lcm: lcmValue,
    method: 'euclidean_gcd_lcm_integer_set'
  };
}

export function matrixDeterminant(input = {}) {
  const matrix = Array.isArray(input.matrix) ? input.matrix : null;
  if (!matrix || ![2, 3].includes(matrix.length) || matrix.some((row) => !Array.isArray(row) || row.length !== matrix.length)) {
    throw badRequest('matrix must be a 2x2 or 3x3 numeric array', 'invalid_matrix');
  }
  const parsed = matrix.map((row, rowIndex) => row.map((value, columnIndex) => number(value, `matrix[${rowIndex}][${columnIndex}]`, -1_000_000_000, 1_000_000_000)));
  const determinant = parsed.length === 2
    ? parsed[0][0] * parsed[1][1] - parsed[0][1] * parsed[1][0]
    : parsed[0][0] * (parsed[1][1] * parsed[2][2] - parsed[1][2] * parsed[2][1])
      - parsed[0][1] * (parsed[1][0] * parsed[2][2] - parsed[1][2] * parsed[2][0])
      + parsed[0][2] * (parsed[1][0] * parsed[2][1] - parsed[1][1] * parsed[2][0]);
  return {
    input: { matrix: parsed },
    size: `${parsed.length}x${parsed.length}`,
    determinant: round(determinant, 12),
    method: 'direct_2x2_or_3x3_determinant'
  };
}

export function proportionSolver(input = {}) {
  const a = number(input.a, 'a', -1_000_000_000, 1_000_000_000);
  const b = number(input.b, 'b', -1_000_000_000, 1_000_000_000);
  const c = number(input.c, 'c', -1_000_000_000, 1_000_000_000);
  if (a === 0 || b === 0) throw badRequest('a and b must not be zero', 'invalid_ratio');
  return {
    input: { a, b, c },
    x: round((b * c) / a, 12),
    ratio: round(a / b, 12),
    method: 'solve_a_over_b_equals_c_over_x'
  };
}

export function logarithmEval(input = {}) {
  const value = positive(input.value ?? input.x, 'value');
  const base = positive(input.base ?? input.b, 'base');
  if (base === 1) throw badRequest('base must not be 1', 'invalid_log_base');
  return {
    input: { value, base },
    logarithm: round(Math.log(value) / Math.log(base), 12),
    natural_log: round(Math.log(value), 12),
    common_log: round(Math.log10(value), 12),
    method: 'change_of_base_logarithm'
  };
}

export function exponentEval(input = {}) {
  const base = number(input.base ?? input.value ?? input.x, 'base', -1_000_000_000, 1_000_000_000);
  const exponent = number(input.exponent ?? input.power, 'exponent', -1000, 1000);
  const root = optionalNumber(input.root, 'root', -1000, 1000);
  if (root === 0) throw badRequest('root must not be zero', 'invalid_root');
  if (base < 0 && !Number.isInteger(exponent)) throw badRequest('negative base with fractional exponent is outside real-number output', 'complex_result');
  const power = base ** exponent;
  const rootValue = root === null ? null : signedRoot(base, root);
  return {
    input: { base, exponent, root },
    power: round(power, 12),
    root_value: rootValue === null ? null : round(rootValue, 12),
    method: 'exponentiation_and_real_root_extraction'
  };
}

export function combinatorics(input = {}) {
  const n = integer(input.n, 'n', 0, 170);
  const r = integer(input.r, 'r', 0, n);
  return {
    input: { n, r },
    permutations: factorialRange(n - r + 1, n),
    combinations: factorialRange(n - r + 1, n) / factorialRange(1, r),
    method: 'n_permute_r_and_n_choose_r'
  };
}

export function ohmLaw(input = {}) {
  const voltage = optionalNumber(input.voltage ?? input.v, 'voltage', -1_000_000_000, 1_000_000_000);
  const current = optionalNumber(input.current ?? input.i, 'current', -1_000_000_000, 1_000_000_000);
  const resistance = optionalPositive(input.resistance ?? input.r, 'resistance');
  const power = optionalNumber(input.power ?? input.p, 'power', 0, 1_000_000_000_000);
  const supplied = [voltage, current, resistance, power].filter((value) => value !== null).length;
  if (supplied < 2) throw badRequest('at least two of voltage, current, resistance, and power are required', 'insufficient_inputs');

  let v = voltage;
  let i = current;
  let r = resistance;
  let p = power;
  for (let pass = 0; pass < 4; pass += 1) {
    if (v === null && i !== null && r !== null) v = i * r;
    if (i === null && v !== null && r !== null) i = v / r;
    if (r === null && v !== null && i !== null) r = v / i;
    if (p === null && v !== null && i !== null) p = v * i;
    if (v === null && p !== null && i !== null) v = p / i;
    if (i === null && p !== null && v !== null) i = p / v;
    if (r === null && v !== null && p !== null) r = (v ** 2) / p;
    if (r === null && p !== null && i !== null) r = p / (i ** 2);
    if (v === null && p !== null && r !== null) v = Math.sqrt(p * r);
    if (i === null && p !== null && r !== null) i = Math.sqrt(p / r);
  }
  if ([v, i, r, p].some((value) => value === null || !Number.isFinite(value))) {
    throw badRequest('inputs could not produce a finite Ohm law solution', 'unsolved_ohm_law');
  }
  return {
    input: { voltage, current, resistance, power },
    values: {
      voltage_volts: round(v, 12),
      current_amps: round(i, 12),
      resistance_ohms: round(r, 12),
      power_watts: round(p, 12)
    },
    method: 'ohm_law_v_equals_i_r_and_power_identities'
  };
}

export function projectileRange(input = {}) {
  const velocity = positive(input.velocity ?? input.initial_velocity ?? input.v0, 'velocity');
  const angleDegrees = number(input.angle_degrees ?? input.angle, 'angle_degrees', -90, 90);
  const gravity = positive(input.gravity ?? 9.80665, 'gravity');
  const height = optionalNumber(input.initial_height ?? input.height ?? 0, 'initial_height', 0, 1_000_000);
  const angle = angleDegrees * Math.PI / 180;
  const vx = velocity * Math.cos(angle);
  const vy = velocity * Math.sin(angle);
  const discriminant = vy ** 2 + 2 * gravity * height;
  const flightTime = (vy + Math.sqrt(discriminant)) / gravity;
  return {
    input: { velocity, angle_degrees: angleDegrees, gravity, initial_height: height },
    flight_time_seconds: round(flightTime, 12),
    range: round(vx * flightTime, 12),
    max_height: round(height + (vy ** 2) / (2 * gravity), 12),
    components: { horizontal_velocity: round(vx, 12), vertical_velocity: round(vy, 12) },
    method: 'ideal_projectile_motion_no_drag'
  };
}

export function kineticEnergy(input = {}) {
  const mass = positive(input.mass ?? input.mass_kg, 'mass');
  const velocity = number(input.velocity ?? input.velocity_mps, 'velocity', -1_000_000, 1_000_000);
  return {
    input: { mass_kg: mass, velocity_mps: velocity },
    kinetic_energy_joules: round(0.5 * mass * velocity ** 2, 12),
    method: 'one_half_mass_velocity_squared'
  };
}

export function potentialEnergy(input = {}) {
  const mass = positive(input.mass ?? input.mass_kg, 'mass');
  const height = number(input.height ?? input.height_meters, 'height', -1_000_000_000, 1_000_000_000);
  const gravity = positive(input.gravity ?? 9.80665, 'gravity');
  return {
    input: { mass_kg: mass, height_meters: height, gravity_mps2: gravity },
    potential_energy_joules: round(mass * gravity * height, 12),
    method: 'mass_gravity_height'
  };
}

export function circleSector(input = {}) {
  const radius = positive(input.radius ?? input.r, 'radius');
  const angleDegrees = number(input.angle_degrees ?? input.angle, 'angle_degrees', 0, 360);
  return {
    input: { radius, angle_degrees: angleDegrees },
    arc_length: round(2 * Math.PI * radius * angleDegrees / 360, 12),
    sector_area: round(Math.PI * radius ** 2 * angleDegrees / 360, 12),
    chord_length: round(2 * radius * Math.sin((angleDegrees * Math.PI / 180) / 2), 12),
    method: 'circle_sector_angle_fraction'
  };
}

export function coneGeometry(input = {}) {
  const radius = positive(input.radius ?? input.r, 'radius');
  const height = positive(input.height ?? input.h, 'height');
  const slantHeight = Math.sqrt(radius ** 2 + height ** 2);
  return {
    input: { radius, height },
    slant_height: round(slantHeight, 12),
    base_area: round(Math.PI * radius ** 2, 12),
    lateral_surface_area: round(Math.PI * radius * slantHeight, 12),
    total_surface_area: round(Math.PI * radius * (radius + slantHeight), 12),
    volume: round(Math.PI * radius ** 2 * height / 3, 12),
    method: 'right_circular_cone_geometry'
  };
}

export function torusGeometry(input = {}) {
  const majorRadius = positive(input.major_radius ?? input.R, 'major_radius');
  const minorRadius = positive(input.minor_radius ?? input.r, 'minor_radius');
  return {
    input: { major_radius: majorRadius, minor_radius: minorRadius },
    surface_area: round(4 * Math.PI ** 2 * majorRadius * minorRadius, 12),
    volume: round(2 * Math.PI ** 2 * majorRadius * minorRadius ** 2, 12),
    method: 'torus_major_minor_radius_geometry'
  };
}

export function arithmeticProgression(input = {}) {
  const first = number(input.first ?? input.a1, 'first', -1_000_000_000, 1_000_000_000);
  const difference = number(input.difference ?? input.d, 'difference', -1_000_000_000, 1_000_000_000);
  const n = integer(input.n, 'n', 1, 1_000_000);
  const nthTerm = first + (n - 1) * difference;
  return {
    input: { first, difference, n },
    nth_term: round(nthTerm, 12),
    sum_n_terms: round((n / 2) * (first + nthTerm), 12),
    method: 'arithmetic_sequence_nth_term_and_sum'
  };
}

export function geometricProgression(input = {}) {
  const first = number(input.first ?? input.a1, 'first', -1_000_000_000, 1_000_000_000);
  const ratio = number(input.ratio ?? input.r, 'ratio', -1_000_000, 1_000_000);
  const n = integer(input.n, 'n', 1, 1_000_000);
  const nthTerm = first * ratio ** (n - 1);
  const sum = ratio === 1 ? first * n : first * (1 - ratio ** n) / (1 - ratio);
  return {
    input: { first, ratio, n },
    nth_term: round(nthTerm, 12),
    sum_n_terms: round(sum, 12),
    method: 'geometric_sequence_nth_term_and_sum'
  };
}

function numberArray(value, name) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_NUMBER_ARRAY) {
    throw badRequest(`${name} must contain 1 to ${MAX_NUMBER_ARRAY} numbers`, 'invalid_array_length');
  }
  return value.map((item, index) => number(item, `${name}[${index}]`, -1_000_000_000_000, 1_000_000_000_000));
}

function integerArray(value, name) {
  const values = numberArray(value, name).map((item, index) => {
    if (!Number.isInteger(item)) throw badRequest(`${name}[${index}] must be an integer`, 'invalid_integer');
    return item;
  });
  if (values.length < 2) throw badRequest(`${name} must contain at least 2 integers`, 'invalid_array_length');
  return values;
}

function median(sorted) {
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mode(sorted) {
  const counts = new Map();
  let maxCount = 0;
  for (const value of sorted) {
    const count = (counts.get(value) || 0) + 1;
    counts.set(value, count);
    maxCount = Math.max(maxCount, count);
  }
  if (maxCount === 1) return [];
  return [...counts.entries()].filter(([, count]) => count === maxCount).map(([value]) => value);
}

function angleFromSides(side1, side2, opposite) {
  const cosine = (side1 ** 2 + side2 ** 2 - opposite ** 2) / (2 * side1 * side2);
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

function lcm(a, b) {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
}

function factorialRange(start, end) {
  let value = 1;
  for (let n = Math.max(1, start); n <= end; n += 1) value *= n;
  return value;
}

function signedRoot(value, root) {
  if (value < 0) {
    if (!Number.isInteger(root) || Math.abs(root) % 2 !== 1) {
      throw badRequest('negative values require an odd integer root for real-number output', 'complex_result');
    }
    return -((-value) ** (1 / root));
  }
  return value ** (1 / root);
}

function roundedObject(object, places) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, round(value, places)]));
}

function positive(value, name) {
  return number(value, name, 0.000000000001, 1_000_000_000);
}

function optionalPositive(value, name) {
  if (value === undefined || value === null || value === '') return null;
  return positive(value, name);
}

function optionalNumber(value, name, min, max) {
  if (value === undefined || value === null || value === '') return null;
  return number(value, name, min, max);
}

function integer(value, name, min, max) {
  const parsed = number(value, name, min, max);
  if (!Number.isInteger(parsed)) throw badRequest(`${name} must be an integer`, 'invalid_integer');
  return parsed;
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
