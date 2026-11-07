import type { z } from 'zod';

import type { GenerationContext } from '../types';

/**
 * Literal generator: returns the literal itself in both modes
 *
 * @param schema - The literal schema
 * @param ctx - Generation context
 * @returns The literal value itself
 */
export const literalGenerator = (
  schema: z.ZodLiteral,
  _ctx: GenerationContext,
): unknown => {
  return schema.def.values[0];
};
