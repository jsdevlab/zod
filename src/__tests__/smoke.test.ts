import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';

import { create, mock } from '../index';

/**
 * Schemas whose output type can also be validated as input.
 * Transform/codec schemas are covered separately because their output is not
 * a valid input for the same schema.
 */
const schemas = {
  string: z.string().min(3).max(12),
  email: z.email(),
  uuid: z.uuid(),
  uuidv6: z.uuidv6(),
  uuidv7: z.uuidv7(),
  guid: z.guid(),
  url: z.url(),
  httpUrl: z.httpUrl(),
  hostname: z.hostname(),
  emoji: z.emoji(),
  number: z.int().min(1).max(100),
  float32: z.float32(),
  float64: z.float64(),
  bigint: z.bigint(),
  boolean: z.boolean(),
  date: z.date(),
  symbol: z.symbol(),
  enum: z.enum(['a', 'b', 'c']),
  enumObject: z.enum({ X: 'x', Y: 'y' }),
  literal: z.literal('fixed'),
  object: z.object({ id: z.string(), role: z.enum(['admin', 'user']) }),
  strictObject: z.strictObject({
    id: z.string(),
    role: z.enum(['admin', 'user']),
  }),
  array: z.array(z.number().min(0).max(9)),
  tuple: z.tuple([z.string(), z.number()]),
  record: z.record(z.string(), z.number()),
  enumRecord: z.record(z.enum(['a', 'b']), z.number()),
  partialRecord: z.partialRecord(z.enum(['a', 'b']), z.number()),
  map: z.map(z.string(), z.number()),
  set: z.set(z.string()),
  union: z.union([z.string(), z.number()]),
  du: z.discriminatedUnion('t', [
    z.object({ t: z.literal('a'), v: z.string() }),
    z.object({ t: z.literal('b'), v: z.number() }),
  ]),
  intersection: z.intersection(
    z.object({ a: z.string() }),
    z.object({ b: z.number() }),
  ),
  optional: z.string().optional(),
  nullable: z.string().nullable(),
  default: z.string().default('d'),
  catch: z.string().catch('c'),
  readonly: z.object({ x: z.number() }).readonly(),
  lazy: z.lazy(() => z.object({ self: z.string() })),
  promise: z.promise(z.number()),
  any: z.any(),
  unknown: z.unknown(),
  void_: z.void(),
  null_: z.null(),
  undefined_: z.undefined(),
  nan: z.nan(),
  base64: z.base64(),
  base64url: z.base64url(),
  exactOptional: z.exactOptional(z.string()),
  nonoptional: z.nonoptional(z.string().optional()),
  prefault: z.prefault(z.string(), 'pf'),
  preprocess: z.preprocess((v) => v, z.number()),
  templateLiteral: z.templateLiteral(['pre-', z.string(), '-post']),
  file: z.file(),
  cuid2: z.cuid2(),
  ksuid: z.ksuid(),
  xid: z.xid(),
  ulid: z.ulid(),
  nanoid: z.nanoid(),
  e164: z.e164(),
  ipv4: z.ipv4(),
  ipv6: z.ipv6(),
  mac: z.mac(),
  jwt: z.jwt(),
  creditCard: z.creditCard(),
  iban: z.iban(),
  sha256: z.hash('sha256'),
  sha256Base64: z.hash('sha256', { enc: 'base64' }),
  isoDate: z.iso.date(),
  isoTime: z.iso.time(),
  isoTimePrecision: z.iso.time({ precision: 3 }),
  isoDateTime: z.iso.datetime(),
  isoDateTimePrecision: z.iso.datetime({ precision: 3 }),
  isoDuration: z.iso.duration(),
};

/** Async schemas such as promise: sync parse throws (zod 4) → fall back to async validation */
async function assertValid(schema: z.ZodType, value: unknown): Promise<void> {
  let res: { success: boolean };
  try {
    res = schema.safeParse(value);
  } catch {
    const r = await schema.safeParseAsync(value);
    expect(r.success).toBe(true);
    return;
  }
  if (res.success) return;
  const r = await schema.safeParseAsync(value);
  expect(r.success).toBe(true);
}

describe('smoke: create', () => {
  for (const [name, schema] of Object.entries(schemas)) {
    it(`create(${name}) parses`, () => {
      return assertValid(schema, create(schema));
    });
  }
});

describe('smoke: mock', () => {
  for (const [name, schema] of Object.entries(schemas)) {
    it(`mock(${name}) parses`, () => {
      return assertValid(schema, mock(schema, { seed: 42 }));
    });
  }
});

describe('smoke: transformed outputs', () => {
  it('returns the transform output, not the input value', () => {
    const pipe = z.string().transform((s) => s.length);
    expect(create(pipe)).toBe(0);
    expect(mock(pipe, { seed: 42 })).toBeTypeOf('number');
  });

  it('rejects async transforms with a clear error', () => {
    const pipe = z.string().transform(async (s) => s.length);
    expect(() => mock(pipe, { seed: 42 })).toThrow(/Async transforms/);
  });

  it('supports codecs and stringbool', () => {
    const stringbool = z.stringbool();
    expect(create(stringbool)).toBe(false);
    expect(mock(stringbool, { seed: 42 })).toBeTypeOf('boolean');

    const codec = z.codec(z.string(), z.number(), {
      decode: (s) => Number(s),
      encode: (n) => String(n),
    });
    expect(mock(codec, { seed: 42 })).toBeTypeOf('number');
    expect(codec.safeParse('1').success).toBe(true);
  });

  it('generates raw input for nested codecs and pipes', () => {
    const codec = z.codec(z.string(), z.number(), {
      decode: (s) => s.length,
      encode: (n) => String(n),
    });
    const withCodec = z.object({ n: codec }).transform((value) => value.n * 2);
    expect(create(withCodec)).toBe(0);
    expect(mock(withCodec, { seed: 42 })).toBeTypeOf('number');

    const withPipe = z
      .object({ n: z.string().transform((s) => s.length) })
      .transform((value) => value.n + 1);
    expect(create(withPipe)).toBe(1);
    expect(mock(withPipe, { seed: 42 })).toBeTypeOf('number');
  });

  it('rejects bare z.transform() schemas', () => {
    expect(() => create(z.transform((v) => v))).toThrow(/no input schema/);
  });
});
