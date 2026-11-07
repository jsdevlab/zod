import { z } from 'zod';
import { generate } from '../generate';
import type { GenerationContext } from '../types';

/**
 * object generator: generate fields recursively (field names go into path for defaults fallback lookup)
 *
 * @param schema - The object schema
 * @param ctx - Generation context
 * @returns An object with generated values for each field
 */
export const objectGenerator = (
  schema: z.ZodObject<z.ZodRawShape>,
  ctx: GenerationContext,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    if (field instanceof z.ZodType) {
      ctx.path.push(key);
      out[key] = generate(field, ctx);
      ctx.path.pop();
    }
  }
  return out;
};
