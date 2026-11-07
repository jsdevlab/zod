import type { z } from 'zod';
import type {
  GenerationContext,
  Generator,
  GeneratorDefinition,
} from './types';
import { NoGeneratorException, RecursionLimitReachedException } from './types';

/**
 * Main generation loop: reference (same instance) → instanceof (class match) → throw.
 * Counts recursion depth before generating each schema (lazy self-reference guard)
 * and restores it afterwards
 *
 * @typeParam T - The schema type
 * @param schema - The zod schema
 * @param ctx - The generation context (mode, seed, options, recursion tracking)
 * @returns A value matching `z.output<T>`
 * @throws {RecursionLimitReachedException} When the recursion depth limit is exceeded
 * @throws {NoGeneratorException} When the schema type has no registered generator
 */
export function generate<T extends z.ZodType>(
  schema: T,
  ctx: GenerationContext,
): z.output<T> {
  const depth = ctx.recursion.get(schema) ?? 0;
  if (depth >= ctx.options.recursionLimit) {
    throw new RecursionLimitReachedException(ctx.options.recursionLimit);
  }
  ctx.recursion.set(schema, depth + 1);
  try {
    return generateValue(schema, ctx) as z.output<T>;
  } finally {
    ctx.recursion.set(schema, depth);
  }
}

function generateValue(schema: z.ZodType, ctx: GenerationContext): unknown {
  // reference: same schema instance (custom generators take priority)
  for (const def of ctx.generators) {
    if (def.schema === schema) return def.generator(schema, ctx);
  }
  // instanceof: class match (built-in generators are registered by zod type class)
  for (const def of ctx.generators) {
    if (typeof def.schema === 'function' && schema instanceof def.schema)
      return def.generator(schema, ctx);
  }
  throw new NoGeneratorException(schema);
}

/**
 * Generator registration helper (for the built-in registry and custom use)
 *
 * @param schema - A zod schema instance (reference match) or a type class (instanceof match)
 * @param generator - The generator function for the schema
 * @returns A generator definition pairing the schema with its generator
 */
export function defineGenerator(
  schema: z.ZodType | (new (...args: never[]) => z.ZodType),
  generator: (schema: never, ctx: GenerationContext) => unknown,
): GeneratorDefinition {
  return { schema, generator: generator as unknown as Generator };
}
