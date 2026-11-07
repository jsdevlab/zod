import type { z } from 'zod';

import { sizeConstraints } from '../constraints';
import { generate } from '../generate';
import type { GenerationContext } from '../types';

/** Structural view of the map definition */
interface MapDefinition {
  def: { keyType: z.ZodType; valueType: z.ZodType };
}

/**
 * Map generator: init returns a map with the minimum required size;
 * mock returns 0-10 random key-value pairs within the schema/option range.
 *
 * @param schema - The map schema
 * @param ctx - Generation context
 * @returns A Map of generated key-value pairs
 */
export const mapGenerator = (
  schema: z.ZodType,
  ctx: GenerationContext,
): Map<unknown, unknown> => {
  const { minSize = 0, maxSize } = sizeConstraints(schema);
  let min = Math.max(minSize, ctx.options.map.min ?? 0);
  if (maxSize !== undefined) min = Math.min(min, maxSize);
  let max = ctx.options.map.max ?? maxSize ?? Math.max(10, min);
  if (maxSize !== undefined) max = Math.min(max, maxSize);
  max = Math.max(min, max);
  const count = ctx.mode === 'init' ? min : ctx.random.int(min, max);
  const def = (schema as unknown as MapDefinition).def;
  const out = new Map<unknown, unknown>();
  // Init values are constant per type ('' / 0 / false), so a non-empty init
  // map needs seeded mock values to produce distinct keys.
  const keyCtx =
    ctx.mode === 'init' && count > 1 ? { ...ctx, mode: 'mock' as const } : ctx;

  // Collisions can reduce the final size; retry a bounded number of times.
  const attempts = Math.max(count * 10, 10);
  for (let i = 0; i < attempts && out.size < count; i++) {
    out.set(generate(def.keyType, keyCtx), generate(def.valueType, ctx));
  }
  return out;
};
