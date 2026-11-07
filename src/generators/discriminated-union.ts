import type { z } from 'zod';

import { generate } from '../generate';
import type { GenerationContext } from '../types';

/**
 * Discriminated union generator: takes the first option in init mode; picks a random one in mock mode
 *
 * @param schema - The discriminated union schema
 * @param ctx - Generation context
 * @returns A value generated from one of the union options
 */
export const discriminatedUnionGenerator = (
  schema: z.ZodType,
  ctx: GenerationContext,
): unknown => {
  const options = (schema as unknown as { def: { options: z.ZodType[] } }).def
    .options;
  const branch = ctx.mode === 'init' ? options[0] : ctx.random.pick(options);
  return generate(branch, ctx);
};
