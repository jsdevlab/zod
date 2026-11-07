import type { z } from 'zod';

import { generate } from '../generate';
import type { GenerationContext } from '../types';

/**
 * optional generator: init returns undefined; mock returns undefined
 * based on options.optional.chance (default 0.3), otherwise generates
 * the inner value
 *
 * @param schema - The optional schema
 * @param ctx - Generation context
 * @returns The inner generated value or undefined
 */
export const optionalGenerator = (
  schema: z.ZodOptional<z.ZodType>,
  ctx: GenerationContext,
): unknown => {
  if (ctx.mode === 'init') return undefined;
  if (ctx.random.chance(ctx.options.optional.chance ?? 0.3)) return undefined;
  return generate(schema.def.innerType as z.ZodType, ctx);
};
