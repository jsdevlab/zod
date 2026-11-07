import { z } from 'zod';

import type { GenerationContext } from '../types';

/**
 * Generator for unstructured types:
 * - any/unknown: returns undefined in init mode; a random primitive value in mock mode
 * - undefined/void: undefined
 * - null: null
 * - nan: NaN
 * - never: no value can be generated, throws (generate throws NoGeneratorException)
 *
 * @param schema - The schema to generate a value for
 * @param ctx - Generation context
 * @returns A generated value for the schema
 * @throws {Error} When the schema is a ZodNever, which has no value to generate
 */
export const anyGenerator = (
  schema:
    | z.ZodAny
    | z.ZodUnknown
    | z.ZodUndefined
    | z.ZodVoid
    | z.ZodNull
    | z.ZodNaN
    | z.ZodNever,
  ctx: GenerationContext,
): unknown => {
  if (schema instanceof z.ZodUndefined || schema instanceof z.ZodVoid) {
    return undefined;
  }

  if (schema instanceof z.ZodNull) return null;
  if (schema instanceof z.ZodNaN) return NaN;
  if (schema instanceof z.ZodNever) {
    // No value can be generated; the error is handled by generate's fallback (returning undefined would be semantically invalid)
    throw new Error('ZodNever has no value to generate');
  }
  // any / unknown
  if (ctx.mode === 'init') return undefined;
  return ctx.random.pick([0, '', false, null]);
};
