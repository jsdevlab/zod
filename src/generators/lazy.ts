import type { z } from 'zod';

import { generate } from '../generate';
import type { GenerationContext } from '../types';

/**
 * Lazy generator: calls the getter to generate from the inner schema (recursion depth is checked by generate)
 *
 * @param schema - The lazy schema
 * @param ctx - Generation context
 * @returns The value generated from the inner schema
 */
export const lazyGenerator = (
  schema: z.ZodLazy<z.ZodType>,
  ctx: GenerationContext,
): unknown => {
  return generate(schema.def.getter(), ctx);
};
