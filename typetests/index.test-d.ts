// 类型级测试：create / mock 返回 z.output<T>，随 schema 推导
// 由 `tsc --noEmit -p tsconfig.typetests.json` 校验

import { z } from 'zod';

import { create, mock } from '../src/index';

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['admin', 'user']),
  page: z.number().default(1),
  tags: z.array(z.string()),
});

// 正面：返回类型 = z.output<T>
const init = create(userSchema);
const _init: {
  id: string;
  name: string;
  role: 'admin' | 'user';
  page: number;
  tags: string[];
} = init;

const mockValue = mock(userSchema, { seed: 1 });
const _mockVal: {
  id: string;
  name: string;
  role: 'admin' | 'user';
  page: number;
  tags: string[];
} = mockValue;

// 反面：字段类型推导正确（name 不是 number）
// @ts-expect-error `name` is a string
const _bad: number = init.name;

// 复杂类型：union / discriminatedUnion / tuple / map / set / promise
const complex = z.object({
  u: z.union([z.string(), z.number()]),
  du: z.discriminatedUnion('t', [
    z.object({ t: z.literal('a'), v: z.string() }),
    z.object({ t: z.literal('b'), v: z.number() }),
  ]),
  tuple: z.tuple([z.string(), z.number()]),
  map: z.map(z.string(), z.number()),
  set: z.set(z.number()),
  date: z.date(),
  promise: z.promise(z.boolean()),
  lazy: z.lazy(() => z.object({ self: z.number() })),
});
const initComplex = create(complex);
const _ic: {
  u: string | number;
  du: { t: 'a'; v: string } | { t: 'b'; v: number };
  tuple: [string, number];
  map: Map<string, number>;
  set: Set<number>;
  date: Date;
  promise: Promise<boolean>;
  lazy: { self: number };
} = initComplex;

const mockComplex = mock(complex);
const _mc: typeof initComplex = mockComplex;

// 自定义生成器不破坏返回类型
const withGen = mock(userSchema, {
  generators: [{ schema: userSchema.shape.id, generator: () => 'fixed' }],
});
const _wg: { id: string } = withGen;

// defaults 参数：Partial<z.output<T>> 编译期校验字段名与类型
const withDefaults = create(userSchema, {
  defaults: { name: 'Alice', role: 'admin', page: 2 },
});
const _wd: {
  id: string;
  name: string;
  role: 'admin' | 'user';
  page: number;
  tags: string[];
} = withDefaults;
// @ts-expect-error `nope` 不是 schema 字段
create(userSchema, { defaults: { nope: 1 } });
// @ts-expect-error `page` 必须是 number
create(userSchema, { defaults: { page: 'x' } });
// @ts-expect-error `role` 必须是枚举值
mock(userSchema, { defaults: { role: 'superadmin' } });

// defaults 深 Partial：嵌套对象可部分覆盖
import type { DeepPartial } from '../src/index';

const _dp: DeepPartial<{ a: { b: string; c: number }; list: string[] }> = {
  a: { b: 'x' }, // 嵌套部分覆盖合法
  list: ['y'],
};
const _dp2: DeepPartial<{ a: number }> = { a: 1 };
// @ts-expect-error 字段类型错误
const _badDp: DeepPartial<{ a: number }> = { a: 'x' };
create(userSchema, { defaults: { page: undefined } });
void _dp;
void _dp2;
void _badDp;

// 转换/管道：返回的是 z.output<T>（转换后的类型），而不是输入类型
const transformed = create(z.string().transform((s) => s.length));
const _transformed: number = transformed;

// 异步转换的输出类型仍是 number（运行时无法同步生成，调用会抛错）
const asyncTransformed = mock(z.string().transform(async (s) => s.length));
const _asyncTransformed: number = asyncTransformed;

// codec / stringbool 也返回输出类型
const codec = z.codec(z.string(), z.number(), {
  decode: (s) => Number(s),
  encode: (n) => String(n),
});
const _codecOut: number = create(codec);
const _stringboolOut: boolean = mock(z.stringbool());

void _transformed;
void _asyncTransformed;
void _codecOut;
void _stringboolOut;
