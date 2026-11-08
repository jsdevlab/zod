# @jsdevlab/zod

Generate deterministic initial values (`create`) and reproducible mock data (`mock`, seeded) from zod 4 schemas. Every public API returns `z.output<T>`. The package name is `@jsdevlab/zod` (not `@zew-web/zod`), and the repo is a single-package pnpm project.

## Requirements

- Node.js `>=24.19.0 <27.0.0` for consumers and development (`engines` follows `devEngines`), or modern browsers with ES2022 support. Run commands from the repo root.
- Peer dependency: `zod ^4.6.7`. Runtime dependency: `@faker-js/faker`.

## Commands

| Command             | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `pnpm test`         | Type-level tests + unit tests in Node and browser projects |
| `pnpm test:node`    | Node.js test project only                                  |
| `pnpm test:browser` | happy-dom browser test project only                        |
| `pnpm test:types`   | `tsc` type-level tests only                                |
| `pnpm coverage`     | Unit tests with V8 coverage and enforced thresholds        |
| `pnpm build`        | ESM + CJS bundles and `.d.ts` / `.d.cts` declarations      |
| `pnpm check`        | Biome lint/format check (read-only)                        |
| `pnpm check:write`  | Biome lint/format with fixes                               |
| `pnpm changeset`    | Create a changeset for a user-facing change                |

## Architecture

- `src/index.ts` — public `create` / `mock`, option normalization, `defaults` deep merge, seed handling.
- `src/generate.ts` — generator dispatch: exact schema instance → `instanceof` class → throw; recursion guard.
- `src/generators/index.ts` — built-in registry. Order matters: `ZodDiscriminatedUnion`/`ZodXor` before `ZodUnion`; `ZodPreprocess` before `ZodPipe`; `ZodBase64`/`ZodBase64URL` before the `ZodStringFormat` fallback.
- `src/generators/*.ts` — one generator per zod type. Shared logic lives in `src/constraints.ts`.
- `src/constraints.ts` — reads constraints through zod public getters (`format`, `minLength`, `minValue`, ...) and `schema.def.checks` (`multipleOf`, exclusive bounds, sizes, MIME). Never rely on `_zod.bag`: zod 4.6 no longer populates it.
- `src/random.ts` — mulberry32 PRNG; faker is seeded in sync with the PRNG at the start of every run.
- `src/types.ts` — public option/context types and error classes.

## Invariants

- Return type must stay `z.output<T>` for every schema shape.
- Transforms/pipes generate their **output** value. `GenerationContext.direction` is `'input'` while producing a raw value for a transform, so nested codecs/pipes generate their input side. Async transforms and bare `z.transform()` cannot be generated synchronously and must throw clear errors.
- Generation must respect schema constraints: numeric exclusive bounds/`multipleOf`/integer formats, string formats and supported checks, date ranges, collection min/max sizes, enum-keyed records, file size/MIME.
- User `defaults` are deep-merged after generation and are also the fallback for `z.custom()` / `z.xor()` by field path. Size options may narrow schema ranges but never produce values that fail the schema.
- `create` is deterministic (seed 0). `mock` without `seed` is random per call; the same seed produces identical output.
- Source must stay universal: no Node built-ins (`node:*`, `fs`, `path`, `process`, ...). Browser/Node globals such as `btoa`, `atob` and `File` are allowed.

## Testing rules

- Use current zod 4 APIs only — never deprecated forms such as `z.string().email()`, `z.nativeEnum()`, `z.number().safe()` or `z.number().step()`, even in tests or type tests. See the migration table in `README.md`.
- Add behavior tests in `src/__tests__/behavior.test.ts`; add format/type smoke coverage in `src/__tests__/smoke.test.ts`; browser-only assertions go in `src/__tests__/browser.test.ts` (excluded from the Node project).
- Any new public option or return-type behavior needs a type-level test in `typetests/index.test-d.ts`.
- Run `pnpm test` and `pnpm coverage` before finishing. Do not lower coverage thresholds without a reason.

## Build and release

- Rslib runs in bundle mode with two lib entries: ESM and CJS, `syntax: 'es2022'`, `dts.autoExtension: true`, `output.target: 'web'` for universal usage. TypeScript 7 is installed, so Rslib generates declarations with `tsgo` automatically.
- `package.json` exports must match emitted files: `dist/index.js` + `dist/index.d.ts` for ESM, `dist/index.cjs` + `dist/index.d.cts` for CJS. Keep `main`, `module`, and `types` in sync.
- The package is published as `@jsdevlab/zod`. The initial release is `1.0.0` without a changeset; add changesets for changes after that release.
- Do not commit `dist/`, `coverage/`, or `node_modules/`.

## Code style

- Biome: 2-space indent, single quotes, line width 80, sorted imports.
- Prefer small pure helpers and structural type views over `any`; internal zod structures are read through narrow local interfaces.
- Keep JSDoc on exported functions and non-obvious helpers.
- Project Agent Skills live in `.claude/skills/` and track the official rstackjs skills (`rslib-best-practices`, `rstest-best-practices`). Consult https://rslib.rs/llms.txt and https://rstest.rs/llms.txt for current guidance.
