import type { z } from 'zod';

import { sizeConstraints } from '../constraints';
import { generate } from '../generate';
import type { GenerationContext } from '../types';

/** Structural view of the set definition */
interface SetDefinition {
  def: { valueType: z.ZodType };
}

/**
 * Set generator: init returns a set with the minimum required size;
 * mock returns 0-10 random elements within the schema/option range.
 *
 * @param schema - The set schema
 * @param ctx - Generation context
 * @returns A Set of generated elements
 */
export const setGenerator = (
  schema: z.ZodType,
  ctx: GenerationContext,
): Set<unknown> => {
  const { minSize = 0, maxSize } = sizeConstraints(schema);
  let min = Math.max(minSize, ctx.options.set.min ?? 0);
  if (maxSize !== undefined) min = Math.min(min, maxSize);
  let max = ctx.options.set.max ?? maxSize ?? Math.max(10, min);
  if (maxSize !== undefined) max = Math.min(max, maxSize);
  max = Math.max(min, max);
  const count = ctx.mode === 'init' ? min : ctx.random.int(min, max);
  const def = (schema as unknown as SetDefinition).def;
  const out = new Set<unknown>();
  // Init values are constant per type ('' / 0 / false), so a non-empty init
  // set needs seeded mock values to produce distinct elements.
  const valueCtx =
    ctx.mode === 'init' && count > 1 ? { ...ctx, mode: 'mock' as const } : ctx;

  // Duplicates can reduce the final size; retry a bounded number of times.
  const attempts = Math.max(count * 10, 10);
  for (let i = 0; i < attempts && out.size < count; i++) {
    out.add(generate(def.valueType, valueCtx));
  }
  return out;
};
