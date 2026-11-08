# @jsdevlab/zod

Generate **initial values** and **reproducible mock data** from [zod 4](https://zod.dev) schemas. Every call returns `z.output<T>`, fully inferred from the schema.

English | [简体中文](./README.zh-CN.md)

## Features

- **Two modes**: `create` for deterministic form initial values, `mock` for seeded random fixtures.
- **Type-safe end to end**: the return type is `z.output<T>`, including transforms, codecs and defaults.
- **Constraint-aware**: respects string formats/lengths, numeric ranges, exclusive bounds, `multipleOf`, integer formats, date ranges, collection sizes and file size/MIME checks.
- **Reproducible**: the same seed produces the same mock value; `create` is deterministic by default.
- **Customizable**: override generated fields with `defaults`, or register custom generators by schema instance or schema class.
- **Universal builds**: ESM and CJS outputs with matching `.d.ts` / `.d.cts` declarations, tested in both Node.js and a browser-like DOM environment.
- **Zod 4 current APIs**: works with the modern `z.email()`, `z.uuid()`, `z.iso.*()`, `z.int()`, `z.enum()` APIs and reads constraints through zod's public accessors plus `schema.def.checks` (no dependency on the legacy `_zod.bag`).

## Requirements

- Node.js `>=24.19.0 <27.0.0` (the same range is enforced via `devEngines`)
- Modern browsers with ES2022 support
- `zod ^4.6.7` as a peer dependency

## Install

```bash
# pnpm
pnpm add @jsdevlab/zod zod

# npm
npm install @jsdevlab/zod zod

# yarn
yarn add @jsdevlab/zod zod

# bun
bun add @jsdevlab/zod zod
```

## Quick start

```ts
import { z } from 'zod';
import { create, mock } from '@jsdevlab/zod';

const userSchema = z.object({
  name: z.string(),
  email: z.email(),
  role: z.enum(['admin', 'user']).default('user'),
  page: z.number().min(1).default(1),
  tags: z.array(z.string()),
});

// Form initial values: deterministic, respects defaults
const initial = create(userSchema);
// {
//   name: '',
//   email: 'Johnathon_Kertzmann@hotmail.com',
//   role: 'user',
//   page: 1,
//   tags: [],
// }

// Test/demo fixtures: random, constrained, reproducible with a seed
const fixture = mock(userSchema, { seed: 42 });
// {
//   name: 'XMFiidTFKb',
//   email: 'Collin.Leffler@yahoo.com',
//   role: 'user',
//   page: 1,
//   tags: ['ptxOkAE', 'FidXY', ...],
// }

// Return type is z.output<T>
const name: string = initial.name;

// Override any field with compile-time checked defaults
const draft = create(userSchema, {
  defaults: { name: 'Alice', role: 'admin' },
});
// { name: 'Alice', email: 'Johnathon_Kertzmann@hotmail.com', role: 'admin', ... }
```

> The exact faker strings shown above depend on the installed faker version; the shape and type are what matter.

## API

### `create(schema, options?)`

Generates deterministic initial data: `''`, `0`, `false`, `[]`, empty collections, `undefined` for optional fields, `null` for nullable fields, and schema defaults where present. Minimum length/size/range constraints are respected, so generated initial data stays valid.

```ts
const form = create(
  z.object({
    name: z.string().min(2), // 'aa'
    age: z.int().min(18), // 18
    tags: z.array(z.string()).min(1), // ['']
  }),
);
```

### `mock(schema, options?)`

Generates random mock data. Strings use [faker](https://fakerjs.dev) with format-aware generation; values respect the schema constraints, and results are reproducible for a given `seed`.

```ts
const fixture = mock(userSchema, { seed: 7 });
const same = mock(userSchema, { seed: 7 }); // identical to fixture
```

### Signatures

```ts
function create<T extends z.ZodType>(
  schema: T,
  options?: GenerateOptions<T>,
): z.output<T>;

function mock<T extends z.ZodType>(
  schema: T,
  options?: GenerateOptions<T>,
): z.output<T>;

interface GenerateOptions<T extends z.ZodType> extends MockOptions {
  defaults?: DeepPartial<z.output<T>>;
}
```

### Options

| Option           | Type                                      | Default   | Description                                                                                                              |
| ---------------- | ----------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `seed`           | `number`                                  | —         | Mock seed. Omitted: a new random seed per call. Same seed + same schema = same result. `create` is always deterministic. |
| `recursionLimit` | `number`                                  | `10`      | Maximum recursion depth for lazy self-references; exceeding it throws.                                                   |
| `generators`     | `GeneratorDefinition[]`                   | `[]`      | Custom generators; matched by schema instance first, then by schema class. Take precedence over built-ins.               |
| `array`          | `{ min?: number; max?: number }`          | `{}`      | Array length range, clamped by the schema's `min`/`max`.                                                                 |
| `record`         | `{ min?: number; max?: number }`          | `{}`      | Record entry count range.                                                                                                |
| `map`            | `{ min?: number; max?: number }`          | `{}`      | Map size range, clamped by the schema's size checks.                                                                     |
| `set`            | `{ min?: number; max?: number }`          | `{}`      | Set size range, clamped by the schema's size checks.                                                                     |
| `optional`       | `{ chance?: number }`                     | `0.3`     | Probability that an optional field is `undefined` in mock mode.                                                          |
| `nullable`       | `{ chance?: number }`                     | `0.3`     | Probability that a nullable field is `null` in mock mode.                                                                |
| `useDefault`     | `boolean`                                 | `true`    | Prefer `.default()` / `.prefault()` values.                                                                              |
| `unhandled`      | `'throw' \| 'skip'`                       | `'throw'` | Behavior for schemas that cannot be generated (`z.custom()`, `z.xor()`, ...).                                            |
| `date`           | `{ min?: Date; max?: Date }`              | `{}`      | Date generation range; intersected with schema constraints.                                                              |
| `string`         | `{ length?: number \| [number, number] }` | `{}`      | String length; overrides the schema's own length constraints.                                                            |

### `defaults`

`defaults` is a deep partial of `z.output<T>`, checked at compile time, and is deep-merged into the generated result:

```ts
const schema = z.object({
  profile: z.object({ name: z.string(), age: z.number() }),
  tags: z.array(z.string()),
});

const value = create(schema, {
  defaults: { profile: { name: 'Alice' } },
});
// { profile: { name: 'Alice', age: 0 }, tags: [] }
```

Arrays are replaced wholesale rather than merged element by element. `defaults` is also the fallback source for schemas that cannot be generated (`z.custom()`, `z.xor()`), looked up by the current field path.

### Custom generators

```ts
const emailSchema = z.email();
const schema = z.object({ email: emailSchema });

const value = mock(schema, {
  generators: [
    // Instance match: only this exact schema instance
    { schema: emailSchema, generator: () => 'alice@example.com' },
    // Class match: every z.ZodNumber
    { schema: z.ZodNumber, generator: () => 42 },
  ],
});
```

A generator receives `(schema, context)`, where `context` exposes the generation mode, seeded PRNG, current path and normalized options.

## Behavior

### `create` vs `mock`

| Aspect              | `create`                                | `mock`                                  |
| ------------------- | --------------------------------------- | --------------------------------------- |
| Purpose             | Form initial values / empty objects     | Test data / demos                       |
| Determinism         | Always deterministic                    | Seeded; omitted seed = random each call |
| Strings             | `''` or a minimal valid value by format | Faker-generated, format-aware           |
| Numbers             | Closest valid value to `0`              | Random within constraints               |
| Collections         | Minimum required size                   | Random size within constraints/options  |
| Optional / nullable | `undefined` / `null`                    | Chance-based (`optional` / `nullable`)  |
| Defaults            | Used                                    | Used unless `useDefault: false`         |

### Constraints

- **string**: `min`/`max`/`length`, `startsWith`/`endsWith`/`includes`, `lowercase`/`uppercase`, and named formats (see below).
- **number**: `min`/`max`, `gt`/`gte`/`lt`/`lte`, `positive`/`negative` (via `gt`/`lt`), `multipleOf`, integer formats (`z.int()`, `.int()`, `z.int32()`, `z.uint32()`).
- **bigint**: `min`/`max`, exclusive bounds and `multipleOf`.
- **date**: `min`/`max` and exclusive checks when present.
- **array / set / map**: `min`/`max`/`length`/`size` and `nonempty()`.
- **record**: enum/literal keys require every key unless `z.partialRecord()` is used.
- **file**: `min`/`max` byte size and `mime()`.
- **object/tuple/wrappers/union/intersection/lazy/promise**: generated recursively.

> String checks that cannot be synthesized (`regex()`, `refine()`, custom string transforms) are not enforced by generation. Use `defaults` or a custom generator when those matter.

### Supported formats

String formats are generated with valid values: `email`, `url`/`httpUrl`, `hostname`, `emoji`, `guid`, `uuid` (and `uuidv4`/`uuidv6`/`uuidv7`), `nanoid`, `cuid2` (legacy `cuid` still generated for compatibility), `ulid`, `xid`, `ksuid`, `ipv4`, `ipv6`, `mac`, `cidrv4`, `cidrv6`, `base64`, `base64url`, `e164`, `jwt`, `credit_card`, `iban`, `hex`, `md5`/`sha1`/`sha256`/`sha384`/`sha512` hashes in `hex`, `base64` and `base64url` encodings, and `z.iso.date()` / `z.iso.time()` / `z.iso.datetime()` / `z.iso.duration()` (including precision options).

### Transforms, pipes and codecs

- `z.string().transform(...)` and `input.pipe(output)` return the **output** of the pipeline, not the input value.
- `z.codec()` and `z.stringbool()` generate a value on the output side directly.
- A bare `z.transform()` has no input schema and throws.
- Async transforms cannot be resolved synchronously and throw; use `defaults` or a custom generator for those schemas.

### Recursion

`z.lazy()` self-references are tracked by schema instance. Increase `recursionLimit` for deeper trees, or lower `optional.chance` so recursive branches terminate earlier.

### Reproducibility

`create` pins the seed; `mock` accepts `seed`. Faker's global seed is reset on every call, so results are stable for the same schema, seed and options. Generation is synchronous, so concurrent calls do not interleave.

## Supported zod types

| Category     | Types                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Primitives   | `string` / `number` (incl. `z.int()`, `z.int32()`, `z.uint32()`, `z.float32()`, `z.float64()`) / `bigint` / `boolean` / `date` / `symbol` |
| Literals     | `literal` / `enum` (strings and TS enum objects) / `null` / `undefined` / `void` / `NaN` / `never` (throws)                               |
| Unstructured | `any` / `unknown`                                                                                                                         |
| Objects      | `object` / `strictObject` / `looseObject`                                                                                                 |
| Containers   | `array` / `tuple` (incl. rest) / `record` (incl. `partialRecord`) / `map` / `set` / `file`                                                |
| Composites   | `union` / `discriminatedUnion` / `intersection`                                                                                           |
| Wrappers     | `optional` / `exactOptional` / `nullable` / `default` / `prefault` / `catch` / `readonly` / `nonoptional` / `lazy`                        |
| Transforms   | `pipe` / `preprocess` / `transform` (inside a pipe) / `codec` / `stringbool`                                                              |
| Async        | `promise`                                                                                                                                 |
| Special      | `templateLiteral` / `file`                                                                                                                |

Not generatable: `z.custom()`, `z.xor()`, bare `z.transform()`, `z.function()`. Provide `defaults`, a custom generator, or use `unhandled: 'skip'`.

## Migrating from deprecated zod APIs

The library works with the current zod 4 APIs; deprecated APIs are not required. Prefer the right-hand column:

| Deprecated                             | Current                         |
| -------------------------------------- | ------------------------------- |
| `z.string().email()`                   | `z.email()`                     |
| `z.string().url()`                     | `z.url()`                       |
| `z.string().uuid()`                    | `z.uuid()` / `z.uuidv4()`       |
| `z.string().datetime()`                | `z.iso.datetime()`              |
| `z.string().date()` / `.time()`        | `z.iso.date()` / `z.iso.time()` |
| `z.string().duration()`                | `z.iso.duration()`              |
| `z.string().ipv4()` / `.ipv6()`        | `z.ipv4()` / `z.ipv6()`         |
| `z.string().cidrv4()` / `.cidrv6()`    | `z.cidrv4()` / `z.cidrv6()`     |
| `z.string().base64()` / `.base64url()` | `z.base64()` / `z.base64url()`  |
| `z.string().cuid()`                    | `z.cuid2()`                     |
| `z.string().ulid()` / `.nanoid()`      | `z.ulid()` / `z.nanoid()`       |
| `z.string().e164()` / `.jwt()`         | `z.e164()` / `z.jwt()`          |
| `z.nativeEnum(E)`                      | `z.enum(E)`                     |
| `z.number().safe()`                    | `z.number().int()` / `z.int()`  |
| `z.number().step(n)`                   | `z.number().multipleOf(n)`      |

## Development

```bash
pnpm install
pnpm build          # ESM + CJS + declaration files
pnpm test           # type-level tests + unit tests (Node + browser)
pnpm test:types     # type-level tests only
pnpm test:unit      # unit tests in both projects
pnpm test:node      # Node.js test project only
pnpm test:browser   # happy-dom browser test project only
pnpm coverage       # coverage with enforced thresholds
pnpm check          # Biome lint/format check (read-only)
pnpm check:write    # Biome lint/format with fixes
```

Coverage thresholds: statements 85%, branches 70%, functions 90%, lines 85%. Current: statements 87.7%, branches 74.5%, functions 96.3%, lines 90.7%.

## License

[MIT](./LICENSE.txt)
