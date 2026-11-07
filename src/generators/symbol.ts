import type { z } from 'zod';

import type { GenerationContext } from '../types';

/**
 * symbol generator: both modes return a new symbol (symbol has no content to initialize)
 *
 * @param _schema - The symbol schema (unused)
 * @param _ctx - Generation context (unused)
 * @returns A new unique symbol
 */
export const symbolGenerator = (
  _schema: z.ZodSymbol,
  _ctx: GenerationContext,
): symbol => {
  return Symbol();
};
