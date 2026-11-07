import type { z } from 'zod';

import { type NumberConstraints, numberConstraints } from '../constraints';
import type { GenerationContext, Random } from '../types';

const DEFAULT_MIN = -1000;
const DEFAULT_MAX = 1000;

/** Smallest nudge used to satisfy exclusive float bounds */
const MIN_EPSILON = 1e-9;

/**
 * Nudge step for exclusive float bounds (scales with the bound magnitude)
 *
 * @param value - The exclusive bound
 * @returns A value small enough to stay next to the bound
 */
function epsilonAt(value: number): number {
  return Math.max(MIN_EPSILON, Math.abs(value) * Number.EPSILON * 2);
}

/**
 * Remove binary floating-point noise from a generated multiple
 * (e.g. `3 * 0.1` becomes `0.3` instead of `0.30000000000000004`)
 *
 * @param value - The raw product of a step and a multiple
 * @returns The cleaned value
 */
function cleanMultiple(value: number): number {
  if (!Number.isFinite(value) || value === 0) return value;
  return Number.parseFloat(value.toPrecision(15));
}

/** Effective lower/upper bounds, independent of exclusivity */
interface Bounds {
  lower?: number;
  upper?: number;
  lowerExclusive: boolean;
  upperExclusive: boolean;
}

/**
 * Resolve the effective bounds of a number schema
 *
 * @param c - The number constraints
 * @returns The lower/upper bounds and their exclusivity
 */
function boundsOf(c: NumberConstraints): Bounds {
  return {
    lower: c.exclusiveMin ?? c.min,
    upper: c.exclusiveMax ?? c.max,
    lowerExclusive: c.exclusiveMin !== undefined,
    upperExclusive: c.exclusiveMax !== undefined,
  };
}

/**
 * Whether values must be integers (int format or an integer step)
 *
 * @param c - The number constraints
 * @returns True when the generated values must be integers
 */
function isInteger(c: NumberConstraints): boolean {
  return (
    c.isInt === true ||
    (c.multipleOf !== undefined && Number.isInteger(c.multipleOf))
  );
}

/**
 * Smallest positive integer step that is a multiple of a fractional step
 * (e.g. `multipleOf(0.3)` with `.int()` → 3, `multipleOf(0.5)` → 1)
 *
 * @param step - The fractional multiple
 * @returns The smallest valid integer step
 */
function integerMultipleStep(step: number): number {
  for (let candidate = 1; candidate <= 1000; candidate++) {
    const ratio = candidate / step;
    if (Math.abs(ratio - Math.round(ratio)) < 1e-9) return candidate;
  }
  return 1;
}

/**
 * The effective step used for generation. Integer schemas require an integer
 * step even when `multipleOf` is fractional.
 *
 * @param c - The number constraints
 * @returns The effective multiple, or undefined when unconstrained
 */
function effectiveMultiple(c: NumberConstraints): number | undefined {
  const multiple = c.multipleOf;
  if (multiple === undefined) return undefined;
  if (c.isInt === true && !Number.isInteger(multiple)) {
    return integerMultipleStep(multiple);
  }
  return multiple;
}

/**
 * Throws when the schema constraints cannot be satisfied
 *
 * @throws {Error} Always
 */
function unsatisfiable(): never {
  throw new Error('No number satisfies the schema constraints');
}

/**
 * Generate the deterministic initialization value (closest valid value to 0)
 *
 * @param c - The number constraints
 * @returns A number satisfying the constraints
 */
function initialNumber(c: NumberConstraints): number {
  const { lower, upper, lowerExclusive, upperExclusive } = boundsOf(c);
  const multiple = effectiveMultiple(c);
  if (
    lower !== undefined &&
    upper !== undefined &&
    (lower > upper || (lower === upper && (lowerExclusive || upperExclusive)))
  ) {
    unsatisfiable();
  }

  if (multiple !== undefined) {
    const kLow =
      lower === undefined
        ? undefined
        : lowerExclusive
          ? Math.floor(lower / multiple) + 1
          : Math.ceil(lower / multiple);
    const kHigh =
      upper === undefined
        ? undefined
        : upperExclusive
          ? Math.ceil(upper / multiple) - 1
          : Math.floor(upper / multiple);
    if (kLow !== undefined && kHigh !== undefined && kLow > kHigh) {
      unsatisfiable();
    }
    let k = 0;
    if (kLow !== undefined && k < kLow) k = kLow;
    if (kHigh !== undefined && k > kHigh) k = kHigh;
    return cleanMultiple(k * multiple);
  }

  if (isInteger(c)) {
    const low =
      lower === undefined
        ? undefined
        : lowerExclusive
          ? Math.floor(lower) + 1
          : Math.ceil(lower);
    const high =
      upper === undefined
        ? undefined
        : upperExclusive
          ? Math.ceil(upper) - 1
          : Math.floor(upper);
    if (low !== undefined && high !== undefined && low > high) {
      unsatisfiable();
    }
    let value = 0;
    if (low !== undefined && value < low) value = low;
    if (high !== undefined && value > high) value = high;
    return value;
  }

  let value = 0;
  if (
    lower !== undefined &&
    (value < lower || (lowerExclusive && value <= lower))
  ) {
    value = lowerExclusive ? lower + epsilonAt(lower) : lower;
  }
  if (
    upper !== undefined &&
    (value > upper || (upperExclusive && value >= upper))
  ) {
    value = upperExclusive ? upper - epsilonAt(upper) : upper;
  }
  return value;
}

/**
 * Pick a random offset in [0, range]
 *
 * @param range - The inclusive upper bound of the offset
 * @param random - The seeded random utility
 * @returns A random integer offset
 */
function randomOffset(range: number, random: Random): number {
  if (!Number.isFinite(range) || range <= 0) return 0;
  return random.int(0, range);
}

/**
 * Generate a random value satisfying the number constraints
 *
 * @param c - The number constraints
 * @param random - The seeded random utility
 * @returns A number satisfying the constraints
 */
function randomNumber(c: NumberConstraints, random: Random): number {
  const { lower, upper, lowerExclusive, upperExclusive } = boundsOf(c);
  const multiple = effectiveMultiple(c);
  if (
    lower !== undefined &&
    upper !== undefined &&
    (lower > upper || (lower === upper && (lowerExclusive || upperExclusive)))
  ) {
    unsatisfiable();
  }

  let low =
    lower ??
    (upper === undefined ? DEFAULT_MIN : Math.min(DEFAULT_MIN, upper - 1000));
  let high =
    upper ??
    (lower === undefined ? DEFAULT_MAX : Math.max(DEFAULT_MAX, lower + 1000));

  if (multiple !== undefined) {
    const kLow =
      lower === undefined
        ? Math.ceil(low / multiple)
        : lowerExclusive
          ? Math.floor(lower / multiple) + 1
          : Math.ceil(lower / multiple);
    const kHigh =
      upper === undefined
        ? Math.floor(high / multiple)
        : upperExclusive
          ? Math.ceil(upper / multiple) - 1
          : Math.floor(upper / multiple);
    if (kLow > kHigh) unsatisfiable();
    const k = kLow + randomOffset(kHigh - kLow, random);
    return cleanMultiple(k * multiple);
  }

  if (isInteger(c)) {
    const lowInt =
      lower === undefined
        ? Math.ceil(low)
        : lowerExclusive
          ? Math.floor(lower) + 1
          : Math.ceil(lower);
    const highInt =
      upper === undefined
        ? Math.floor(high)
        : upperExclusive
          ? Math.ceil(upper) - 1
          : Math.floor(upper);
    if (lowInt > highInt) unsatisfiable();
    return random.int(lowInt, highInt);
  }

  if (lower !== undefined && lowerExclusive) low = lower + epsilonAt(lower);
  if (upper !== undefined && upperExclusive) high = upper - epsilonAt(upper);
  if (low > high) unsatisfiable();
  const value = low + random.float() * (high - low);
  return Math.min(high, Math.max(low, value));
}

/**
 * number generator: init returns 0 (clamped into the schema range and aligned
 * to `multipleOf`); mock randomizes within the constraint bounds, respecting
 * min/max, exclusive bounds, multipleOf and integer formats.
 *
 * Uses the public `minValue`/`maxValue`/`format` accessors of zod 4 and the
 * checks stored in `schema.def.checks` (see `constraints.ts`).
 *
 * @param schema - The number schema
 * @param ctx - Generation context
 * @returns A number satisfying the schema constraints
 */
export const numberGenerator = (
  schema: z.ZodNumber,
  ctx: GenerationContext,
): number => {
  const constraints = numberConstraints(schema);
  return ctx.mode === 'init'
    ? initialNumber(constraints)
    : randomNumber(constraints, ctx.random);
};
