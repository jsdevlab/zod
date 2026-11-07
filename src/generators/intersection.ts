import type { z } from 'zod';

import { generate } from '../generate';
import type { GenerationContext } from '../types';

/**
 * Intersection generator: merges the values generated from both sides (the right side
 * overrides conflicting keys); returns the left side for non-object scenarios
 *
 * @param schema - The intersection schema
 * @param ctx - Generation context
 * @returns The merged value from both sides (or the left side for non-object scenarios)
 */
export const intersectionGenerator = (
  schema: z.ZodIntersection<z.ZodType, z.ZodType>,
  ctx: GenerationContext,
): unknown => {
  const left = generate(schema.def.left as z.ZodType, ctx);
  const right = generate(schema.def.right as z.ZodType, ctx);
  if (
    left !== null &&
    typeof left === 'object' &&
    !Array.isArray(left) &&
    right !== null &&
    typeof right === 'object' &&
    !Array.isArray(right)
  ) {
    return { ...left, ...right };
  }
  return left;
};
