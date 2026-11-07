import { z } from 'zod';

import { fileMimeTypes, sizeConstraints } from '../constraints';
import { generate } from '../generate';
import type { GenerationContext } from '../types';

/**
 * Generators for zod 4 additional types:
 * - base64 / base64url: strings (reuse the base64 format from string generation)
 * - exactOptional / nonoptional / preprocess: unwrap to the relevant schema
 * - pipe / codec: generate the output schema; transform-only pipes generate
 *   the input value and run it through the transform
 * - prefault: take the prefault value (same semantics as default)
 * - templateLiteral: alternate static segments and schema segments
 * - file: File instance (mock with random content and the required MIME type)
 * - custom / xor: no reasonable value can be generated, throw explicitly
 */

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function randomBase64(length: number, ctx: GenerationContext): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ctx.random.pick(BASE64_CHARS.split(''));
  }
  return out;
}

/**
 * z.base64() / z.base64url(): not ZodString subclasses, need a dedicated generator
 *
 * @param schema - The base64/base64url schema
 * @param ctx - Generation context
 * @returns A base64 (or base64url) string; empty string in init mode
 */
export const base64Generator = (
  schema: z.ZodType,
  ctx: GenerationContext,
): string => {
  if (ctx.mode === 'init') return '';
  const isUrl = (schema as { format?: string | null }).format === 'base64url';
  const value = randomBase64(ctx.random.int(2, 6) * 4, ctx);
  return isUrl
    ? value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    : value;
};

/**
 * z.exactOptional(): key may be absent but explicit undefined is invalid → generate the innerType value directly
 *
 * @param schema - The exactOptional schema
 * @param ctx - Generation context
 * @returns A generated value for the inner type
 */
export const exactOptionalGenerator = (
  schema: z.ZodType,
  ctx: GenerationContext,
): unknown => {
  return generate(
    (schema as unknown as { def: { innerType: z.ZodType } }).def.innerType,
    ctx,
  );
};

/**
 * z.nonoptional(): unwrap to the inner schema for generation (innerType may be optional, unwrap one more layer)
 *
 * @param schema - The nonoptional schema
 * @param ctx - Generation context
 * @returns A generated value for the innermost non-optional schema
 */
export const nonOptionalGenerator = (
  schema: z.ZodType,
  ctx: GenerationContext,
): unknown => {
  let inner = (schema as unknown as { def: { innerType: z.ZodType } }).def
    .innerType;
  while (inner instanceof z.ZodOptional) {
    inner = (inner as unknown as { def: { innerType: z.ZodType } }).def
      .innerType;
  }
  return generate(inner, ctx);
};

/**
 * z.prefault(inner, value): take the prefault value (same semantics as default)
 *
 * @param schema - The prefault schema
 * @param ctx - Generation context
 * @returns The prefault value (when options.useDefault) or a generated inner value
 */
export const prefaultGenerator = (
  schema: z.ZodType,
  ctx: GenerationContext,
): unknown => {
  const def = (schema as unknown as { def: { defaultValue: unknown } }).def;
  if (ctx.options.useDefault) return def.defaultValue;
  return generate(
    (schema as unknown as { def: { innerType: z.ZodType } }).def.innerType,
    ctx,
  );
};

/**
 * z.preprocess(fn, inner): generate a value for the target schema (def.out)
 *
 * @param schema - The preprocess schema
 * @param ctx - Generation context
 * @returns A generated value for the output schema
 */
export const preprocessGenerator = (
  schema: z.ZodType,
  ctx: GenerationContext,
): unknown => {
  return generate(
    (schema as unknown as { def: { out: z.ZodType } }).def.out,
    ctx,
  );
};

/**
 * A bare `z.transform()` has no input schema, so no value can be generated
 * for it. Pipes (`input.pipe(transform)`) are handled by the pipe generator,
 * which generates the input and applies the transform.
 *
 * @throws {Error} Always
 */
export const transformGenerator = (): never => {
  throw new Error(
    'z.transform() cannot be generated directly: it has no input schema. ' +
      'Use z.pipe(input, transform) or provide a custom generator.',
  );
};

/**
 * z.templateLiteral(strings, schemas): concatenate static segments and schema segments alternately
 *
 * @param schema - The templateLiteral schema
 * @param ctx - Generation context
 * @returns A string combining static and generated segments
 */
export const templateLiteralGenerator = (
  schema: z.ZodType,
  ctx: GenerationContext,
): string => {
  const def = schema as unknown as {
    def: { parts: ReadonlyArray<string | z.ZodType> };
  };
  const parts = def.def.parts;
  let out = '';
  for (const part of parts) {
    out += part instanceof z.ZodType ? String(generate(part, ctx)) : part;
  }
  return out;
};

const FILE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * z.file(): File instance with random content, respecting size and MIME checks
 *
 * @param schema - The file schema
 * @param ctx - Generation context
 * @returns A File instance (minimum size in init mode)
 */
export const fileGenerator = (
  schema: z.ZodType,
  ctx: GenerationContext,
): File => {
  const { minSize = 0, maxSize = 20 } = sizeConstraints(schema);
  const upper = Math.max(minSize, maxSize);
  const size = ctx.mode === 'init' ? minSize : ctx.random.int(minSize, upper);
  const type = fileMimeTypes(schema)[0] ?? 'text/plain';
  return new File([ctx.random.string(size, FILE_CHARS)], 'mock.txt', { type });
};

/**
 * Fallback strategy when no value can be generated: prefer defaults
 * (look up caller-provided default values by path);
 * with no default, throw per options.unhandled (default) or skip (return undefined)
 *
 * @param schemaName - Name of the schema used in the thrown error message
 * @param ctx - Generation context
 * @returns The fallback value, or undefined when skipping
 * @throws {Error} When no default exists and options.unhandled is not 'skip'
 */
function unhandledFallback(
  schemaName: string,
  ctx: GenerationContext,
): unknown {
  const fallback = lookupDefaults(ctx);
  if (fallback !== undefined) return fallback;
  if (ctx.options.unhandled === 'skip') return undefined;
  throw new Error(
    `${schemaName} cannot be generated; provide a value via options.defaults, a custom generator, or set options.unhandled: 'skip'`,
  );
}

/**
 * Look up a fallback value from defaults by the current field path
 *
 * @param ctx - Generation context (defaults root and current path)
 * @returns The matched default value, or undefined when no match
 */
function lookupDefaults(ctx: GenerationContext): unknown {
  let current: unknown = ctx.defaults;
  for (const key of ctx.path) {
    if (
      current !== null &&
      typeof current === 'object' &&
      !Array.isArray(current) &&
      Object.hasOwn(current, key)
    ) {
      current = (current as Record<string | number, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * z.custom(): prefer defaults fallback; otherwise throw or skip per the unhandled strategy
 *
 * @param _schema - The custom schema (unused)
 * @param ctx - Generation context
 * @returns The fallback value, or undefined when skipping
 * @throws {Error} When no default exists and options.unhandled is not 'skip'
 */
export const customGenerator = (
  _schema: z.ZodType,
  ctx: GenerationContext,
): unknown => {
  return unhandledFallback('z.custom()', ctx);
};

/**
 * z.xor(): a value must match exactly one branch, which cannot be guaranteed
 * without validating the generated result → prefer the defaults fallback;
 * otherwise throw or skip per the unhandled strategy
 *
 * @param _schema - The xor schema (unused)
 * @param ctx - Generation context
 * @returns The fallback value, or undefined when skipping
 * @throws {Error} When no default exists and options.unhandled is not 'skip'
 */
export const xorGenerator = (
  _schema: z.ZodType,
  ctx: GenerationContext,
): unknown => {
  return unhandledFallback('z.xor()', ctx);
};
