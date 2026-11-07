import type { z } from 'zod';

import type { GenerationContext } from '../types';

/**
 * Enum generator (z.enum, including TS enum objects):
 * returns the first value in init mode; picks a random enum value in mock mode
 *
 * @param schema - The enum schema
 * @param ctx - Generation context
 * @returns An enum value (the first one in init mode, a random one in mock mode)
 */
export const enumGenerator = (
  schema: z.ZodEnum,
  ctx: GenerationContext,
): unknown => {
  // `options` holds the actual accepted values; `def.entries` also contains
  // reverse mappings for numeric TypeScript enums.
  const values = schema.options;
  if (ctx.mode === 'init') return values[0];
  return ctx.random.pick(values);
};
