import type { z } from 'zod';

import { dateConstraints } from '../constraints';
import type { GenerationContext } from '../types';

const EPOCH = Date.UTC(1970, 0, 1);
const FAR_FUTURE = Date.UTC(2100, 0, 1);
const DEFAULT_SPAN = 24 * 60 * 60 * 1000;

/** Effective inclusive millisecond bounds of a date schema */
interface Bounds {
  lower?: number;
  upper?: number;
}

/**
 * Resolve inclusive and exclusive date constraints into inclusive milliseconds
 *
 * @param c - The date constraints
 * @returns Inclusive lower/upper bounds in milliseconds
 */
function boundsOf(c: {
  min?: Date;
  max?: Date;
  exclusiveMin?: Date;
  exclusiveMax?: Date;
}): Bounds {
  const lower = Math.max(
    c.min?.getTime() ?? Number.NEGATIVE_INFINITY,
    c.exclusiveMin === undefined
      ? Number.NEGATIVE_INFINITY
      : c.exclusiveMin.getTime() + 1,
  );
  const upper = Math.min(
    c.max?.getTime() ?? Number.POSITIVE_INFINITY,
    c.exclusiveMax === undefined
      ? Number.POSITIVE_INFINITY
      : c.exclusiveMax.getTime() - 1,
  );
  return {
    lower: Number.isFinite(lower) ? lower : undefined,
    upper: Number.isFinite(upper) ? upper : undefined,
  };
}

/**
 * Date generator: init returns the epoch clamped into the schema range;
 * mock randomizes within the range formed by the schema constraints and
 * `options.date`.
 *
 * @param schema - The date schema
 * @param ctx - Generation context
 * @returns A Date satisfying the constraints
 */
export const dateGenerator = (
  schema: z.ZodDate,
  ctx: GenerationContext,
): Date => {
  const { lower, upper } = boundsOf(dateConstraints(schema));
  if (lower !== undefined && upper !== undefined && lower > upper) {
    throw new Error('No date satisfies the schema constraints');
  }

  if (ctx.mode === 'init') {
    let value = EPOCH;
    if (lower !== undefined && value < lower) value = lower;
    if (upper !== undefined && value > upper) value = upper;
    return new Date(value);
  }

  let low = lower ?? EPOCH;
  let high = upper ?? FAR_FUTURE;
  // Keep a sensible window when the schema only constrains one side.
  if (lower === undefined && high < EPOCH) low = high - DEFAULT_SPAN;
  if (upper === undefined && low > FAR_FUTURE) high = low + DEFAULT_SPAN;

  const optionMin = ctx.options.date.min?.getTime();
  const optionMax = ctx.options.date.max?.getTime();
  if (optionMin !== undefined) low = Math.max(low, optionMin);
  if (optionMax !== undefined) high = Math.min(high, optionMax);

  // Options that conflict with the schema fall back to the schema range,
  // which is the only range guaranteed to produce valid values.
  if (low > high) {
    low = lower ?? EPOCH;
    high = upper ?? FAR_FUTURE;
  }
  if (low > high) low = high;
  return new Date(ctx.random.int(low, high));
};
