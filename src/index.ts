import { faker } from '@faker-js/faker';
import type { z } from 'zod';

import { generate } from './generate';
import { defaultGenerators } from './generators';
import { createRandom } from './random';
import type { GenerationContext, MockOptions } from './types';

export type {
  DateOptions,
  GenerationContext,
  Generator,
  GeneratorDefinition,
  GeneratorMode,
  MockOptions,
  NoGeneratorException,
  Random,
  RecursionLimitReachedException,
  SizeOptions,
  StringOptions,
} from './types';

/**
 * Deep Partial: nested object fields can be partially overridden
 *
 * @typeParam T - The type to make deeply partial
 */
export type DeepPartial<T> =
  T extends ReadonlyArray<infer U>
    ? Array<DeepPartial<U>>
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

/**
 * Generation options: MockOptions plus caller-provided field default overrides
 *
 * @typeParam T - The schema type
 */
export interface GenerateOptions<T extends z.ZodType> extends MockOptions {
  /**
   * Overrides for generated result field defaults (deep merge; typed as
   * DeepPartial<z.output<T>>, field names and types checked at compile time,
   * nested objects can be partially overridden)
   */
  defaults?: DeepPartial<z.output<T>>;
}

const DEFAULT_OPTIONS: Required<MockOptions> = {
  seed: 1,
  recursionLimit: 10,
  generators: [],
  array: {},
  record: {},
  map: {},
  set: {},
  optional: { chance: 0.3 },
  nullable: { chance: 0.3 },
  useDefault: true,
  unhandled: 'throw',
  date: {},
  string: {},
};

function normalizeOptions(options: MockOptions): Required<MockOptions> {
  return {
    seed: options.seed ?? DEFAULT_OPTIONS.seed,
    recursionLimit: options.recursionLimit ?? DEFAULT_OPTIONS.recursionLimit,
    generators: options.generators ?? [],
    array: { ...DEFAULT_OPTIONS.array, ...options.array },
    record: { ...DEFAULT_OPTIONS.record, ...options.record },
    map: { ...DEFAULT_OPTIONS.map, ...options.map },
    set: { ...DEFAULT_OPTIONS.set, ...options.set },
    optional: { ...DEFAULT_OPTIONS.optional, ...options.optional },
    nullable: { ...DEFAULT_OPTIONS.nullable, ...options.nullable },
    useDefault: options.useDefault ?? DEFAULT_OPTIONS.useDefault,
    unhandled: options.unhandled ?? DEFAULT_OPTIONS.unhandled,
    date: { ...DEFAULT_OPTIONS.date, ...options.date },
    string: { ...DEFAULT_OPTIONS.string, ...options.string },
  };
}

/**
 * Deep-merge caller defaults into the generated result (recursive for nested objects; non-objects override)
 *
 * @param value - The generated value
 * @param defaults - The caller-provided defaults (deep-merged into the result)
 * @returns The merged result
 */
function applyDefaults(value: unknown, defaults?: unknown): unknown {
  if (defaults === undefined) return value;
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    defaults !== null &&
    typeof defaults === 'object' &&
    !Array.isArray(defaults)
  ) {
    const out: Record<string, unknown> = {
      ...(value as Record<string, unknown>),
    };
    for (const [key, sub] of Object.entries(defaults)) {
      out[key] = applyDefaults((value as Record<string, unknown>)[key], sub);
    }
    return out;
  }
  return (defaults as unknown) ?? value;
}

function run<T extends z.ZodType>(
  schema: T,
  mode: 'init' | 'mock',
  options: GenerateOptions<T> = {},
): z.output<T> {
  // init pins seed 0 (deterministic); mock reproduces with an explicit seed, otherwise random each call (ensures randomness)
  const seed =
    mode === 'init'
      ? 0
      : (options.seed ?? Math.floor(Math.random() * 0xffffffff));
  const normalized = normalizeOptions({ ...options, seed });
  // Sync faker's global seed with the PRNG
  faker.seed(seed);
  const ctx: GenerationContext = {
    mode,
    direction: 'output',
    random: createRandom(normalized.seed),
    path: [],
    recursion: new Map(),
    options: normalized,
    generators: [...normalized.generators, ...defaultGenerators],
    defaults: options.defaults,
  };
  const value = generate(schema, ctx);
  return applyDefaults(value, options.defaults) as z.output<T>;
}

/**
 * Generates deterministic initialization data from a zod schema (form initial value / fresh empty object).
 * Respects field defaults; string '' / number 0 / boolean false / array [] / optional undefined / nullable null.
 * `defaults` can override any field of the generated result (typed as Partial<z.output<T>>)
 *
 * @typeParam T - The schema type
 * @param schema - The zod schema
 * @param options - Generation options
 * @returns A value matching `z.output<T>`
 * @throws {NoGeneratorException} When the schema type has no registered generator
 */
export function create<T extends z.ZodType>(
  schema: T,
  options: GenerateOptions<T> = {},
): z.output<T> {
  return run(schema, 'init', options);
}

/**
 * Generates random mock data from a zod schema (testing / demos).
 * Mock data such as strings is produced by faker; respects field defaults and schema
 * constraints (length/range/format/step), and results are reproducible for the same seed.
 * `defaults` can override any field of the generated result
 *
 * @typeParam T - The schema type
 * @param schema - The zod schema
 * @param options - Generation options
 * @returns A value matching `z.output<T>`
 * @throws {NoGeneratorException} When the schema type has no registered generator
 */
export function mock<T extends z.ZodType>(
  schema: T,
  options: GenerateOptions<T> = {},
): z.output<T> {
  return run(schema, 'mock', options);
}
