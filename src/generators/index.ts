import { z } from 'zod';

import { defineGenerator } from '../generate';
import type { GeneratorDefinition } from '../types';
import { anyGenerator } from './any';
import { arrayGenerator } from './array';
import { bigintGenerator } from './bigint';
import { booleanGenerator } from './boolean';
import { catchGenerator } from './catch';
import { dateGenerator } from './date';
import { defaultGenerator } from './default';
import { discriminatedUnionGenerator } from './discriminated-union';
import { enumGenerator } from './enum';
import {
  base64Generator,
  customGenerator,
  exactOptionalGenerator,
  fileGenerator,
  nonOptionalGenerator,
  prefaultGenerator,
  preprocessGenerator,
  templateLiteralGenerator,
  transformGenerator,
  xorGenerator,
} from './extras';
import { intersectionGenerator } from './intersection';
import { lazyGenerator } from './lazy';
import { literalGenerator } from './literal';
import { mapGenerator } from './map';
import { nullableGenerator } from './nullable';
import { numberGenerator } from './number';
import { objectGenerator } from './object';
import { optionalGenerator } from './optional';
import { pipeGenerator } from './pipe';
import { promiseGenerator } from './promise';
import { readonlyGenerator } from './readonly';
import { recordGenerator } from './record';
import { setGenerator } from './set';
import { stringGenerator } from './string';
import { symbolGenerator } from './symbol';
import { tupleGenerator } from './tuple';
import { unionGenerator } from './union';

/** Built-in generator registry: matched by instanceof on zod type classes */
export const defaultGenerators: GeneratorDefinition[] = [
  defineGenerator(z.ZodString, stringGenerator),
  defineGenerator(z.ZodNumber, numberGenerator),
  defineGenerator(z.ZodBigInt, bigintGenerator),
  defineGenerator(z.ZodBoolean, booleanGenerator),
  defineGenerator(z.ZodDate, dateGenerator),
  defineGenerator(z.ZodSymbol, symbolGenerator),
  defineGenerator(z.ZodEnum, enumGenerator),
  defineGenerator(z.ZodLiteral, literalGenerator),
  defineGenerator(z.ZodObject, objectGenerator),
  defineGenerator(z.ZodArray, arrayGenerator),
  defineGenerator(z.ZodTuple, tupleGenerator),
  defineGenerator(z.ZodRecord, recordGenerator),
  defineGenerator(z.ZodMap, mapGenerator),
  defineGenerator(z.ZodSet, setGenerator),
  // Note the order: ZodDiscriminatedUnion / ZodXor instanceof ZodUnion is true, so they must be registered first
  defineGenerator(z.ZodDiscriminatedUnion, discriminatedUnionGenerator),
  defineGenerator(z.ZodXor, xorGenerator),
  defineGenerator(z.ZodUnion, unionGenerator),
  defineGenerator(z.ZodIntersection, intersectionGenerator),
  defineGenerator(z.ZodOptional, optionalGenerator),
  defineGenerator(z.ZodNullable, nullableGenerator),
  defineGenerator(z.ZodDefault, defaultGenerator),
  defineGenerator(z.ZodCatch, catchGenerator),
  defineGenerator(z.ZodReadonly, readonlyGenerator),
  defineGenerator(z.ZodLazy, lazyGenerator),
  // Note the order: ZodPreprocess instanceof ZodPipe is true, so it must be registered first
  defineGenerator(z.ZodPreprocess, preprocessGenerator),
  defineGenerator(z.ZodPipe, pipeGenerator),
  defineGenerator(z.ZodPromise, promiseGenerator),
  // zod 4 additional types
  defineGenerator(z.ZodBase64, base64Generator),
  defineGenerator(z.ZodBase64URL, base64Generator),
  // Note the order: ZodBase64/ZodBase64URL are ZodStringFormat subclasses and already
  // registered exactly; this covers the remaining standalone format types
  // (z.email()/z.uuid()/z.iso.*() etc., not ZodString subclasses) as a fallback
  defineGenerator(z.ZodStringFormat, stringGenerator),
  defineGenerator(z.ZodExactOptional, exactOptionalGenerator),
  defineGenerator(z.ZodNonOptional, nonOptionalGenerator),
  defineGenerator(z.ZodPrefault, prefaultGenerator),
  defineGenerator(z.ZodTransform, transformGenerator),
  defineGenerator(z.ZodTemplateLiteral, templateLiteralGenerator),
  defineGenerator(z.ZodFile, fileGenerator),
  defineGenerator(z.ZodCustom, customGenerator),
  // Unstructured types: any/unknown/undefined/void/null/nan/never
  defineGenerator(z.ZodAny, anyGenerator),
  defineGenerator(z.ZodUnknown, anyGenerator),
  defineGenerator(z.ZodUndefined, anyGenerator),
  defineGenerator(z.ZodVoid, anyGenerator),
  defineGenerator(z.ZodNull, anyGenerator),
  defineGenerator(z.ZodNaN, anyGenerator),
  defineGenerator(z.ZodNever, anyGenerator),
];
