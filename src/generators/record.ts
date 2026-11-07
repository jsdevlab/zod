import { z } from 'zod';

import { generate } from '../generate';
import type { GenerationContext } from '../types';

/** Structural view of the record definition */
interface RecordDefinition {
  def: {
    keyType: z.ZodType;
    valueType: z.ZodType;
    partial?: boolean;
  };
}

/**
 * Read the fixed key set of an enum/literal keyed record
 *
 * @param keyType - The record key schema
 * @returns The fixed keys, or undefined for open records (string/number keys)
 */
function fixedKeys(keyType: z.ZodType): unknown[] | undefined {
  if (keyType instanceof z.ZodEnum) {
    return keyType.options as unknown[];
  }
  if (keyType instanceof z.ZodLiteral) {
    return keyType.def.values as unknown[];
  }
  return undefined;
}

/**
 * Record generator: init returns {} (or every required enum key);
 * mock generates 0-10 random key-value pairs. Enum-keyed records include all
 * required keys, while `z.partialRecord()` picks a random subset.
 *
 * @param schema - The record schema
 * @param ctx - Generation context
 * @returns A record of generated key-value pairs
 */
export const recordGenerator = (
  schema: z.ZodType,
  ctx: GenerationContext,
): Record<string, unknown> => {
  const { keyType, valueType, partial } = (
    schema as unknown as RecordDefinition
  ).def;
  const keys = fixedKeys(keyType);
  const out: Record<string, unknown> = {};

  if (keys !== undefined && partial !== true) {
    // Non-partial enum records require every key to be present.
    for (const key of keys) {
      out[String(key)] = generate(valueType, ctx);
    }
    return out;
  }

  const min = ctx.options.record.min ?? 0;
  const max = Math.max(min, ctx.options.record.max ?? 10);

  if (keys !== undefined) {
    const count =
      ctx.mode === 'init'
        ? Math.min(min, keys.length)
        : ctx.random.int(min, Math.min(max, keys.length));
    const pool = [...keys];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const index = ctx.random.int(0, pool.length - 1);
      const [key] = pool.splice(index, 1);
      out[String(key)] = generate(valueType, ctx);
    }
    return out;
  }

  const count = ctx.mode === 'init' ? min : ctx.random.int(min, max);
  for (let i = 0; i < count; i++) {
    const key = generate(keyType, ctx);
    out[String(key)] = generate(valueType, ctx);
  }
  return out;
};
