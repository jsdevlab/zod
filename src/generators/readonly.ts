import type { z } from 'zod';

import { generate } from '../generate';
import type { GenerationContext } from '../types';

/**
 * readonly generator: unwraps to the inner schema and generates
 *
 * @param schema - The readonly schema
 * @param ctx - Generation context
 * @returns A generated value for the inner schema
 */
export const readonlyGenerator = (
  schema: z.ZodReadonly<z.ZodType>,
  ctx: GenerationContext,
): unknown => {
  return generate(schema.def.innerType as z.ZodType, ctx);
};
