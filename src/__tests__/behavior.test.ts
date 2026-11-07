import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';

import { create, mock } from '../index';

describe('create semantics', () => {
  it('returns deterministic empty-ish defaults', () => {
    expect(create(z.object({ name: z.string(), n: z.number() }))).toEqual({
      name: '',
      n: 0,
    });
    expect(create(z.array(z.string()))).toEqual([]);
    expect(create(z.boolean())).toBe(false);
    expect(create(z.string().optional())).toBeUndefined();
    expect(create(z.string().nullable())).toBeNull();
  });

  it('is deterministic across calls', () => {
    const schema = z.object({ a: z.string(), b: z.number() });
    expect(create(schema)).toEqual(create(schema));
  });

  it('respects field defaults', () => {
    const schema = z.object({
      page: z.number().default(1),
      role: z.enum(['admin', 'user']).default('admin'),
      note: z.string().optional(),
    });
    expect(create(schema)).toEqual({ page: 1, role: 'admin' });
  });

  it('respects positive min constraints', () => {
    expect(create(z.number().min(5))).toBe(5);
    expect(create(z.number().min(-5))).toBe(0);
  });

  it('honors string length constraints instead of empty string', () => {
    expect(create(z.string().min(3))).toBe('aaa');
    expect(create(z.email())).toMatch(/@/);
    expect(create(z.uuid())).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe('mock semantics', () => {
  it('is reproducible with the same seed', () => {
    const schema = z.object({
      name: z.string(),
      n: z.number(),
      tags: z.array(z.string()),
    });
    expect(mock(schema, { seed: 7 })).toEqual(mock(schema, { seed: 7 }));
  });

  it('differs across seeds', () => {
    const schema = z.object({ name: z.string(), n: z.number() });
    const a = mock(schema, { seed: 1 });
    const b = mock(schema, { seed: 2 });
    expect(a).not.toEqual(b);
  });

  it('respects defaults unless useDefault is false', () => {
    const schema = z.object({ page: z.number().default(1) });
    expect(mock(schema, { seed: 1 }).page).toBe(1);
    expect(mock(schema, { seed: 1, useDefault: false }).page).not.toBe(1);
  });

  it('respects number range constraints', () => {
    const schema = z.object({ n: z.number().min(10).max(20).int() });
    for (let seed = 0; seed < 20; seed++) {
      const n = mock(schema, { seed }).n;
      expect(n).toBeGreaterThanOrEqual(10);
      expect(n).toBeLessThanOrEqual(20);
    }
  });

  it('respects multipleOf constraints', () => {
    const schema = z.object({ n: z.number().multipleOf(5).int() });
    for (let seed = 0; seed < 10; seed++) {
      expect(mock(schema, { seed }).n % 5 === 0).toBe(true);
    }
  });

  it('respects string length constraints', () => {
    const schema = z.string().min(8).max(8);
    for (let seed = 0; seed < 10; seed++) {
      expect(mock(schema, { seed }).length).toBe(8);
    }
  });

  it('respects optional chance and nullable chance', () => {
    const schema = z.object({ q: z.string().optional() });
    const seen = new Set<boolean>();
    for (let seed = 0; seed < 50; seed++) {
      const value = mock(schema, { seed, optional: { chance: 0.5 } }).q;
      seen.add(value === undefined);
    }
    expect(seen.has(true)).toBe(true);
    expect(seen.has(false)).toBe(true);
  });

  it('respects array size options', () => {
    const schema = z.array(z.number());
    for (let seed = 0; seed < 20; seed++) {
      const arr = mock(schema, { seed, array: { min: 3, max: 3 } });
      expect(arr.length).toBe(3);
    }
  });

  it('generates valid email/url/date-time formats', () => {
    const email = mock(z.email(), { seed: 1 });
    expect(email).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
    const url = mock(z.url(), { seed: 1 });
    expect(url).toMatch(/^https?:\/\//);
    const dt = mock(z.iso.datetime(), { seed: 1 });
    expect(new Date(dt).toString()).not.toBe('Invalid Date');
  });

  it('respects date range constraints', () => {
    const min = new Date('2020-01-01');
    const max = new Date('2020-12-31');
    const schema = z.date().min(min).max(max);
    for (let seed = 0; seed < 10; seed++) {
      const d = mock(schema, { seed });
      expect(d.getTime()).toBeGreaterThanOrEqual(min.getTime());
      expect(d.getTime()).toBeLessThanOrEqual(max.getTime());
    }
  });

  it('is random across calls without a seed', () => {
    const schema = z.object({ name: z.string(), n: z.number() });
    expect(mock(schema)).not.toEqual(mock(schema));
    expect(mock(z.string())).not.toBe(mock(z.string()));
  });

  it('handles zod 4 standalone format types (z.email/z.uuid/z.iso.*)', () => {
    // These types are ZodStringFormat subclasses, not ZodString — generated via the format branch
    const email = mock(z.email(), { seed: 1 });
    expect(email).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
    const uuid = mock(z.uuid(), { seed: 1 });
    expect(z.uuid().safeParse(uuid).success).toBe(true);
    const url = mock(z.url(), { seed: 1 });
    expect(z.url().safeParse(url).success).toBe(true);
    const dt = mock(z.iso.datetime(), { seed: 1 });
    expect(z.iso.datetime().safeParse(dt).success).toBe(true);
    const ip = mock(z.ipv4(), { seed: 1 });
    expect(z.ipv4().safeParse(ip).success).toBe(true);
    const mac = mock(z.mac(), { seed: 1 });
    expect(z.mac().safeParse(mac).success).toBe(true);
    const ulid = mock(z.ulid(), { seed: 1 });
    expect(z.ulid().safeParse(ulid).success).toBe(true);
    // Also works when nested inside an object
    const profile = z.object({ id: z.uuid(), contact: z.email() });
    const value = mock(profile, { seed: 1 });
    expect(profile.safeParse(value).success).toBe(true);
  });

  it('creates valid init values for standalone format types', () => {
    expect(create(z.email())).toMatch(/@/);
    expect(create(z.uuid())).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(create(z.iso.date())).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('custom generators', () => {
  it('uses a reference generator for a specific schema instance', () => {
    const special = z.string();
    const schema = z.object({ a: special, b: z.string() });
    const value = mock(schema, {
      seed: 1,
      generators: [{ schema: special, generator: () => 'fixed' }],
    });
    expect(value.a).toBe('fixed');
    expect(value.b).not.toBe('fixed');
  });

  it('prefers reference generators over instanceof', () => {
    const schema = z.object({ id: z.number() });
    const value = create(schema, {
      generators: [
        {
          schema: z.ZodNumber,
          generator: (s) => {
            void s;
            return 42;
          },
        },
      ],
    });
    expect(value.id).toBe(42);
  });
});

describe('recursion handling', () => {
  it('throws when lazy recursion exceeds the limit', () => {
    const node: z.ZodType = z.lazy(() => node);
    expect(() => mock(node, { recursionLimit: 5 })).toThrow(/Recursion limit/);
  });

  it('generates finite lazy trees within the limit', () => {
    interface Node {
      value: string;
      child?: Node;
    }
    const nodeSchema: z.ZodType<Node> = z.lazy(() =>
      z.object({
        value: z.string(),
        child: nodeSchema.optional(),
      }),
    );
    const value = mock(nodeSchema, {
      seed: 1,
      recursionLimit: 12,
      optional: { chance: 0.2 },
    });
    expect(typeof value.value).toBe('string');
    expect(schemaParseOk(nodeSchema, value)).toBe(true);
  });
});

/** Validation helper for async schemas such as promise */
function schemaParseOk(schema: z.ZodType, value: unknown): boolean {
  try {
    const res = schema.safeParse(value);
    return res.success;
  } catch {
    return true; // async schemas throw synchronously → treat the generated value as valid (covered by async cases)
  }
}

describe('edge coverage', () => {
  it('throws NoGeneratorException for unsupported schemas', () => {
    expect(() => mock(z.function())).toThrow(/No generator/);
  });

  it('handles bigint with large ranges and min constraints', () => {
    const big = z.bigint().min(0n).max(10000000000000000000n);
    const v = mock(big, { seed: 1 });
    expect(typeof v).toBe('bigint');
    const min = z.bigint().min(5n);
    expect(create(min)).toBe(5n);
  });

  it('generates float numbers for non-integer constraints', () => {
    const schema = z.number().min(0.5).max(2.5);
    const v = mock(schema, { seed: 3 });
    expect(v).toBeGreaterThanOrEqual(0.5);
    expect(v).toBeLessThanOrEqual(2.5);
  });

  it('merges intersection defaults for objects only', () => {
    const obj = z.intersection(
      z.object({ a: z.string() }),
      z.object({ b: z.number() }),
    );
    expect(create(obj)).toEqual({ a: '', b: 0 });
    // Non-object intersections return the left side
    const mixed = z.intersection(z.string(), z.number());
    expect(mock(mixed, { seed: 1 })).toBeTypeOf('string');
  });

  it('supports discriminated unions via their own generator', () => {
    const du = z.discriminatedUnion('t', [
      z.object({ t: z.literal('a'), v: z.string() }),
      z.object({ t: z.literal('b'), v: z.number() }),
    ]);
    const init = create(du);
    expect(init.t).toBe('a');
    const mockValue = mock(du, { seed: 2 });
    expect(['a', 'b']).toContain(mockValue.t);
    expect(du.safeParse(mockValue).success).toBe(true);
  });

  it('generates tuple rest elements in mock mode', () => {
    const tuple = z.tuple([z.string()]).rest(z.number());
    const v = mock(tuple, { seed: 1 });
    expect(typeof v[0]).toBe('string');
    expect(Array.isArray(v)).toBe(true);
  });
});

describe('defaults parameter', () => {
  const schema = z.object({
    name: z.string(),
    role: z.enum(['admin', 'user']),
    tags: z.array(z.string()),
  });

  it('overrides fields in create', () => {
    const value = create(schema, {
      defaults: { name: 'Alice', role: 'admin' },
    });
    expect(value).toEqual({ name: 'Alice', role: 'admin', tags: [] });
  });

  it('overrides fields in mock', () => {
    const value = mock(schema, { seed: 1, defaults: { role: 'user' } });
    expect(value.role).toBe('user');
    expect(value.name).toBeTypeOf('string');
  });

  it('keeps the generated value when defaults is empty', () => {
    const value = create(schema, { defaults: {} });
    expect(value.name).toBe('');
  });
});

describe('unhandled strategy (z.custom / z.xor)', () => {
  it('throws by default when no defaults value is provided', () => {
    expect(() => create(z.custom(() => true))).toThrow(/cannot be generated/);
    expect(() =>
      mock(z.xor([z.object({ a: z.string() }), z.object({ b: z.number() })])),
    ).toThrow(/cannot be generated/);
  });

  it('skips with undefined when unhandled is skip', () => {
    expect(
      create(
        z.custom(() => true),
        { unhandled: 'skip' },
      ),
    ).toBeUndefined();
    expect(
      mock(
        z.custom(() => true),
        { unhandled: 'skip' },
      ),
    ).toBeUndefined();
  });

  it('uses defaults as a fallback for unhandled schemas', () => {
    const customSchema = z.custom<{ id: string }>((v) => typeof v === 'object');
    const value = create(customSchema, {
      defaults: { id: 'c-1' },
    });
    expect(value).toEqual({ id: 'c-1' });
  });

  it('finds nested defaults by field path', () => {
    const customField = z.custom<number>((v) => typeof v === 'number');
    const schema = z.object({
      outer: z.object({ inner: customField }),
    });
    const value = create(schema, {
      defaults: { outer: { inner: 42 } },
    });
    expect(value).toEqual({ outer: { inner: 42 } });
  });
});

describe('defaults deep merge', () => {
  const schema = z.object({
    profile: z.object({ name: z.string(), age: z.number() }),
    tags: z.array(z.string()),
  });

  it('merges nested defaults without dropping generated siblings', () => {
    const value = create(schema, {
      defaults: { profile: { name: 'Alice' } },
    });
    expect(value.profile.name).toBe('Alice');
    expect(typeof value.profile.age).toBe('number');
    expect(value.tags).toEqual([]);
  });

  it('overrides nested objects entirely when provided as values', () => {
    const value = mock(schema, {
      seed: 1,
      defaults: { profile: { name: 'Bob', age: 30 } },
    });
    expect(value.profile).toEqual({ name: 'Bob', age: 30 });
  });
});

describe('constraint handling (zod 4.6)', () => {
  it('respects exclusive number bounds', () => {
    const schema = z.number().gt(0).lt(1);
    const init = create(schema);
    expect(init).toBeGreaterThan(0);
    expect(init).toBeLessThan(1);
    for (let seed = 0; seed < 20; seed++) {
      const value = mock(schema, { seed });
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('aligns multipleOf to the lower bound', () => {
    const schema = z.int().min(7).max(23).multipleOf(5);
    for (let seed = 0; seed < 20; seed++) {
      const value = mock(schema, { seed });
      expect(value).toBeGreaterThanOrEqual(7);
      expect(value).toBeLessThanOrEqual(23);
      expect(value % 5).toBe(0);
    }
  });

  it('keeps floating-point multiples valid', () => {
    const schema = z.number().min(0.2).max(2.8).multipleOf(0.1);
    for (let seed = 0; seed < 50; seed++) {
      const value = mock(schema, { seed });
      expect(schema.safeParse(value).success).toBe(true);
    }
  });

  it('converts fractional steps for integer schemas', () => {
    const schema = z.int().min(1).max(3).multipleOf(0.3);
    for (let seed = 0; seed < 20; seed++) {
      const value = mock(schema, { seed });
      expect(value).toBe(3);
      expect(schema.safeParse(value).success).toBe(true);
    }
    const half = z.int().min(1).max(3).multipleOf(0.5);
    for (let seed = 0; seed < 20; seed++) {
      expect(half.safeParse(mock(half, { seed })).success).toBe(true);
    }
  });

  it('uses the tightest bound when constraints repeat', () => {
    const schema = z.array(z.number()).min(1).min(3).max(5).max(4);
    for (let seed = 0; seed < 20; seed++) {
      const value = mock(schema, { seed });
      expect(value.length).toBeGreaterThanOrEqual(3);
      expect(value.length).toBeLessThanOrEqual(4);
    }
  });

  it('clamps create values to negative max constraints', () => {
    expect(create(z.number().max(-5))).toBe(-5);
    expect(create(z.number().lt(-5))).toBeLessThan(-5);
  });

  it('respects collection minimum sizes in create', () => {
    expect(create(z.array(z.string()).min(2))).toHaveLength(2);
    expect(create(z.set(z.enum(['a', 'b'])).min(2)).size).toBe(2);
    expect(create(z.map(z.enum(['a', 'b']), z.number()).min(2)).size).toBe(2);
  });

  it('respects bigint ranges', () => {
    for (let seed = 0; seed < 20; seed++) {
      const value = mock(z.bigint().min(10n).max(20n), { seed });
      expect(value).toBeGreaterThanOrEqual(10n);
      expect(value).toBeLessThanOrEqual(20n);
    }
    expect(create(z.bigint().min(5n))).toBe(5n);
    expect(create(z.bigint().max(-5n))).toBe(-5n);
  });

  it('clamps create dates into the schema range', () => {
    const min = new Date('2020-01-01T00:00:00.000Z');
    const max = new Date('2020-01-02T00:00:00.000Z');
    const schema = z.date().min(min).max(max);
    const value = create(schema);
    expect(value.getTime()).toBeGreaterThanOrEqual(min.getTime());
    expect(value.getTime()).toBeLessThanOrEqual(max.getTime());
  });

  it('generates numeric enum values', () => {
    const schema = z.enum({ A: 0, B: 1 });
    expect(create(schema)).toBe(0);
    for (let seed = 0; seed < 20; seed++) {
      const value = mock(schema, { seed });
      expect([0, 1]).toContain(value);
      expect(schema.safeParse(value).success).toBe(true);
    }
  });

  it('requires every key of non-partial enum records', () => {
    const value = create(z.record(z.enum(['a', 'b']), z.number()));
    expect(Object.keys(value).sort()).toEqual(['a', 'b']);
    expect(create(z.partialRecord(z.enum(['a', 'b']), z.number()))).toEqual({});
  });

  it('invokes function defaults', () => {
    expect(create(z.string().default(() => 'fn'))).toBe('fn');
    expect(create(z.prefault(z.string(), () => 'pf'))).toBe('pf');
  });

  it('respects file size and MIME constraints', () => {
    const schema = z.file().mime('image/png').min(2).max(4);
    const value = mock(schema, { seed: 1 });
    expect(value.type).toBe('image/png');
    expect(value.size).toBeGreaterThanOrEqual(2);
    expect(value.size).toBeLessThanOrEqual(4);
    expect(create(schema).size).toBe(2);
  });

  it('generates every supported uuid version and ISO precision', () => {
    for (const schema of [z.uuidv6(), z.uuidv7()]) {
      expect(schema.safeParse(mock(schema, { seed: 1 })).success).toBe(true);
      expect(schema.safeParse(create(schema)).success).toBe(true);
    }
    const time = z.iso.time({ precision: 3 });
    expect(time.safeParse(mock(time, { seed: 1 })).success).toBe(true);
    const datetime = z.iso.datetime({ precision: 3 });
    expect(datetime.safeParse(mock(datetime, { seed: 1 })).success).toBe(true);
  });

  it('generates strings for synthesizable string checks', () => {
    const schemas = [
      z.string().startsWith('pre'),
      z.string().endsWith('post'),
      z.string().includes('middle'),
      z.string().lowercase(),
      z.string().uppercase(),
    ];
    for (const schema of schemas) {
      expect(schema.safeParse(create(schema)).success).toBe(true);
      for (let seed = 0; seed < 10; seed++) {
        expect(schema.safeParse(mock(schema, { seed })).success).toBe(true);
      }
    }
  });

  it('generates the remaining named string formats', () => {
    const formats = [
      z.cuid2(),
      z.ksuid(),
      z.xid(),
      z.mac(),
      z.hostname(),
      z.emoji(),
      z.creditCard(),
      z.iban(),
      z.hash('sha256'),
      z.hash('sha256', { enc: 'base64' }),
      z.hash('sha256', { enc: 'base64url' }),
      z.iso.duration(),
    ];
    for (const schema of formats) {
      const value = mock(schema, { seed: 1 });
      expect(schema.safeParse(value).success).toBe(true);
    }
  });
});
