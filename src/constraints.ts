import type { z } from 'zod';

/**
 * Zod 4 stores the checks attached to a schema in `schema.def.checks`.
 * Each check instance keeps its parameters in `check._zod.def`; there is no
 * public getter for everything (`multipleOf`, size checks, exclusive bounds),
 * so this module reads a small structural view of those definitions.
 *
 * Public derived accessors (`schema.format`, `schema.minLength`,
 * `schema.minValue`, ...) are preferred whenever zod exposes them.
 */
interface CheckDef {
  check?: string;
  minimum?: unknown;
  maximum?: unknown;
  value?: unknown;
  inclusive?: boolean;
  mime?: readonly string[];
  includes?: unknown;
  prefix?: unknown;
  suffix?: unknown;
}

interface CheckLike {
  def?: CheckDef;
  _zod?: { def?: CheckDef };
}

interface SchemaWithChecks {
  def?: { checks?: readonly CheckLike[] };
}

/**
 * Read the normalized check definitions attached to a schema
 *
 * @param schema - The zod schema
 * @returns The check definitions (empty when the schema has no checks)
 */
function readChecks(schema: z.ZodType): CheckDef[] {
  const checks = (schema as SchemaWithChecks).def?.checks;
  if (!Array.isArray(checks)) return [];
  const defs: CheckDef[] = [];
  for (const check of checks) {
    const def = check._zod?.def ?? check.def;
    if (def !== undefined) defs.push(def);
  }
  return defs;
}

/**
 * Read a numeric field (`minimum`/`maximum`) from checks of the given kind
 *
 * @param checks - The check definitions
 * @param kind - The check kind (e.g. `min_length`, `min_size`)
 * @param field - The field holding the bound (`minimum` or `maximum`)
 * @returns The bound, or undefined when absent
 */
function boundFromChecks(
  checks: readonly CheckDef[],
  kind: string,
  field: 'minimum' | 'maximum',
): number | undefined {
  let bound: number | undefined;
  for (const def of checks) {
    if (def.check !== kind) continue;
    const value = def[field];
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (bound === undefined) {
        bound = value;
      } else {
        // Lower bounds intersect with max, upper bounds with min.
        bound =
          field === 'minimum' ? Math.max(bound, value) : Math.min(bound, value);
      }
    }
  }
  return bound;
}

/** String constraints: length and format */
export interface StringConstraints {
  minLength?: number;
  maxLength?: number;
  /** Format name of a string format schema (email, uuid, iso date, ...) */
  format?: string;
}

/** Structural view of `ZodString` / `ZodStringFormat` getters */
interface StringSchemaView {
  format?: string | null;
  minLength?: number | null;
  maxLength?: number | null;
}

/**
 * Reads string constraints (length and format) from a zod schema
 *
 * @param schema - The zod schema
 * @returns The string constraints (min/max length and format)
 */
export function stringConstraints(schema: z.ZodType): StringConstraints {
  const view = schema as StringSchemaView;
  const checks = readChecks(schema);
  const fallbackMin = boundFromChecks(checks, 'min_length', 'minimum');
  const fallbackMax = boundFromChecks(checks, 'max_length', 'maximum');
  const min = typeof view.minLength === 'number' ? view.minLength : fallbackMin;
  const max = typeof view.maxLength === 'number' ? view.maxLength : fallbackMax;
  return {
    minLength: min,
    maxLength: max,
    format: typeof view.format === 'string' ? view.format : undefined,
  };
}

/** number: range, step and integer constraints */
export interface NumberConstraints {
  /** Inclusive lower bound */
  min?: number;
  /** Inclusive upper bound */
  max?: number;
  /** Exclusive lower bound (`gt`) */
  exclusiveMin?: number;
  /** Exclusive upper bound (`lt`) */
  exclusiveMax?: number;
  multipleOf?: number;
  /** The schema only accepts integers (format includes `int`) */
  isInt: boolean;
  format?: string;
}

/** Structural view of the public `ZodNumber` derived getters */
interface NumberSchemaView {
  minValue?: number | null;
  maxValue?: number | null;
  format?: string | null;
}

const SAFE_INT_MIN = Number.MIN_SAFE_INTEGER;
const SAFE_INT_MAX = Number.MAX_SAFE_INTEGER;
const FLOAT32_MAX = 3.4028234663852886e38;
const FLOAT64_MAX = Number.MAX_VALUE;

/**
 * Whether an exclusive check sits exactly on the effective bound.
 * The public `minValue`/`maxValue` getters merge inclusive and exclusive
 * checks, so equality tells us whether the bound must be exclusive.
 *
 * @param checks - The check definitions
 * @param kind - `greater_than` or `less_than`
 * @param bound - The effective bound reported by the public getter
 * @returns True when an exclusive check defines that bound
 */
function isExclusiveBound(
  checks: readonly CheckDef[],
  kind: 'greater_than' | 'less_than',
  bound: number,
): boolean {
  return checks.some(
    (def) =>
      def.check === kind && def.inclusive === false && def.value === bound,
  );
}

/**
 * Reads number constraints (range, exclusive bounds, step, int marker)
 * from a zod schema
 *
 * @param schema - The zod schema
 * @returns The number constraints
 */
export function numberConstraints(schema: z.ZodType): NumberConstraints {
  const view = schema as NumberSchemaView;
  const checks = readChecks(schema);
  const format = typeof view.format === 'string' ? view.format : undefined;

  let min =
    typeof view.minValue === 'number' && Number.isFinite(view.minValue)
      ? view.minValue
      : undefined;
  let max =
    typeof view.maxValue === 'number' && Number.isFinite(view.maxValue)
      ? view.maxValue
      : undefined;

  // Format-imposed ranges are validation limits, not useful mock bounds.
  if (format === 'safeint') {
    if (min === SAFE_INT_MIN) min = undefined;
    if (max === SAFE_INT_MAX) max = undefined;
  } else if (format === 'float32') {
    if (min === -FLOAT32_MAX) min = undefined;
    if (max === FLOAT32_MAX) max = undefined;
  } else if (format === 'float64') {
    if (min === -FLOAT64_MAX) min = undefined;
    if (max === FLOAT64_MAX) max = undefined;
  }

  const exclusiveMin =
    min !== undefined && isExclusiveBound(checks, 'greater_than', min)
      ? min
      : undefined;
  const exclusiveMax =
    max !== undefined && isExclusiveBound(checks, 'less_than', max)
      ? max
      : undefined;

  let multipleOf: number | undefined;
  for (const def of checks) {
    if (def.check !== 'multiple_of') continue;
    const value = def.value;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      multipleOf = value;
    }
  }

  return {
    min: exclusiveMin === undefined ? min : undefined,
    max: exclusiveMax === undefined ? max : undefined,
    exclusiveMin,
    exclusiveMax,
    multipleOf,
    isInt: format?.includes('int') === true,
    format,
  };
}

/** bigint: range and step constraints */
export interface BigIntConstraints {
  min?: bigint;
  max?: bigint;
  exclusiveMin?: bigint;
  exclusiveMax?: bigint;
  multipleOf?: bigint;
}

/** Structural view of the public `ZodBigInt` derived getters */
interface BigIntSchemaView {
  minValue?: bigint | null;
  maxValue?: bigint | null;
}

/**
 * Reads bigint constraints (range, exclusive bounds, step) from a zod schema
 *
 * @param schema - The zod schema
 * @returns The bigint constraints
 */
export function bigintConstraints(schema: z.ZodType): BigIntConstraints {
  const view = schema as BigIntSchemaView;
  const checks = readChecks(schema);
  const min = typeof view.minValue === 'bigint' ? view.minValue : undefined;
  const max = typeof view.maxValue === 'bigint' ? view.maxValue : undefined;

  const exclusiveMin = checks.some(
    (def) =>
      def.check === 'greater_than' &&
      def.inclusive === false &&
      typeof def.value === 'bigint' &&
      def.value === min,
  )
    ? min
    : undefined;
  const exclusiveMax = checks.some(
    (def) =>
      def.check === 'less_than' &&
      def.inclusive === false &&
      typeof def.value === 'bigint' &&
      def.value === max,
  )
    ? max
    : undefined;

  let multipleOf: bigint | undefined;
  for (const def of checks) {
    if (def.check !== 'multiple_of') continue;
    const value = def.value;
    if (typeof value === 'bigint' && value > 0n) multipleOf = value;
  }

  return {
    min: exclusiveMin === undefined ? min : undefined,
    max: exclusiveMax === undefined ? max : undefined,
    exclusiveMin,
    exclusiveMax,
    multipleOf,
  };
}

/** Options stored on string format schemas (UUID version, ISO precision, ...) */
export interface StringFormatOptions {
  /** UUID version (`v4`, `v6`, ...) */
  version?: string;
  /** ISO time/datetime fraction precision (null means any) */
  precision?: number | null;
  local?: boolean;
  offset?: boolean;
  /** Required substring of `includes` checks */
  includes?: string;
  /** Required prefix of `startsWith` checks */
  prefix?: string;
  /** Required suffix of `endsWith` checks */
  suffix?: string;
}

/** Structural view of a string format schema definition */
interface StringFormatSchemaView {
  def?: {
    version?: unknown;
    precision?: unknown;
    local?: unknown;
    offset?: unknown;
  };
}

/**
 * Reads the format parameters of a string format schema
 * (`z.uuidv7()`, `z.iso.datetime({ precision: 3 })`, ...)
 *
 * @param schema - The string format schema
 * @returns The format options (version and ISO precision flags)
 */
export function stringFormatOptions(schema: z.ZodType): StringFormatOptions {
  const def = (schema as StringFormatSchemaView).def;
  const formatCheck = readChecks(schema).find(
    (check) => check.check === 'string_format',
  );
  return {
    version: typeof def?.version === 'string' ? def.version : undefined,
    precision:
      typeof def?.precision === 'number' || def?.precision === null
        ? def.precision
        : undefined,
    local: typeof def?.local === 'boolean' ? def.local : undefined,
    offset: typeof def?.offset === 'boolean' ? def.offset : undefined,
    includes:
      typeof formatCheck?.includes === 'string'
        ? formatCheck.includes
        : undefined,
    prefix:
      typeof formatCheck?.prefix === 'string' ? formatCheck.prefix : undefined,
    suffix:
      typeof formatCheck?.suffix === 'string' ? formatCheck.suffix : undefined,
  };
}

/** date: range constraints */
export interface DateConstraints {
  min?: Date;
  max?: Date;
  exclusiveMin?: Date;
  exclusiveMax?: Date;
}

/**
 * Convert a check value (Date, ISO string or timestamp) to milliseconds
 *
 * @param value - The raw check value
 * @returns Milliseconds since epoch, or undefined when not a date
 */
function toTime(value: unknown): number | undefined {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? undefined : time;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? undefined : time;
  }
  return undefined;
}

/**
 * Reads date range constraints from a zod schema
 *
 * @param schema - The zod schema
 * @returns The date constraints (inclusive and exclusive min/max)
 */
export function dateConstraints(schema: z.ZodType): DateConstraints {
  let min: number | undefined;
  let max: number | undefined;
  let exclusiveMin: number | undefined;
  let exclusiveMax: number | undefined;

  for (const def of readChecks(schema)) {
    const time = toTime(def.value);
    if (time === undefined) continue;
    if (def.check === 'greater_than') {
      if (def.inclusive) {
        min = min === undefined ? time : Math.max(min, time);
      } else {
        exclusiveMin =
          exclusiveMin === undefined ? time : Math.max(exclusiveMin, time);
      }
    } else if (def.check === 'less_than') {
      if (def.inclusive) {
        max = max === undefined ? time : Math.min(max, time);
      } else {
        exclusiveMax =
          exclusiveMax === undefined ? time : Math.min(exclusiveMax, time);
      }
    }
  }

  return {
    min: min === undefined ? undefined : new Date(min),
    max: max === undefined ? undefined : new Date(max),
    exclusiveMin:
      exclusiveMin === undefined ? undefined : new Date(exclusiveMin),
    exclusiveMax:
      exclusiveMax === undefined ? undefined : new Date(exclusiveMax),
  };
}

/** array: length constraints */
export interface ArrayConstraints {
  minLength?: number;
  maxLength?: number;
}

/**
 * Reads array length constraints from a zod schema
 *
 * @param schema - The zod schema
 * @returns The array constraints (min/max length)
 */
export function arrayConstraints(schema: z.ZodType): ArrayConstraints {
  const checks = readChecks(schema);
  return {
    minLength: boundFromChecks(checks, 'min_length', 'minimum'),
    maxLength: boundFromChecks(checks, 'max_length', 'maximum'),
  };
}

/** map/set/file: size constraints */
export interface SizeConstraints {
  minSize?: number;
  maxSize?: number;
}

/**
 * Reads collection size constraints (`min_size` / `max_size`) from a schema
 *
 * @param schema - The zod schema
 * @returns The size constraints (min/max size)
 */
export function sizeConstraints(schema: z.ZodType): SizeConstraints {
  const checks = readChecks(schema);
  return {
    minSize: boundFromChecks(checks, 'min_size', 'minimum'),
    maxSize: boundFromChecks(checks, 'max_size', 'maximum'),
  };
}

/**
 * Reads the accepted MIME types of a `z.file()` schema
 *
 * @param schema - The file schema
 * @returns The accepted MIME types (empty when unconstrained)
 */
export function fileMimeTypes(schema: z.ZodType): readonly string[] {
  for (const def of readChecks(schema)) {
    if (def.check === 'mime_type' && Array.isArray(def.mime)) {
      return def.mime;
    }
  }
  return [];
}
