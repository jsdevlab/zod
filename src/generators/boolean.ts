import type { z } from 'zod';

import type { GenerationContext } from '../types';

/**
 * Boolean generator: returns false in init mode; random true/false in mock mode
 *
 * @param schema - The boolean schema
 * @param ctx - Generation context
 * @returns A generated boolean value
 */
export const booleanGenerator = (
  _schema: z.ZodBoolean,
  ctx: GenerationContext,
): boolean => {
  return ctx.mode === 'init' ? false : ctx.random.chance(0.5);
};
