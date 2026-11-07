import type { z } from 'zod';

import { generate } from '../generate';
import type { GenerationContext } from '../types';

/**
 * promise generator: generates the inner value and wraps it in a resolved Promise
 *
 * @param schema - The promise schema
 * @param ctx - Generation context
 * @returns A resolved Promise with the generated inner value
 */
export const promiseGenerator = (
  schema: z.ZodPromise<z.ZodType>,
  ctx: GenerationContext,
): Promise<unknown> => {
  return Promise.resolve(generate(schema.def.innerType as z.ZodType, ctx));
};
