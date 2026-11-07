import type { z } from 'zod';

import { generate } from '../generate';
import type { GenerationContext } from '../types';

/**
 * Nullable generator: returns null in init mode; in mock mode returns null
 * with probability options.nullable.chance (default 0.3), otherwise generates the inner value
 *
 * @param schema - The nullable schema
 * @param ctx - Generation context
 * @returns null, or the generated inner value
 */
export const nullableGenerator = (
  schema: z.ZodNullable<z.ZodType>,
  ctx: GenerationContext,
): unknown => {
  if (ctx.mode === 'init') return null;
  if (ctx.random.chance(ctx.options.nullable.chance ?? 0.3)) return null;
  return generate(schema.def.innerType as z.ZodType, ctx);
};
