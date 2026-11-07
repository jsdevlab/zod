import type { z } from 'zod';

/** Generation mode: init deterministic initialization / mock random */
export type GeneratorMode = 'init' | 'mock';

/** Generator: schema → a value matching its output type (deterministic in init mode, random in mock mode) */
export type Generator = (schema: z.ZodType, ctx: GenerationContext) => unknown;

/**
 * Custom generator registration: schema is a zod type instance (reference match)
 * or a type class (instanceof match, how built-in generators are registered);
 * instance matching takes priority
 */
export interface GeneratorDefinition {
  schema: z.ZodType | (new (...args: never[]) => z.ZodType);
  generator: Generator;
}

/** Size range for array/collection-like containers */
export interface SizeOptions {
  /** Minimum size; falls back to the schema constraint when omitted */
  min?: number;
  /** Maximum size; falls back to the schema constraint when omitted */
  max?: number;
}

/** Appearance probability of optional/nullable fields in mock mode */
export interface ChanceOptions {
  /** Probability of generating undefined/null (0-1, default 0.3) */
  chance?: number;
}

/** String options */
export interface StringOptions {
  /** Fixed length or [min, max] range (overrides the schema's own constraints) */
  length?: number | [number, number];
}

/** Date range */
export interface DateOptions {
  min?: Date;
  max?: Date;
}

/** How to handle schemas that cannot generate/initialize a value (z.custom / z.xor, etc.) */
export type UnhandledStrategy = 'throw' | 'skip';

/** Generation config (second argument of create / mock) */
export interface MockOptions {
  /**
   * Random seed. `mock` uses a random seed when omitted (different result per
   * call); passing the same seed reproduces the same result. `create` is
   * always deterministic.
   */
  seed?: number;
  /** Recursion depth limit (lazy self-reference guard, default 10) */
  recursionLimit?: number;
  /** Custom generators (matched by schema instance, take priority over built-ins) */
  generators?: GeneratorDefinition[];
  array?: SizeOptions;
  record?: SizeOptions;
  map?: SizeOptions;
  set?: SizeOptions;
  optional?: ChanceOptions;
  nullable?: ChanceOptions;
  /** Whether to prefer field defaults (default true in both modes) */
  useDefault?: boolean;
  /**
   * How to handle schemas that cannot produce a value (z.custom / z.xor, etc.):
   * 'throw' (default) throws; 'skip' returns undefined (combined with defaults to provide a fallback)
   */
  unhandled?: UnhandledStrategy;
  date?: DateOptions;
  string?: StringOptions;
}

/** Generation context: spans a single generation run */
export interface GenerationContext {
  mode: GeneratorMode;
  /**
   * Internal direction: `output` for normal generation, `input` while
   * producing a raw value to feed a transform/pipe. Most generators ignore it;
   * pipe/codec generators use it to generate the input side when the input and
   * output types differ.
   */
  direction?: 'input' | 'output';
  /** Seeded random utility (same seed, same sequence) */
  random: Random;
  /** Current field path (object field names, used for defaults fallback lookup and error location) */
  path: Array<string | number>;
  /** Recursion depth counter (lazy self-reference detection) */
  recursion: Map<z.ZodType, number>;
  options: Required<MockOptions>;
  generators: GeneratorDefinition[];
  /** Caller-provided defaults (generators look up fallback values by path) */
  defaults?: unknown;
}

/** Seeded random utility */
export interface Random {
  /**
   * Float in [0, 1)
   *
   * @returns A random float in [0, 1)
   */
  float(): number;
  /**
   * Integer in the closed interval [min, max]
   *
   * @param min - The minimum value (inclusive)
   * @param max - The maximum value (inclusive)
   * @returns A random integer in the closed interval [min, max]
   */
  int(min: number, max: number): number;
  /**
   * Pick one item at random from an array
   *
   * @typeParam T - The item type
   * @param items - The array to pick from
   * @returns A randomly chosen item
   */
  pick<T>(items: readonly T[]): T;
  /**
   * Return true with probability p
   *
   * @param p - The probability of returning true (0-1)
   * @returns True with probability p
   */
  chance(p: number): boolean;
  /**
   * Generate a string of the given length from a charset
   *
   * @param length - The string length
   * @param charset - The characters to draw from
   * @returns A random string of the given length
   */
  string(length: number, charset: string): string;
}

/** No generator available (schema type not registered and no custom generator) */
export class NoGeneratorException extends Error {
  /**
   * @param schema - The schema that has no registered generator
   */
  constructor(schema: unknown) {
    super(`No generator for schema: ${String(schema)}`);
    this.name = 'NoGeneratorException';
  }
}

/** Recursion depth limit exceeded (lazy self-reference) */
export class RecursionLimitReachedException extends Error {
  /**
   * @param limit - The recursion depth limit that was exceeded
   */
  constructor(limit: number) {
    super(`Recursion limit reached (${limit})`);
    this.name = 'RecursionLimitReachedException';
  }
}
