import type { z } from 'zod';

import { type BigIntConstraints, bigintConstraints } from '../constraints';
import type { GenerationContext, Random } from '../types';

const DEFAULT_MIN = 0n;
const DEFAULT_MAX = 1000n;
const DEFAULT_SPAN = 1000n;

/**
 * Ceiling division for positive divisors (JS bigint division truncates
 * toward zero)
 *
 * @param value - The dividend
 * @param divisor - The positive divisor
 * @returns The ceiling of value / divisor
 */
function ceilDiv(value: bigint, divisor: bigint): bigint {
  const quotient = value / divisor;
  return value % divisor > 0n ? quotient + 1n : quotient;
}

/**
 * Floor division for positive divisors
 *
 * @param value - The dividend
 * @param divisor - The positive divisor
 * @returns The floor of value / divisor
 */
function floorDiv(value: bigint, divisor: bigint): bigint {
  const quotient = value / divisor;
  return value % divisor < 0n ? quotient - 1n : quotient;
}

/**
 * Random bigint in the closed interval [0, range]
 *
 * @param range - The inclusive upper bound (must be >= 0)
 * @param random - The seeded random utility
 * @returns A random bigint in [0, range]
 */
function randomBigInt(range: bigint, random: Random): bigint {
  if (range <= 0n) return 0n;
  if (range <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return BigInt(random.int(0, Number(range)));
  }
  const bits = range.toString(2).length;
  const chunks = Math.ceil(bits / 32);
  let value = 0n;
  for (let i = 0; i < chunks; i++) {
    value = (value << 32n) | BigInt(random.int(0, 0xffffffff));
  }
  return value % (range + 1n);
}

/** Effective bounds of a bigint schema */
interface Bounds {
  lower?: bigint;
  upper?: bigint;
}

/**
 * Resolve exclusive bounds into inclusive bounds
 *
 * @param c - The bigint constraints
 * @returns Inclusive lower/upper bounds
 */
function boundsOf(c: BigIntConstraints): Bounds {
  return {
    lower: c.exclusiveMin !== undefined ? c.exclusiveMin + 1n : c.min,
    upper: c.exclusiveMax !== undefined ? c.exclusiveMax - 1n : c.max,
  };
}

/**
 * Throws when the schema constraints cannot be satisfied
 *
 * @throws {Error} Always
 */
function unsatisfiable(): never {
  throw new Error('No bigint satisfies the schema constraints');
}

/**
 * Generate the deterministic initialization value (closest valid value to 0)
 *
 * @param c - The bigint constraints
 * @returns A bigint satisfying the constraints
 */
function initialBigInt(c: BigIntConstraints): bigint {
  const { lower, upper } = boundsOf(c);
  const multiple = c.multipleOf;

  if (multiple !== undefined) {
    const kLow = lower === undefined ? undefined : ceilDiv(lower, multiple);
    const kHigh = upper === undefined ? undefined : floorDiv(upper, multiple);
    if (kLow !== undefined && kHigh !== undefined && kLow > kHigh) {
      unsatisfiable();
    }
    let k = 0n;
    if (kLow !== undefined && k < kLow) k = kLow;
    if (kHigh !== undefined && k > kHigh) k = kHigh;
    return k * multiple;
  }

  if (lower !== undefined && upper !== undefined && lower > upper) {
    unsatisfiable();
  }
  let value = 0n;
  if (lower !== undefined && value < lower) value = lower;
  if (upper !== undefined && value > upper) value = upper;
  return value;
}

/**
 * Generate a random bigint satisfying the constraints
 *
 * @param c - The bigint constraints
 * @param random - The seeded random utility
 * @returns A bigint satisfying the constraints
 */
function randomBigIntValue(c: BigIntConstraints, random: Random): bigint {
  const { lower, upper } = boundsOf(c);
  const multiple = c.multipleOf;

  const low =
    lower ??
    (upper === undefined
      ? DEFAULT_MIN
      : upper - DEFAULT_SPAN < DEFAULT_MIN
        ? upper - DEFAULT_SPAN
        : DEFAULT_MIN);
  const high =
    upper ??
    (lower === undefined
      ? DEFAULT_MAX
      : lower + DEFAULT_SPAN > DEFAULT_MAX
        ? lower + DEFAULT_SPAN
        : DEFAULT_MAX);

  if (multiple !== undefined) {
    const kLow = ceilDiv(low, multiple);
    const kHigh = floorDiv(high, multiple);
    if (kLow > kHigh) unsatisfiable();
    return kLow * multiple + randomBigInt(kHigh - kLow, random) * multiple;
  }

  if (low > high) unsatisfiable();
  return low + randomBigInt(high - low, random);
}

/**
 * BigInt generator: init returns 0 (clamped into the schema range and aligned
 * to `multipleOf`); mock randomizes within the constraint range.
 *
 * @param schema - The bigint schema
 * @param ctx - Generation context
 * @returns A bigint satisfying the constraints
 */
export const bigintGenerator = (
  schema: z.ZodBigInt,
  ctx: GenerationContext,
): bigint => {
  const constraints = bigintConstraints(schema);
  return ctx.mode === 'init'
    ? initialBigInt(constraints)
    : randomBigIntValue(constraints, ctx.random);
};
