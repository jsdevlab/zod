import type { z } from 'zod';

import { arrayConstraints } from '../constraints';
import { generate } from '../generate';
import type { GenerationContext } from '../types';

/**
 * Array generator: init returns an array with the minimum required length;
 * mock returns a random length within the schema/option range.
 *
 * @param schema - The array schema
 * @param ctx - Generation context
 * @returns An array of generated element values
 */
export const arrayGenerator = (
  schema: z.ZodArray<z.ZodType>,
  ctx: GenerationContext,
): unknown[] => {
  const { minLength = 0, maxLength } = arrayConstraints(schema);
  // Options may narrow the range, but never to a size the schema rejects.
  let min = Math.max(minLength, ctx.options.array.min ?? 0);
  if (maxLength !== undefined) min = Math.min(min, maxLength);
  let max = ctx.options.array.max ?? maxLength ?? Math.max(10, min);
  if (maxLength !== undefined) max = Math.min(max, maxLength);
  max = Math.max(min, max);
  const count = ctx.mode === 'init' ? min : ctx.random.int(min, max);
  const out: unknown[] = [];
  for (let i = 0; i < count; i++) {
    out.push(generate(schema.def.element as z.ZodType, ctx));
  }
  return out;
};
