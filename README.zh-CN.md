# @jsdevlab/zod

从 [zod 4](https://zod.dev) schema 生成**初始值**与**可复现的 mock 数据**。每次调用都返回 `z.output<T>`，类型由 schema 完整推导。

[English](./README.md) | 简体中文

## 特性

- **两种模式**：`create` 生成确定性的表单初始值，`mock` 生成带种子的随机测试数据。
- **端到端类型安全**：返回类型为 `z.output<T>`，覆盖 transform、codec、default 等场景。
- **感知约束**：支持字符串格式/长度、数字范围/排他边界/`multipleOf`/整数格式、日期范围、集合大小、文件大小与 MIME 校验。
- **可复现**：相同 seed 生成相同的 mock 数据；`create` 天然确定性。
- **可定制**：通过 `defaults` 覆盖任意字段，或按 schema 实例/类注册自定义生成器。
- **双格式构建**：同时提供 ESM 与 CJS 产物及对应的 `.d.ts` / `.d.cts` 类型声明。
- **使用 zod 4 现行 API**：兼容 `z.email()`、`z.uuid()`、`z.iso.*()`、`z.int()`、`z.enum()` 等新 API，并通过 zod 的公开访问器与 `schema.def.checks` 读取约束（不依赖已不再写入的 `_zod.bag`）。

## 环境要求

- Node.js >= 24（推荐 Node.js 24 LTS）
- 以 peer dependency 形式安装 `zod ^4.6.7`

## 安装

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

## 快速开始

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

// 表单初始值：确定性，遵循 default
const initial = create(userSchema);
// {
//   name: '',
//   email: 'Johnathon_Kertzmann@hotmail.com',
//   role: 'user',
//   page: 1,
//   tags: [],
// }

// 测试/演示数据：随机且受约束，相同 seed 可复现
const fixture = mock(userSchema, { seed: 42 });
// {
//   name: 'XMFiidTFKb',
//   email: 'Collin.Leffler@yahoo.com',
//   role: 'user',
//   page: 1,
//   tags: ['ptxOkAE', 'FidXY', ...],
// }

// 返回类型是 z.output<T>
const name: string = initial.name;

// 用 defaults 覆盖任意字段（编译期校验）
const draft = create(userSchema, {
  defaults: { name: 'Alice', role: 'admin' },
});
// { name: 'Alice', email: 'Johnathon_Kertzmann@hotmail.com', role: 'admin', ... }
```

> 上面 faker 生成的具体字符串取决于安装的 faker 版本，实际使用中只需关注数据形状与类型。

## API

### `create(schema, options?)`

生成确定性的初始数据：`''`、`0`、`false`、`[]`、空集合、optional 字段为 `undefined`、nullable 字段为 `null`，并优先使用 schema 中的默认值。会遵守最小长度/大小/范围约束，因此生成的初始数据仍然能通过校验。

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

生成随机 mock 数据。字符串通过 [faker](https://fakerjs.dev) 按格式生成；结果受 schema 约束限制，传入相同 `seed` 可复现。

```ts
const fixture = mock(userSchema, { seed: 7 });
const same = mock(userSchema, { seed: 7 }); // 与 fixture 完全相同
```

### 函数签名

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

### 选项

| 选项             | 类型                                      | 默认值    | 说明                                                                                              |
| ---------------- | ----------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `seed`           | `number`                                  | —         | mock 种子。省略时每次调用使用新的随机种子；相同种子 + 相同 schema = 相同结果。`create` 始终确定。 |
| `recursionLimit` | `number`                                  | `10`      | lazy 自引用的最大递归深度，超出时抛错。                                                           |
| `generators`     | `GeneratorDefinition[]`                   | `[]`      | 自定义生成器；先按 schema 实例匹配，再按 schema 类匹配，优先于内置生成器。                        |
| `array`          | `{ min?: number; max?: number }`          | `{}`      | 数组长度范围，会被 schema 的 `min`/`max` 收紧。                                                   |
| `record`         | `{ min?: number; max?: number }`          | `{}`      | record 键值对数量范围。                                                                           |
| `map`            | `{ min?: number; max?: number }`          | `{}`      | Map 大小范围，会被 schema 的大小校验收紧。                                                        |
| `set`            | `{ min?: number; max?: number }`          | `{}`      | Set 大小范围，会被 schema 的大小校验收紧。                                                        |
| `optional`       | `{ chance?: number }`                     | `0.3`     | mock 模式下 optional 字段为 `undefined` 的概率。                                                  |
| `nullable`       | `{ chance?: number }`                     | `0.3`     | mock 模式下 nullable 字段为 `null` 的概率。                                                       |
| `useDefault`     | `boolean`                                 | `true`    | 是否优先使用 `.default()` / `.prefault()` 的值。                                                  |
| `unhandled`      | `'throw' \| 'skip'`                       | `'throw'` | 无法生成值时的行为（`z.custom()`、`z.xor()` 等）。                                                |
| `date`           | `{ min?: Date; max?: Date }`              | `{}`      | 日期生成范围，与 schema 约束取交集。                                                              |
| `string`         | `{ length?: number \| [number, number] }` | `{}`      | 字符串长度，会覆盖 schema 自身的长度约束。                                                        |

### `defaults`

`defaults` 是 `z.output<T>` 的深度可选类型（DeepPartial），编译期校验，并深度合并到生成结果中：

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

数组会被整体替换，而不是逐元素合并。对于无法生成的 schema（`z.custom()`、`z.xor()`），`defaults` 也会按当前字段路径作为兜底值。

### 自定义生成器

```ts
const emailSchema = z.email();
const schema = z.object({ email: emailSchema });

const value = mock(schema, {
  generators: [
    // 实例匹配：仅对这个 schema 实例生效
    { schema: emailSchema, generator: () => 'alice@example.com' },
    // 类匹配：对所有 z.ZodNumber 生效
    { schema: z.ZodNumber, generator: () => 42 },
  ],
});
```

生成器签名为 `(schema, context)`，`context` 中包含生成模式、带种子的随机数生成器、当前字段路径和归一化后的选项。

## 行为说明

### `create` 与 `mock` 对比

| 维度                | `create`                    | `mock`                              |
| ------------------- | --------------------------- | ----------------------------------- |
| 用途                | 表单初始值 / 空对象         | 测试数据 / 演示                     |
| 确定性              | 始终确定                    | 带种子；省略 seed 时每次随机        |
| 字符串              | `''` 或格式所需的最小合法值 | faker 按格式生成                    |
| 数字                | 最接近 `0` 的合法值         | 在约束范围内随机                    |
| 集合                | 满足最小长度/大小           | 在约束/选项范围内随机               |
| optional / nullable | `undefined` / `null`        | 按概率生成（`optional`/`nullable`） |
| 默认值              | 使用                        | 使用（除非 `useDefault: false`）    |

### 支持的约束

- **string**：`min`/`max`/`length`、`startsWith`/`endsWith`/`includes`、`lowercase`/`uppercase`，以及具名格式（见下文）。
- **number**：`min`/`max`、`gt`/`gte`/`lt`/`lte`、`positive`/`negative`（通过 `gt`/`lt` 实现）、`multipleOf`、整数格式（`z.int()`、`.int()`、`z.int32()`、`z.uint32()`）。
- **bigint**：`min`/`max`、排他边界与 `multipleOf`。
- **date**：`min`/`max`，存在排他校验时也会遵守。
- **array / set / map**：`min`/`max`/`length`/`size` 与 `nonempty()`。
- **record**：enum/literal 键的 record 必须生成全部键，除非使用 `z.partialRecord()`。
- **file**：`min`/`max` 字节大小与 `mime()`。
- **object/tuple/包装类型/union/intersection/lazy/promise**：递归生成。

> 无法合成的字符串校验（`regex()`、`refine()`、字符串 transform 等）不会在生成阶段生效。需要这些约束时请使用 `defaults` 或自定义生成器。

### 支持的格式

字符串格式都会生成合法值：`email`、`url`/`httpUrl`、`hostname`、`emoji`、`guid`、`uuid`（含 `uuidv4`/`uuidv6`/`uuidv7`）、`nanoid`、`cuid2`（为兼容仍支持旧 `cuid`）、`ulid`、`xid`、`ksuid`、`ipv4`、`ipv6`、`mac`、`cidrv4`、`cidrv6`、`base64`、`base64url`、`e164`、`jwt`、`credit_card`、`iban`、`hex`，以及 `md5`/`sha1`/`sha256`/`sha384`/`sha512` 的 `hex`、`base64`、`base64url` 编码；还包括 `z.iso.date()` / `z.iso.time()` / `z.iso.datetime()` / `z.iso.duration()`（含 precision 选项）。

### transform、pipe 与 codec

- `z.string().transform(...)` 和 `input.pipe(output)` 返回**转换后的输出值**，而不是输入值。
- `z.codec()` 与 `z.stringbool()` 直接在输出侧生成值。
- 裸 `z.transform()` 没有输入 schema，会抛错。
- 异步 transform 无法同步求值，会抛错；请为这类 schema 使用 `defaults` 或自定义生成器。

### 递归

`z.lazy()` 的自引用按 schema 实例计数。需要更深的树时增大 `recursionLimit`，或减小 `optional.chance` 让递归分支更早终止。

### 可复现性

`create` 固定种子；`mock` 接受 `seed`。每次调用都会重置 faker 的全局种子，因此相同 schema、seed 与选项会得到稳定结果。生成过程是同步的，并发调用不会相互穿插。

## 支持的 zod 类型

| 类别     | 类型                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 基础类型 | `string` / `number`（含 `z.int()`、`z.int32()`、`z.uint32()`、`z.float32()`、`z.float64()`）/ `bigint` / `boolean` / `date` / `symbol` |
| 字面量   | `literal` / `enum`（字符串与 TS 枚举对象）/ `null` / `undefined` / `void` / `NaN` / `never`（抛错）                                    |
| 非结构化 | `any` / `unknown`                                                                                                                      |
| 对象     | `object` / `strictObject` / `looseObject`                                                                                              |
| 容器     | `array` / `tuple`（含 rest）/ `record`（含 `partialRecord`）/ `map` / `set` / `file`                                                   |
| 组合     | `union` / `discriminatedUnion` / `intersection`                                                                                        |
| 包装类型 | `optional` / `exactOptional` / `nullable` / `default` / `prefault` / `catch` / `readonly` / `nonoptional` / `lazy`                     |
| 转换     | `pipe` / `preprocess` / `transform`（位于 pipe 中）/ `codec` / `stringbool`                                                            |
| 异步     | `promise`                                                                                                                              |
| 特殊     | `templateLiteral` / `file`                                                                                                             |

无法生成：`z.custom()`、`z.xor()`、裸 `z.transform()`、`z.function()`。请提供 `defaults`、自定义生成器，或使用 `unhandled: 'skip'`。

## 从过时的 zod API 迁移

本库只依赖 zod 4 现行 API，不需要使用过时 API。建议使用右列写法：

| 过时写法                               | 现行写法                        |
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

## 开发

```bash
pnpm install
pnpm build          # 构建 ESM + CJS + 类型声明
pnpm test           # 类型级测试 + 单元测试
pnpm test:types     # 仅类型级测试
pnpm test:unit      # 仅单元测试
pnpm coverage       # 覆盖率（带强制阈值）
pnpm check          # Biome 检查（只读）
pnpm check:write    # Biome 检查并自动修复
```

覆盖率阈值：语句 85%、分支 70%、函数 90%、行 85%。当前：语句 87.7%、分支 74.1%、函数 96.3%、行 90.7%。

## 许可证

[MIT](./LICENSE.txt)
