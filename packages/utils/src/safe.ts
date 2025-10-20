import { assert } from './assert';
import type { NElementArray, NOrMoreElementArray } from './types';

export const safeReMatch = <M extends number>(value: string, re: RegExp, min: M, max?: number) => {
  const m = value.match(re);
  if (!m) return undefined;
  assert.true(m.length >= min && (max === undefined || m.length <= max));

  // Convert to plain array to remove RegExpMatchArray properties (index, input, groups)
  const plainArray = Array.from(m);

  if (max === undefined) {
    return plainArray as NElementArray<string, M>;
  } else {
    return plainArray as NOrMoreElementArray<string, M>;
  }
};

export const safeSplit = <M extends number>(value: string, sep: string, min: M, max?: number) => {
  const r = value.split(sep);
  assert.true(r.length >= min && (max === undefined || r.length <= max));

  if (max === undefined) {
    return r as NElementArray<string, M>;
  } else {
    return r as NOrMoreElementArray<string, M>;
  }
};

export const safeTupleCast = <M extends number, T>(value: T[], n: M) => {
  assert.true(value.length === n);
  return value as NElementArray<T, M>;
};
