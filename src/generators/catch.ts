import type { z } from 'zod';

import { generate } from '../generate';
import type { GenerationContext } from '../types';

/**
 * Catch generator: unwraps to the inner schema and generates from it
 *
 * @param schema - The catch schema
 * @param ctx - Generation context
 * @returns The value generated from the inner schema
 */
export const catchGenerator = (
  schema: z.ZodCatch<z.ZodType>,
  ctx: GenerationContext,
): unknown => {
  return generate(schema.def.innerType as z.ZodType, ctx);
};
