import type { z } from 'zod';

import { generate } from '../generate';
import type { GenerationContext } from '../types';

/**
 * tuple generator: recursive per element; rest appends 0-2 random items in mock mode
 *
 * @param schema - The tuple schema
 * @param ctx - Generation context
 * @returns An array of generated element values
 */
export const tupleGenerator = (
  schema: z.ZodTuple<ReadonlyArray<z.ZodType>>,
  ctx: GenerationContext,
): unknown[] => {
  const out = schema.def.items.map((item) => generate(item as z.ZodType, ctx));
  const rest = schema.def.rest as z.ZodType | null | undefined;
  if (rest && ctx.mode === 'mock') {
    const count = ctx.random.int(0, 2);
    for (let i = 0; i < count; i++) out.push(generate(rest, ctx));
  }
  return out;
};
