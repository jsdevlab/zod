import { z } from 'zod';

import { generate } from '../generate';
import type { GenerationContext } from '../types';

/**
 * Detect the error zod throws when a schema with an async transform is
 * synchronously parsed
 *
 * @param error - The thrown value
 * @returns True when the error asks for `parseAsync`
 */
function isAsyncParseError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /synchronous parse|parseAsync/i.test(error.message)
  );
}

/**
 * pipe/codec generator:
 * - when the output side is a concrete schema (`z.stringbool()`,
 *   `z.codec()`, `input.pipe(output)`), generate the output value directly;
 * - when the output side is a transform, generate a value for the input side
 *   and run it through `parse()` so the returned value is the transform output
 *   (`z.output<T>`).
 *
 * Async transforms cannot be resolved synchronously, so they raise a clear
 * error instead of returning a Promise that does not match `z.output<T>`.
 *
 * @param schema - The pipe schema
 * @param ctx - Generation context
 * @returns A value satisfying `z.output<T>`
 */
export const pipeGenerator = (
  schema: z.ZodPipe<z.ZodType, z.ZodType>,
  ctx: GenerationContext,
): unknown => {
  const out = schema.def.out as z.ZodType;

  // While feeding a transform, generate the raw input side of the pipe.
  if (ctx.direction === 'input') {
    if (schema instanceof z.ZodPreprocess) {
      // Preprocess has no input schema; its output is the closest value we
      // can feed back through the preprocessing function.
      return generate(out, { ...ctx, direction: 'output' });
    }
    return generate(schema.def.in as z.ZodType, ctx);
  }

  if (!(out instanceof z.ZodTransform)) {
    return generate(out, ctx);
  }

  const input = generate(schema.def.in as z.ZodType, {
    ...ctx,
    direction: 'input',
  });
  try {
    return schema.parse(input);
  } catch (error) {
    if (isAsyncParseError(error)) {
      throw new Error(
        'Async transforms cannot be generated synchronously; register a ' +
          'custom generator for this schema or provide defaults.',
      );
    }
    throw error;
  }
};
