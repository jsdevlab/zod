import { faker } from '@faker-js/faker';
import type { z } from 'zod';

import {
  type StringFormatOptions,
  stringConstraints,
  stringFormatOptions,
} from '../constraints';
import type { GenerationContext } from '../types';

const ALPHANUMERIC =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LOWERCASE_ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const HEX = '0123456789abcdef';
const BASE32 = '0123456789abcdefghijklmnopqrstuv';
const BASE64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64URL =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Byte length of the digests accepted by `z.hash()` */
const HASH_BYTES: Record<string, number> = {
  md5: 16,
  sha1: 20,
  sha256: 32,
  sha384: 48,
  sha512: 64,
};

/**
 * string generator: init returns '' (or the minimal valid value when
 * format/length constraints exist); mock uses faker to generate mock data by
 * format. Unknown formats fall back to a validation loop (generate candidate →
 * `safeParse` → retry), so a value always passes schema validation whenever a
 * candidate can be found.
 *
 * Reproducibility: faker's global seed is set in sync with the PRNG seed at
 * the `run()` entry point.
 *
 * @param schema - The string schema (ZodString or a ZodStringFormat subclass)
 * @param ctx - Generation context
 * @returns A string satisfying the schema constraints
 */
export const stringGenerator = (
  schema: z.ZodString | z.ZodStringFormat,
  ctx: GenerationContext,
): string => {
  const { format, minLength, maxLength } = stringConstraints(schema);
  const lengthRange = ctx.options.string.length;
  const min =
    lengthRange === undefined
      ? (minLength ?? 5)
      : Array.isArray(lengthRange)
        ? lengthRange[0]
        : lengthRange;
  const max =
    lengthRange === undefined
      ? (maxLength ?? 20)
      : Array.isArray(lengthRange)
        ? lengthRange[1]
        : lengthRange;

  if (ctx.mode === 'init') {
    if (format) return formatString(schema, format, ctx, min, max);
    if (minLength && minLength > 0) return 'a'.repeat(minLength);
    return '';
  }
  return format
    ? formatString(schema, format, ctx, min, max)
    : randomPlainString(min, max);
};

/**
 * Generate a candidate and validate: retry up to 20 times to ensure the
 * result passes schema validation
 *
 * @param schema - The string schema to validate candidates against
 * @param generate - Function producing a candidate string
 * @returns A candidate that passes schema validation
 */
function tryValid(
  schema: z.ZodString | z.ZodStringFormat,
  generate: () => string,
): string {
  for (let i = 0; i < 20; i++) {
    const value = generate();
    if (schema.safeParse(value).success) return value;
  }
  return generate();
}

/**
 * Build a UUID string for a specific version (faker only emits v4)
 *
 * @param version - The requested version (`v4`, `v6`, `v7`, ...)
 * @returns A syntactically valid UUID of that version
 */
function uuidForVersion(version?: string): string {
  const base = faker.string.uuid();
  if (!version) return base;
  const digit = version.startsWith('v') ? version.slice(1) : version;
  if (!/^[1-8]$/.test(digit)) return base;
  return `${base.slice(0, 14)}${digit}${base.slice(15)}`;
}

/**
 * Format a date as an ISO datetime with the requested fraction precision
 *
 * @param date - The date to format
 * @param precision - Exact fraction digits; -1 means minute precision, null any
 * @returns An ISO 8601 datetime string
 */
function isoDateTime(date: Date, precision?: number | null): string {
  const iso = date.toISOString();
  if (precision === undefined || precision === null) return iso;
  const minutes = iso.slice(0, 16);
  if (precision < 0) return `${minutes}Z`;
  const seconds = iso.slice(0, 19);
  if (precision === 0) return `${seconds}Z`;
  const millis = iso.slice(20, 23);
  const fraction = `${millis}${'0'.repeat(Math.max(0, precision - 3))}`.slice(
    0,
    precision,
  );
  return `${seconds}.${fraction}Z`;
}

/**
 * Format a date as an ISO time with the requested fraction precision
 *
 * @param date - The date to format
 * @param precision - Exact fraction digits; -1 means minute precision, null any
 * @returns An ISO 8601 time string
 */
function isoTime(date: Date, precision?: number | null): string {
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  if (precision === -1) return `${hours}:${minutes}`;
  const time = `${hours}:${minutes}:${seconds}`;
  if (precision === undefined || precision === null || precision === 0) {
    return time;
  }
  const millis = date.getUTCMilliseconds().toString().padStart(3, '0');
  const fraction = `${millis}${'0'.repeat(Math.max(0, precision - 3))}`.slice(
    0,
    precision,
  );
  return `${time}.${fraction}`;
}

/**
 * Build a random hash string for hashes of a known algorithm and encoding
 *
 * @param format - The hash format (`sha256_hex`, `md5_base64url`, ...)
 * @param ctx - Generation context
 * @returns A random hash of the correct length, or undefined when unknown
 */
function hashString(
  format: string,
  ctx: GenerationContext,
): string | undefined {
  const match = /^(md5|sha1|sha256|sha384|sha512)_(hex|base64|base64url)$/.exec(
    format,
  );
  if (!match) return undefined;
  const bytes = HASH_BYTES[match[1]];
  const encoding = match[2];
  if (encoding === 'hex') return ctx.random.string(bytes * 2, HEX);
  const encodedLength = Math.ceil(bytes / 3) * 4;
  const padding = (3 - (bytes % 3)) % 3;
  if (encoding === 'base64url') {
    return ctx.random.string(encodedLength - padding, BASE64URL);
  }
  return (
    ctx.random.string(encodedLength - padding, BASE64) + '='.repeat(padding)
  );
}

/**
 * Build a mock value for a named string format
 *
 * @param schema - The string format schema (for options and validation)
 * @param format - The format name
 * @param ctx - Generation context
 * @returns A string for the format
 */
function formatString(
  schema: z.ZodString | z.ZodStringFormat,
  format: string,
  ctx: GenerationContext,
  minLength: number,
  maxLength: number,
): string {
  const options: StringFormatOptions = stringFormatOptions(schema);
  const min = Math.max(0, Math.min(minLength, maxLength));
  const max = Math.max(min, maxLength);
  // Only formats that need a length consume a random value.
  const nextLength = (): number => ctx.random.int(min, max);
  const generate = (): string => {
    const hash = hashString(format, ctx);
    if (hash !== undefined) return hash;
    switch (format) {
      case 'includes': {
        const needle = options.includes ?? '';
        const total = Math.max(nextLength(), needle.length);
        const fill = total - needle.length;
        const left = ctx.random.int(0, fill);
        return randomFill(left, ctx) + needle + randomFill(fill - left, ctx);
      }
      case 'starts_with': {
        const prefix = options.prefix ?? '';
        return (
          prefix + randomFill(Math.max(0, nextLength() - prefix.length), ctx)
        );
      }
      case 'ends_with': {
        const suffix = options.suffix ?? '';
        return (
          randomFill(Math.max(0, nextLength() - suffix.length), ctx) + suffix
        );
      }
      case 'lowercase':
        return randomFill(nextLength(), ctx, 'lower');
      case 'uppercase':
        return randomFill(nextLength(), ctx, 'upper');
      case 'email':
        return faker.internet.email();
      case 'url':
        return faker.internet.url();
      case 'uuid':
        return uuidForVersion(options.version);
      case 'guid':
        return faker.string.uuid();
      case 'ip':
        return ctx.random.chance(0.5)
          ? faker.internet.ipv4()
          : faker.internet.ipv6();
      case 'ipv4':
        return faker.internet.ipv4();
      case 'ipv6':
        return faker.internet.ipv6();
      case 'mac':
        return faker.internet.mac().toLowerCase();
      case 'hostname':
        return faker.internet.domainName();
      case 'hex':
        return ctx.random.string(ctx.random.int(8, 32), HEX);
      case 'cidr':
      case 'cidrv4':
        return `${faker.internet.ipv4()}/${ctx.random.int(8, 30)}`;
      case 'cidrv6':
        return `${faker.internet.ipv6()}/${ctx.random.int(8, 128)}`;
      case 'date-time':
      case 'datetime':
      case 'iso-datetime':
        return isoDateTime(randomDate(ctx), options.precision);
      case 'date':
      case 'iso-date':
        return isoDateTime(randomDate(ctx), 0).slice(0, 10);
      case 'time':
      case 'iso-time':
        return isoTime(faker.date.anytime(), options.precision);
      case 'duration':
      case 'iso-duration':
        return `PT${ctx.random.int(1, 24)}H${ctx.random.int(0, 59)}M`;
      case 'emoji':
        return faker.internet.emoji();
      case 'base64':
        return toBase64(ctx.random.string(16, ALPHANUMERIC));
      case 'base64url':
        return toBase64Url(ctx.random.string(16, ALPHANUMERIC));
      case 'jwt':
        return `${toBase64Url(JSON.stringify({ alg: 'none' }))}.${toBase64Url(
          JSON.stringify({ sub: String(ctx.random.int(1, 9999)) }),
        )}.${toBase64Url(ctx.random.string(8, ALPHANUMERIC))}`;
      case 'ulid':
        return faker.string.ulid();
      case 'nanoid':
        return faker.string.nanoid();
      case 'e164':
        return `+${ctx.random.int(1, 9)}${Array.from({ length: 10 }, () =>
          ctx.random.int(0, 9),
        ).join('')}`;
      case 'cuid':
        // CUID v1 is deprecated by zod but kept for compatibility.
        return `c${faker.string.alpha({ length: 24, casing: 'lower' })}`;
      case 'cuid2':
        return `c${ctx.random.string(23, LOWERCASE_ALPHANUMERIC)}`;
      case 'ksuid':
        return ctx.random.string(27, ALPHANUMERIC);
      case 'xid':
        return ctx.random.string(20, BASE32);
      case 'credit_card':
        return faker.finance.creditCardNumber();
      case 'iban':
        return faker.finance.iban();
      default:
        return randomPlainString(5, 20);
    }
  };
  return tryValid(schema, generate);
}

/**
 * Random filler for string checks (includes / startsWith / endsWith / casing)
 *
 * @param length - The filler length
 * @param ctx - Generation context
 * @param casing - Character set to draw from
 * @returns A deterministic random filler
 */
function randomFill(
  length: number,
  ctx: GenerationContext,
  casing: 'mixed' | 'lower' | 'upper' = 'mixed',
): string {
  if (length <= 0) return '';
  const charset =
    casing === 'lower'
      ? LOWERCASE
      : casing === 'upper'
        ? UPPERCASE
        : ALPHANUMERIC;
  return ctx.random.string(length, charset);
}

/**
 * Random plain alphabetic string using faker
 *
 * @param min - The minimum length
 * @param max - The maximum length
 * @returns A random alphabetic string
 */
function randomPlainString(min: number, max: number): string {
  return faker.string.alpha({
    length: { min: Math.max(0, min), max: Math.max(min, max) },
  });
}

/**
 * Random date inside the configured date range
 *
 * @param ctx - Generation context
 * @returns A random Date
 */
function randomDate(ctx: GenerationContext): Date {
  const from = ctx.options.date.min ?? new Date('1970-01-01T00:00:00Z');
  const to = ctx.options.date.max ?? new Date('2100-01-01T00:00:00Z');
  return faker.date.between({
    from: from.getTime() <= to.getTime() ? from : to,
    to: from.getTime() <= to.getTime() ? to : from,
  });
}

/**
 * Encode a string as base64
 *
 * @param input - The string to encode
 * @returns The base64 representation
 */
function toBase64(input: string): string {
  return btoa(input);
}

/**
 * Encode a string as base64url (no padding)
 *
 * @param input - The string to encode
 * @returns The base64url representation
 */
function toBase64Url(input: string): string {
  return toBase64(input)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Zero-pad a number to two digits
 *
 * @param n - The number to pad
 * @returns The padded string
 */
function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
