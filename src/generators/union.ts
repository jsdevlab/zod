import type { z } from 'zod';

import { generate } from '../generate';
import type { GenerationContext } from '../types';

/**
 * union generator: init picks the first branch; mock picks a random branch
 *
 * @param schema - The union schema
 * @param ctx - Generation context
 * @returns A generated value from the selected branch
 */
export const unionGenerator = (
  schema: z.ZodUnion<[z.ZodType, ...z.ZodType[]]>,
  ctx: GenerationContext,
): unknown => {
  const options = schema.def.options as z.ZodType[];
  const branch = ctx.mode === 'init' ? options[0] : ctx.random.pick(options);
  return generate(branch, ctx);
};
