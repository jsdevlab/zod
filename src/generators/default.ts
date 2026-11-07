import type { z } from 'zod';
import { generate } from '../generate';
import type { GenerationContext } from '../types';

/**
 * Default generator: returns the default value first in both modes (respecting the default
 * value is a shared requirement of init and mock); generates the inner value
 * when options.useDefault is false
 *
 * @param schema - The default schema
 * @param ctx - Generation context
 * @returns The default value, or the generated inner value when useDefault is false
 */
export const defaultGenerator = (
  schema: z.ZodDefault<z.ZodType>,
  ctx: GenerationContext,
): unknown => {
  if (ctx.options.useDefault) {
    return schema.def.defaultValue;
  }
  return generate(schema.def.innerType as z.ZodType, ctx);
};
