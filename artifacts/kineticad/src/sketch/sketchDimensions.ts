import type { SketchPrimitive } from '../state/schemas';

export type SketchDimensionField = {
  key: string;
  label: string;
  value: number;
  unit: 'mm' | '°';
};

export const SKETCH_DIMENSION_LIMITS = {
  minLengthMm: 0.001,
  maxLengthMm: 1_000_000,
  maxCoordinateMm: 1_000_000,
  maxAngleDeg: 360_000,
  minSweepDeg: 0.001,
  maxSweepDeg: 359.999,
} as const;

const DEGREES_PER_RADIAN = 180 / Math.PI;
const field = (key: string, label: string, value: number, unit: 'mm' | '°' = 'mm'): SketchDimensionField => ({ key, label, value, unit });

// Only decoded geometry gets this machine-roundoff correction. User-entered
// values still pass strict bounds below. Subtracting large endpoint coordinates
// or angles must not make an inclusive-boundary edit invalid after Save/Load.
function decodedBoundary(value: number, minimum: number, maximum: number, scale: number): number {
  const roundoff = 8 * Number.EPSILON * Math.max(1, scale);
  if (!Number.isFinite(value) || !Number.isFinite(roundoff)) return value;
  if (Math.abs(value - minimum) <= roundoff) return minimum;
  if (Math.abs(value - maximum) <= roundoff) return maximum;
  return value;
}

/** Geometric dimensions in sketch-local U/V coordinates; these are not constraints. */
export function dimensionFields(primitive: SketchPrimitive): SketchDimensionField[] {
  switch (primitive.type) {
    case 'circle':
      return [field('centreU', 'Centre U', primitive.centre[0]), field('centreV', 'Centre V', primitive.centre[1]), field('diameter', 'Diameter', primitive.radius * 2)];
    case 'rectangle':
      return [field('cornerU', 'Corner U', primitive.corner[0]), field('cornerV', 'Corner V', primitive.corner[1]), field('width', 'Width', primitive.width), field('height', 'Height', primitive.height)];
    case 'line': {
      const du = primitive.end[0] - primitive.start[0];
      const dv = primitive.end[1] - primitive.start[1];
      const coordinateScale = Math.max(...primitive.start.map(Math.abs), ...primitive.end.map(Math.abs));
      const length = decodedBoundary(Math.hypot(du, dv), SKETCH_DIMENSION_LIMITS.minLengthMm, SKETCH_DIMENSION_LIMITS.maxLengthMm, coordinateScale);
      return [field('startU', 'Start U', primitive.start[0]), field('startV', 'Start V', primitive.start[1]), field('length', 'Length', length), field('angle', 'Angle from +U', Math.atan2(dv, du) * DEGREES_PER_RADIAN, '°')];
    }
    case 'arc': {
      const rawStart = primitive.startAngle * DEGREES_PER_RADIAN;
      const angularScale = Math.max(Math.abs(rawStart), Math.abs(primitive.endAngle * DEGREES_PER_RADIAN));
      const start = decodedBoundary(rawStart, -SKETCH_DIMENSION_LIMITS.maxAngleDeg, SKETCH_DIMENSION_LIMITS.maxAngleDeg, angularScale);
      const sweep = decodedBoundary((primitive.endAngle - primitive.startAngle) * DEGREES_PER_RADIAN, SKETCH_DIMENSION_LIMITS.minSweepDeg, SKETCH_DIMENSION_LIMITS.maxSweepDeg, angularScale);
      return [field('centreU', 'Centre U', primitive.centre[0]), field('centreV', 'Centre V', primitive.centre[1]), field('radius', 'Radius', primitive.radius), field('startAngle', 'Start angle from +U', start, '°'), field('sweepAngle', 'CCW sweep', sweep, '°')];
    }
    default:
      throw new Error('Unsupported sketch primitive.');
  }
}

function bounded(value: number, minimum: number, maximum: number, label: string, unit: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be a finite number from ${minimum} to ${maximum} ${unit}.`);
  }
}

function validateValues(fields: SketchDimensionField[], values: Record<string, number>): void {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Provide all dimension values.');
  const keys = new Set(fields.map(({ key }) => key));
  for (const key of Reflect.ownKeys(values)) {
    if (typeof key !== 'string' || !keys.has(key)) throw new Error(`Unknown dimension: ${String(key)}.`);
  }
  for (const { key, label, unit } of fields) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) throw new Error(`Missing dimension: ${label}.`);
    if (key === 'sweepAngle') {
      bounded(values[key], SKETCH_DIMENSION_LIMITS.minSweepDeg, SKETCH_DIMENSION_LIMITS.maxSweepDeg, label, unit);
    } else if (unit === '°') {
      bounded(values[key], -SKETCH_DIMENSION_LIMITS.maxAngleDeg, SKETCH_DIMENSION_LIMITS.maxAngleDeg, label, unit);
    } else if (key.endsWith('U') || key.endsWith('V')) {
      bounded(values[key], -SKETCH_DIMENSION_LIMITS.maxCoordinateMm, SKETCH_DIMENSION_LIMITS.maxCoordinateMm, label, unit);
    } else {
      bounded(values[key], SKETCH_DIMENSION_LIMITS.minLengthMm, SKETCH_DIMENSION_LIMITS.maxLengthMm, label, unit);
    }
  }
}

function validateStoredCoordinates(primitive: SketchPrimitive): void {
  const points = primitive.type === 'line' ? [primitive.start, primitive.end]
    : primitive.type === 'rectangle' ? [primitive.corner] : [primitive.centre];
  for (const point of points) {
    for (const coordinate of point) bounded(coordinate, -SKETCH_DIMENSION_LIMITS.maxCoordinateMm, SKETCH_DIMENSION_LIMITS.maxCoordinateMm, 'Stored U/V coordinate', 'mm');
  }
}

/**
 * Replace one primitive's complete dimension set without modifying neighbours.
 * Length/angle edits keep the line start; size edits keep centre/corner unless
 * the caller explicitly changes their U/V fields. Angles are supplied in degrees.
 */
export function withPrimitiveDimensions(primitive: SketchPrimitive, values: Record<string, number>): SketchPrimitive {
  const fields = dimensionFields(primitive);
  validateValues(fields, values);

  // Reconstructing a line from atan2/hypot, or an arc from degrees, introduces
  // rounding. An unchanged inspector must preserve its original endpoints.
  if (fields.every(({ key, value }) => values[key] === value)) {
    validateStoredCoordinates(primitive);
    return primitive;
  }

  let result: SketchPrimitive;
  switch (primitive.type) {
    case 'circle':
      result = { ...primitive, centre: [values.centreU, values.centreV], radius: values.diameter / 2 };
      break;
    case 'rectangle':
      result = { ...primitive, corner: [values.cornerU, values.cornerV], width: values.width, height: values.height };
      break;
    case 'line': {
      const angle = values.angle / DEGREES_PER_RADIAN;
      result = { ...primitive, start: [values.startU, values.startV], end: [values.startU + values.length * Math.cos(angle), values.startV + values.length * Math.sin(angle)] };
      break;
    }
    case 'arc': {
      const startAngle = values.startAngle / DEGREES_PER_RADIAN;
      result = { ...primitive, centre: [values.centreU, values.centreV], radius: values.radius, startAngle, endAngle: startAngle + values.sweepAngle / DEGREES_PER_RADIAN };
      break;
    }
  }
  validateStoredCoordinates(result);
  return result;
}

/** Validate editable primitive dimensions, without asserting a closed CAD wire. */
export function validateSketchDimensions(primitives: readonly SketchPrimitive[]): void {
  if (!Array.isArray(primitives)) throw new Error('Sketch primitives must be an array.');
  primitives.forEach((primitive, index) => {
    try {
      const values = Object.fromEntries(dimensionFields(primitive).map(({ key, value }) => [key, value]));
      withPrimitiveDimensions(primitive, values);
    } catch (error) {
      throw new Error(`Primitive ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}
