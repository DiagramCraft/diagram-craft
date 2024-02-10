/* eslint-disable @typescript-eslint/no-explicit-any */
import { isTaggedType, tag, TaggedType } from './types.ts';
import { newid } from './id.ts';

/*
TODO:
  string interpolation
*/

/** Utils ****************************************************************************** */

// To ensure no infinite loops
const boundLoop = <T>(fn: () => T) => {
  for (let i = 0; i < 1000; i++) {
    const res = fn();
    if (res !== undefined) return res;
  }
  throw error(100);
};

const safeNum = (s: any) => (isNaN(Number(s)) ? 0 : Number(s));

function* iterateAll(
  generators: Generator[],
  idx: number,
  input: Iterable<unknown>,
  arr: unknown[],
  bindings: Record<string, unknown>
): Iterable<unknown[]> {
  for (const item of generators[idx].iterable(input, bindings)) {
    const newArray = [...arr, item];
    if (idx === generators.length - 1) {
      yield newArray;
    } else {
      yield* iterateAll(generators, idx + 1, input, newArray, bindings);
    }
  }
}

const exactOne = (it: Iterable<unknown>) => {
  const arr = Array.from(it);
  if (arr.length !== 1) throw new Error();
  return arr[0];
};

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && !Array.isArray(x);

/** Error handling ********************************************************************* */

const BACKTRACK_ERROR = Symbol('backtrack');

const handleError = (e: unknown) => {
  if (e !== BACKTRACK_ERROR) throw e;
};

type Errors = {
  100: 'Inifinite loop';
  101: 'Unknown token';
  102: 'Unexpected token';
  103: 'Cannot parse token';
  201: 'Expected array';
  210: 'Unknown function';
};

const error = (code: keyof Errors, ...params: string[]) => {
  throw new Error(`Error ${code}: ${params}`);
};

/** Data types ************************************************************************* */

const add = (lvs: unknown, rvs: unknown) => {
  if (Array.isArray(lvs) && Array.isArray(rvs)) return [...lvs, ...rvs];
  if (typeof lvs === 'string' && typeof rvs === 'string') return lvs + rvs;
  if (isObj(lvs) && isObj(rvs)) return { ...lvs, ...rvs };
  return safeNum(lvs) + safeNum(rvs);
};

const subtract = (lvs: unknown, rvs: unknown) => {
  if (Array.isArray(lvs) && Array.isArray(rvs)) {
    return lvs.filter(element => !rvs.includes(element));
  }

  if (isObj(lvs) && isObj(rvs)) {
    const rvsKeys = Object.keys(rvs);
    return Object.fromEntries(Object.entries(lvs).filter(([key]) => !rvsKeys.includes(key)));
  }

  return safeNum(lvs) - safeNum(rvs);
};

const prop = (lvs: unknown, idx: unknown) => {
  if (Array.isArray(lvs) && typeof idx === 'number') return lvs.at(idx);
  if (isObj(lvs)) {
    if (idx === '__proto__' || idx === 'constructor') throw new Error();
    return lvs instanceof Map ? lvs.get(idx) : lvs[idx as string];
  }
  throw new Error();
};

const isEqual = (lvs: unknown, rvs: unknown) => {
  if ((Array.isArray(lvs) && Array.isArray(rvs)) || (isObj(lvs) && isObj(rvs))) {
    return JSON.stringify(lvs) === JSON.stringify(rvs);
  }
  return lvs === rvs;
};

const isNotEqual = (lvs: unknown, rvs: unknown) => !isEqual(lvs, rvs);

const isTrue = (e: unknown) => e !== false && e !== undefined && e !== null;

/** Functions ************************************************************************** */

type FnRegistration =
  | { fn: () => Generator }
  | { args: '1'; fn: (arg: ArgListOp) => Generator }
  | { args: '0&1'; fn: (arg: ArgListOp | undefined) => Generator };
type BinaryOpRegistration = (l: Generator, r: Generator) => Generator;

const FN_REGISTRY: Record<string, FnRegistration> = {
  '..': { fn: () => new RecursiveDescentOp() },
  not: { fn: () => new NotOp() },
  length: { fn: () => new LengthOp() },
  error: { args: '1', fn: a => new ErrorOp(a) },
  has: { args: '1', fn: a => new HasOp(a) },
  in: { args: '1', fn: a => new InOp(a) },
  map: { args: '1', fn: a => new ArrayConstructionOp(new PipeOp(new ArrayOp(), a)) },
  map_values: { args: '1', fn: a => new MapValuesOp(a) },
  select: { args: '1', fn: a => new SelectOp(a) },
  any: { fn: () => new AnyOp() },
  all: { fn: () => new AllOp() },
  unique_by: { args: '1', fn: a => new BaseArrayOp(Array_Unique, a) },
  unique: { fn: () => new BaseArrayOp(Array_Unique) },
  min_by: { args: '1', fn: a => new BaseArrayOp(Array_Min, a) },
  min: { fn: () => new BaseArrayOp(Array_Min) },
  max_by: { args: '1', fn: a => new BaseArrayOp(Array_Max, a) },
  max: { fn: () => new BaseArrayOp(Array_Max) },
  group_by: { args: '1', fn: a => new BaseArrayOp(Array_GroupBy, a) },
  startswith: { args: '1', fn: a => new StringOp(a, (a, b) => a.startsWith(b)) },
  endswith: { args: '1', fn: a => new StringOp(a, (a, b) => a.endsWith(b)) },
  abs: { fn: () => new AbsOp() },
  keys: { fn: () => new KeysOp() },
  split: { args: '1', fn: a => new StringOp(a, (a, b) => a.split(b)) },
  join: { args: '1', fn: a => new JoinOp(a) },
  contains: { args: '1', fn: a => new ContainsOp(a) },
  range: { args: '1', fn: a => new RangeOp(a.args) },
  limit: { args: '1', fn: a => new LimitOp(a) },
  first: {
    args: '0&1',
    fn: a =>
      new NthOp(a ? (a.args.unshift(new LiteralOp(0)), a) : new ArgListOp([new LiteralOp(0)]))
  },
  last: {
    args: '0&1',
    fn: a =>
      new NthOp(a ? (a.args.unshift(new LiteralOp(-1)), a) : new ArgListOp([new LiteralOp(-1)]))
  },
  flatten: {
    args: '0&1',
    fn: a => new FlattenOp(a ?? new ArgListOp([new LiteralOp(100)]))
  },
  nth: { args: '1', fn: a => new NthOp(a) },
  floor: { fn: () => new MathOp(Math.floor) },
  atan: { fn: () => new MathOp(Math.atan) },
  cos: { fn: () => new MathOp(Math.cos) },
  sin: { fn: () => new MathOp(Math.sin) },
  sqrt: { fn: () => new MathOp(Math.sqrt) },
  add: { fn: () => new BaseArrayOp(Array_Add) },
  empty: { fn: () => new EmptyOp() },
  test: { args: '1', fn: a => new MatchOp(a, true) },
  match: { args: '1', fn: a => new MatchOp(a) }
};

const BINOP_REGISTRY: Record<string, BinaryOpRegistration> = {
  '+': (l, r) => new BinaryOp(l, r, add),
  '-': (l, r) => new BinaryOp(l, r, subtract),
  '%': (l, r) => new BinaryOp(l, r, (a, b) => (a as number) % (b as number)),
  '*': (l, r) => new BinaryOp(l, r, (a, b) => (a as number) * (b as number)),
  '/': (l, r) => new BinaryOp(l, r, (a, b) => (a as number) / (b as number)),
  '//': (l, r) => new BinaryOp(l, r, (a, b) => a ?? b),
  '==': (l, r) => new BinaryOp(l, r, isEqual),
  '!=': (l, r) => new BinaryOp(l, r, isNotEqual),
  '>=': (l, r) => new BinaryOp(l, r, (a: any, b: any) => a >= b),
  '>': (l, r) => new BinaryOp(l, r, (a: any, b: any) => a > b),
  '<=': (l, r) => new BinaryOp(l, r, (a: any, b: any) => a <= b),
  '<': (l, r) => new BinaryOp(l, r, (a: any, b: any) => a < b),
  and: (l, r) => new BinaryOp(l, r, (a, b) => !!(a && b)),
  or: (l, r) => new BinaryOp(l, r, (a, b) => !!(a || b)),
  '|': (l, r) => new PipeOp(l, r),
  ',': (l, r) => new ConcatenationOp(l, r),
  ';': (l, r) => new ConcatenationOp(l, r),
  as: (l, r) => new VarBindingOp(l, r)
};

const BINOP_ORDERING = Object.fromEntries(
  [
    [';'],
    [','],
    ['|'],
    ['as'],
    ['//'],
    ['and', 'or'],
    ['==', '!=', '>=', '>', '<=', '<'],
    ['+', '-'],
    ['*', '/', '%']
  ].flatMap((e, idx) => e.map(a => [a, idx * 10])) as [string, number][]
);

/** Tokenizer ********************************************************************* */

type Token = {
  s: string;
  type: 'num' | 'str' | 'id' | 'op' | 'sep' | 'end';
};

class Tokenizer {
  public head: string;

  constructor(readonly query: string) {
    this.head = query;
  }

  peek(): Token {
    let m;

    if ((m = this.head.match(/^#.*/))) {
      return { s: m[0], type: 'sep' };
    } else if ((m = this.head.match(/^-?[\d]+(\.[\d]+)?/))) {
      return { s: m[0], type: 'num' };
    } else if ((m = this.head.match(/^"[^"]*"/))) {
      return { s: m[0], type: 'str' };
    } else if ((m = this.head.match(/^([a-zA-Z_][\w]*|\.\.)/))) {
      return { s: m[0], type: 'id' };
    } else if (
      (m = this.head.match(
        /^(\|\||&&|==|!=|>=|<=|>|<|\+|-|%|\/\/|\.|\[|\]|\(|\)|,|:|;|\$|{|}|\*|\/|\?|\|)/
      ))
    ) {
      return { s: m[0], type: 'op' };
    } else if ((m = this.head.match(/^(\s+)/))) {
      return { s: m[0], type: 'sep' };
    } else if (this.head === '') {
      return { s: '', type: 'end' };
    }

    throw error(101, this.head);
  }

  next(strip = true) {
    const s = this.peek();
    this.head = this.head.slice(s.s.length);
    if (strip) this.strip();
    return s;
  }

  expect(s: string, strip = true) {
    if (this.peek().s === s) return this.next(strip);
    else throw error(102, s, this.peek().s);
  }

  strip() {
    while (this.peek().type === 'sep') {
      this.head = this.head.slice(this.peek().s.length);
    }
    return this;
  }

  accept(s: string) {
    return this.peek().s === s && this.next();
  }

  keepWhitespace() {
    return {
      next: () => this.next(false),
      expect: (s: string) => this.expect(s, false),
      accept: (s: string) => this.peek().s === s && this.next(false),
      peek: () => this.peek()
    };
  }
}

/** Base generators ********************************************************************* */

type ArrayFn = (arr: [unknown, unknown][]) => [unknown, unknown][] | TaggedType<'single', unknown>;

type FnDef = {
  arg?: string[];
  body: Generator;
};

const isGenerator = (o: unknown): o is Generator => 'iterable' in (o as any);

interface Generator {
  iterable(input: Iterable<unknown>, bindings: Record<string, unknown>): Iterable<unknown>;
}

abstract class BaseGenerator<T extends Array<any> = unknown[]> implements Generator {
  constructor(protected readonly generators: Generator[] = []) {}

  *iterable(input: Iterable<unknown>, bindings: Record<string, unknown>): Iterable<unknown> {
    try {
      for (const e of input) {
        yield* this.handleInput(e, bindings);
      }
    } catch (e) {
      handleError(e);
    }
  }

  *handleInput(e: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    for (const args of iterateAll(this.generators, 0, [e], [], bindings)) {
      yield* this.handle(e, args as T, bindings);
    }
  }

  *handle(_e: unknown, _args: T, _bindings: Record<string, unknown>): Iterable<unknown> {
    // Do nothing
  }
}

abstract class BaseGenerator0 extends BaseGenerator<[]> {
  constructor() {
    super([]);
  }

  *handleInput(e: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    yield* this.handle(e, [], bindings);
  }
}

abstract class BaseGenerator1<T = unknown> extends BaseGenerator<T[]> {
  constructor(a: Generator) {
    super([a]);
  }
}

abstract class BaseGenerator2<A = unknown, B = unknown> extends BaseGenerator<[A, B]> {
  constructor(a: Generator, b: Generator) {
    super([a, b]);
  }
}

/** Object literal parser ********************************************************************* */

type OObjects = OObject | OLiteral | OArray | Generator;

export const OObjects = {
  parseString(s: string): OObjects & { val: unknown } {
    return OObjects.parse(new Tokenizer(s));
  },

  parse(tok: Tokenizer): OObjects & { val: unknown } {
    return OObjects.parseNext(tok) as OObjects & { val: unknown };
  },

  parseNext(tokenizer: Tokenizer): OObjects {
    const tok = tokenizer.next();

    if (tok.type === 'str') {
      return new OLiteral(tok.s.slice(1, -1));
    } else if (tok.s === '.') {
      return parsePathExpression(tokenizer, {});
    } else if (tok.s === '{') {
      return OObject.parse(tokenizer);
    } else if (tok.s === '(') {
      const e = OObjects.parseNext(tokenizer);
      tokenizer.expect(')');
      return e;
    } else if (tok.s === '[') {
      return OArray.parse(tokenizer);
    } else if (tok.type === 'num') {
      return new OLiteral(Number(tok.s));
    } else if (tok.s === 'true' || tok.s === 'false') {
      return new OLiteral(tok.s === 'true');
    }

    throw error(102, tokenizer.head);
  }
};

class OObject {
  entries: [OLiteral | Generator, OObjects][] = [];

  constructor(entries?: [OLiteral | Generator, OObjects][]) {
    this.entries = entries ?? [];
  }

  static parse(s: Tokenizer) {
    const obj = new OObject();

    let currentKey: OLiteral | Generator | undefined = undefined;

    while (s.peek().s !== '}') {
      if (s.peek().type === 'id') {
        currentKey = new OLiteral(s.next().s);

        // shorthand notation
        if (!s.accept(':')) {
          obj.entries.push([
            currentKey,
            parsePathExpression(new Tokenizer('.' + currentKey.val), {})
          ]);
          currentKey = undefined;
          if (!s.accept(',')) break;
        }
      } else {
        const next = OObjects.parseNext(s);

        if (currentKey) {
          obj.entries.push([currentKey, next]);
          currentKey = undefined;
          if (!s.accept(',')) break;
        } else {
          currentKey = next as OLiteral | Generator;
          s.expect(':');
        }
      }
    }

    s.expect('}');

    return obj;
  }

  get val() {
    const generators = new Map<string, Generator>();

    const dest: any = {};
    for (const [k, v] of this.entries) {
      const key: string = isGenerator(k) ? '__' + newid() : k.val!.toString();
      if (isGenerator(k)) generators.set(key, k);

      const val: any = isGenerator(v) ? '__' + newid() : v.val;
      if (isGenerator(v)) generators.set(val, v);

      dest[key] = val;
    }

    if (generators.size > 0) {
      dest.__generators = generators;
    }

    return dest;
  }
}

class OLiteral {
  constructor(public val: unknown) {}
}

class OArray {
  value: OObjects[] = [];

  constructor(value?: OObjects[]) {
    this.value = value ?? [];
  }

  static parse(s: Tokenizer) {
    const arr = new OArray();

    while (s.peek().s !== ']') {
      arr.value.push(OObjects.parseNext(s));
      if (!s.accept(',')) break;
    }
    s.expect(']');

    return arr;
  }

  get val(): unknown[] {
    return this.value.map(e => {
      if (isGenerator(e)) throw new Error();
      return e.val;
    });
  }
}

/** Generators ********************************************************************* */

class PipeOp implements Generator {
  constructor(
    private readonly left: Generator,
    private readonly right: Generator
  ) {}

  *iterable(input: Iterable<unknown>, bindings: Record<string, unknown>): Iterable<unknown> {
    try {
      yield* this.right.iterable(this.left.iterable(input, bindings), bindings);
    } catch (e) {
      handleError(e);
    }
  }
}

class PathExp implements Generator {
  constructor(private readonly generators: Generator[]) {}

  *iterable(input: Iterable<unknown>, bindings: Record<string, unknown>): Iterable<unknown> {
    const pipeOp = this.generators.reduceRight((a, b) => new PipeOp(b, a));
    yield* pipeOp.iterable(input, bindings);
  }
}

class MathOp extends BaseGenerator0 {
  constructor(private readonly fn: (a: number) => number) {
    super();
  }

  *handle(e: unknown): Iterable<unknown> {
    yield this.fn(safeNum(e));
  }
}

class IdentityOp extends BaseGenerator0 {
  *handle(e: unknown) {
    yield e;
  }
}

class PropertyLookupOp extends BaseGenerator1<string> {
  constructor(
    node: Generator,
    private readonly strict = true
  ) {
    super(node);
  }

  *handle(e: unknown, [identifier]: [string]): Iterable<unknown> {
    try {
      yield prop(e, identifier);
    } catch (err) {
      if (this.strict) throw err;
      if (e === undefined) yield undefined;
    }
  }
}

class ArraySliceOp extends BaseGenerator2<number, number> {
  *handle(e: unknown, [f, t]: [number, number]) {
    if (e === undefined || !Array.isArray(e)) return;
    yield e.slice(Math.floor(f), Math.ceil(t));
  }
}

class ArrayOp extends BaseGenerator0 {
  *handleInput(e: unknown): Iterable<unknown> {
    if (e === undefined || !Array.isArray(e)) throw error(201);
    yield* e;
  }
}

class ConcatenationOp extends BaseGenerator2 {
  *handleInput(e: unknown, bindings: Record<string, unknown>) {
    yield* this.generators[0].iterable([e], bindings);
    yield* this.generators[1].iterable([e], bindings);
  }
}

class ArrayConstructionOp extends BaseGenerator1 {
  *handleInput(e: unknown, bindings: Record<string, unknown>) {
    yield [...this.generators[0].iterable([e], bindings)];
  }
}

class RecursiveDescentOp extends BaseGenerator0 {
  *handleInput(e: unknown) {
    const dest: unknown[] = [];
    this.recurse(e, dest);
    yield* dest;
  }

  private recurse(input: unknown, dest: unknown[]) {
    dest.push(input);
    if (Array.isArray(input)) {
      input.map(e => this.recurse(e, dest));
    } else if (isObj(input)) {
      for (const key in input) {
        this.recurse(input[key], dest);
      }
    }
  }
}

class BinaryOp extends BaseGenerator2 {
  constructor(
    left: Generator,
    right: Generator,
    private readonly fn: (a: unknown, b: unknown) => unknown
  ) {
    super(left, right);
  }

  *handle(_e: unknown, [l, r]: [unknown, unknown]) {
    yield this.fn(l, r);
  }
}

class LiteralOp implements Generator {
  constructor(public readonly value: unknown) {}

  iterable() {
    return [this.value];
  }
}

class LengthOp extends BaseGenerator0 {
  *handleInput(e: unknown) {
    if (e === undefined || e === null) {
      yield 0;
    } else if (Array.isArray(e) || typeof e === 'string') {
      yield e.length;
    } else if (!isNaN(Number(e))) {
      yield Math.abs(Number(e));
    } else if (isObj(e)) {
      yield e instanceof Map ? e.size : Object.keys(e).length;
    }
  }
}

class NotOp extends BaseGenerator0 {
  *handleInput(e: unknown) {
    yield !isTrue(e);
  }
}

class ErrorOp extends BaseGenerator1<any> {
  // eslint-disable-next-line require-yield
  *handle(_e: unknown, [arg]: [any]) {
    throw arg;
  }
}

class HasOp extends BaseGenerator1<any> {
  *handle(e: unknown, [arg]: [any]) {
    yield arg in (e as any);
  }
}

class InOp extends BaseGenerator1<any> {
  *handle(e: unknown, [arg]: [any]) {
    yield (e as any) in arg;
  }
}

class SelectOp extends BaseGenerator1<boolean> {
  *handle(e: unknown, [r]: [boolean]) {
    if (r) {
      yield e;
    }
  }
}

class VarBindingOp extends BaseGenerator1 {
  constructor(
    node: Generator,
    private readonly identifier: Generator
  ) {
    super(node);
  }

  *handle(e: unknown, [v]: [unknown], bindings: Record<string, unknown>) {
    bindings[(this.identifier as VariableExpansionOp).identifier] = v;
    yield e;
  }
}

class ArgListOp implements Generator {
  constructor(public readonly args: Generator[]) {}

  *iterable(input: Iterable<unknown>, bindings: Record<string, unknown>): Iterable<unknown> {
    try {
      if (this.args.length === 1) {
        yield* this.args[0].iterable(input, bindings);
      } else {
        yield* iterateAll(this.args, 0, input, [], bindings);
      }
    } catch (e) {
      handleError(e);
    }
  }
}

class AnyOp extends BaseGenerator0 {
  *handle(e: unknown) {
    yield Array.isArray(e) && e.some(a => !!a);
  }
}

class AllOp extends BaseGenerator0 {
  *handle(e: unknown) {
    yield Array.isArray(e) && e.every(a => !!a);
  }
}

class BaseArrayOp extends BaseGenerator1 {
  constructor(
    private readonly fn: ArrayFn,
    node: Generator = new IdentityOp()
  ) {
    super(node);
  }

  *handleInput(el: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    if (!Array.isArray(el)) return yield el;
    const res = this.fn(el.map(e => [e, exactOne(this.generators[0].iterable([e], bindings))]));
    if (isTaggedType(res, 'single')) return yield res._val;

    return yield Array.isArray(res) ? (this.fn(res) as [unknown, unknown][]).map(a => a[0]) : res;
  }
}

const Array_Unique: ArrayFn = arr =>
  arr
    .filter((e, i) => arr.findIndex(a => a[1] === e[1]) === i)
    .sort((a, b) => (a[1] as number) - (b[1] as number));

const Array_Add: ArrayFn = arr =>
  tag('single', arr.length === 0 ? undefined : arr.map(a => a[1]).reduce((a, b) => add(a, b)));

const Array_Min: ArrayFn = arr => {
  if (arr.length === 0) return tag('single', undefined);
  const min = Math.min(...arr.map(a => Number(a[1])));
  return tag('single', arr.find(a => a[1] === min)![0]);
};

const Array_Max: ArrayFn = arr => {
  if (arr.length === 0) return tag('single', undefined);
  const max = Math.max(...arr.map(a => Number(a[1])));
  return tag('single', arr.find(a => a[1] === max)![0]);
};

const Array_GroupBy: ArrayFn = arr => {
  const dest: Record<string, unknown[]> = {};
  for (const [k, v] of arr) {
    dest[v as any] ??= [];
    dest[v as any].push(k);
  }
  return tag('single', Object.values(dest));
};

class MatchOp extends BaseGenerator2<string, string | undefined> {
  constructor(
    args: ArgListOp,
    private readonly onlyTest = false
  ) {
    super(args.args[0], args.args[1] ?? new LiteralOp(''));
  }

  *handle(el: string, [re, flags]: [string, string | undefined]) {
    if (flags?.includes('g') && !this.onlyTest) {
      yield* [...el.matchAll(new RegExp(re, flags))]!.map(e => this.mapMatch(e));
    } else {
      const a = el.match(new RegExp(re, flags ?? ''));
      yield this.onlyTest ? !!a : this.mapMatch(a!);
    }
  }

  private mapMatch(e: RegExpMatchArray) {
    return {
      offset: e.index,
      length: e[0].length,
      string: e[0],
      captures: e.slice(1).map(el => ({
        //offset: e.index,
        length: el.length,
        string: el
        //        name: null
      }))
    };
  }
}

class NthOp extends BaseGenerator1<number> {
  constructor(private readonly args: ArgListOp) {
    super(args.args[0]);
  }

  *handle(el: unknown, [index]: [number], bindings: Record<string, unknown>) {
    const idx = safeNum(index);
    if (this.args.args.length === 1 && Array.isArray(el)) {
      yield el.at(idx);
    } else if (this.args.args.length === 2) {
      yield [...this.args.args[1].iterable([el], bindings)].at(idx);
    }
  }
}

class FlattenOp extends BaseGenerator1<number> {
  *handle(el: unknown, [arg]: [number]) {
    yield Array.isArray(el) ? el.flat(arg) : el;
  }
}

class ObjectTemplateOp extends BaseGenerator0 {
  constructor(private readonly template: any) {
    super();
  }

  *handleInput(el: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    const generators = this.template.__generators as Map<string, Generator>;
    const iterables = [...generators.keys()];

    for (const a of iterateAll([...generators.values()], 0, [el], [], bindings)) {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < iterables.length; i++) {
        obj[iterables[i]] = a[i];
      }
      yield this.applyTemplate(this.template, obj);
    }
  }

  private applyTemplate(target: Record<string, unknown>, assignment: Record<string, unknown>) {
    const dest: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(target)) {
      if (k === '__generators') continue;

      const key = assignment[k] === undefined ? k : (assignment[k] as string);

      if (typeof v === 'string') {
        dest[key] = assignment[v];
      } else if (Array.isArray(v)) {
        dest[key] = v;
      } else if (isObj(v)) {
        dest[key] = this.applyTemplate(v, assignment);
      } else {
        dest[key] = v;
      }
    }
    return dest;
  }
}

class StringOp extends BaseGenerator1<string> {
  constructor(
    node: Generator,
    private readonly fn: (a: string, b: string) => unknown
  ) {
    super(node);
  }

  *handle(el: string | string[], [arg]: [string]) {
    yield Array.isArray(el) ? el.map(e => this.fn(e, arg)) : this.fn(el, arg);
  }
}

class JoinOp extends BaseGenerator1<string> {
  *handle(el: unknown, [r]: [string]) {
    yield Array.isArray(el) ? el.join(r) : el;
  }
}

class AbsOp extends BaseGenerator0 {
  *handle(el: unknown) {
    yield typeof el === 'number' ? Math.abs(el) : el;
  }
}

class KeysOp extends BaseGenerator0 {
  *handle(el: unknown) {
    if (el && typeof el === 'object')
      yield Object.keys(el)
        .sort()
        .map(e => (Array.isArray(el) ? Number(e) : e));
    else yield el;
  }
}

class MapValuesOp extends BaseGenerator1 {
  *handleInput(el: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    if (isObj(el)) {
      yield Object.fromEntries(
        Object.entries(el).map(([k, v]) => [
          k,
          exactOne(this.generators[0].iterable([v], bindings))
        ])
      );
    } else if (Array.isArray(el)) {
      yield el.map(e => exactOne(this.generators[0].iterable([e], bindings)));
    } else {
      yield el;
    }
  }
}

class ContainsOp extends BaseGenerator1 {
  *handleInput(el: unknown, bindings: Record<string, unknown>) {
    for (const a of this.generators[0].iterable([undefined], bindings)) {
      if (typeof a === 'string') {
        yield typeof el === 'string' ? el.includes(a) : false;
      } else if (Array.isArray(a)) {
        yield Array.isArray(el)
          ? a.every(e => el.some(v => v === e || (typeof v === 'string' && v.includes(e))))
          : false;
      } else {
        yield false;
      }
    }
  }
}

class VariableExpansionOp extends BaseGenerator0 {
  constructor(public readonly identifier: string) {
    super();
  }

  *handleInput(_el: unknown, bindings: Record<string, unknown>) {
    yield bindings[this.identifier];
  }
}

class FunctionCallOp extends BaseGenerator0 {
  constructor(
    public readonly identifier: string,
    public readonly arg?: ArgListOp
  ) {
    super();
  }

  *handle(input: unknown, _: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    const fnDef = bindings[this.identifier] as FnDef;

    const newBindings = { ...bindings };
    (fnDef.arg ?? []).forEach((a, idx) => {
      newBindings[a] = {
        body: this.arg!.args[idx]
      };
    });

    yield* fnDef.body.iterable([input], newBindings);
  }
}

class FunctionDefOp extends BaseGenerator0 {
  constructor(
    public readonly identifier: string,
    public readonly arg: string[],
    public readonly body: Generator
  ) {
    super();
  }

  // eslint-disable-next-line require-yield
  *handle(_input: Iterable<unknown>, _: [], bindings: Record<string, unknown>) {
    bindings[this.identifier] = {
      arg: this.arg,
      body: this.body
    };
  }
}

class RangeOp extends BaseGenerator {
  *handle(_el: unknown, args: unknown[]): Iterable<unknown> {
    const from = (args.length === 1 ? 0 : args[0]) as number;
    const to = (args.length === 1 ? args[0] : args[1]) as number;
    const step = (args[2] ?? 1) as number;

    for (let i = from; step > 0 ? i < to : i > to; i += step) {
      yield i;
    }
  }
}

class Noop extends BaseGenerator0 {}

class EmptyOp extends BaseGenerator0 {
  // eslint-disable-next-line require-yield
  *handle(_e: unknown) {
    throw BACKTRACK_ERROR;
  }
}

class LimitOp extends BaseGenerator1 {
  constructor(private readonly node: ArgListOp) {
    super(node.args[0]);
  }

  *handle(el: unknown, [M]: unknown[], bindings: Record<string, unknown>) {
    let limit = safeNum(M);
    for (const e of this.node.args[1].iterable([el], bindings)) {
      if (limit-- === 0) break;
      yield e;
    }
  }
}

class ParenExpressionOp extends BaseGenerator1 {
  *handleInput(e: unknown, bindings: Record<string, unknown>) {
    yield* this.generators[0].iterable([e], { ...bindings });
  }
}

class TryCatchOp extends BaseGenerator {
  constructor(
    private readonly body: Generator,
    private readonly catchBody: Generator
  ) {
    super([body]);
  }

  *handleInput(e: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    try {
      yield* this.body.iterable([e], bindings);
    } catch (e) {
      yield* this.catchBody.iterable([e], bindings);
    }
  }
}

class IfOp extends BaseGenerator {
  constructor(
    condition: Generator,
    private readonly ifConsequent: Generator,
    private readonly elifs: [Generator, Generator][],
    private readonly elseConsequent?: Generator
  ) {
    super([condition, ...elifs.map(e => e[0])]);
  }

  *handle(
    e: unknown,
    [ifCond, ...elifConds]: unknown[],
    bindings: Record<string, unknown>
  ): Iterable<unknown> {
    if (isTrue(ifCond)) {
      yield* this.ifConsequent.iterable([e], bindings);
    } else {
      for (let idx = 0; idx < elifConds.length; idx++) {
        if (isTrue(elifConds[idx])) {
          return yield* this.elifs![idx][1].iterable([e], bindings);
        }
      }

      if (this.elseConsequent) {
        yield* this.elseConsequent.iterable([e], bindings);
      } else {
        yield e;
      }
    }
  }
}

/** Parser ************************************************************************** */

const parsePathExpression = (
  tokenizer: Tokenizer,
  functions: Record<string, number>
): Generator => {
  const generators: Generator[] = [new IdentityOp()];

  const wsTokenizer = tokenizer.keepWhitespace();
  wsTokenizer.accept('.');

  return boundLoop(() => {
    const token = wsTokenizer.peek();
    if (token.type === 'id' || token.type === 'str') {
      wsTokenizer.next();
      const s = token.type === 'str' ? token.s.slice(1, -1) : token.s;
      const strict = !wsTokenizer.accept('?');
      generators.push(new PropertyLookupOp(new LiteralOp(s), strict));
    } else if (token.s === '[') {
      wsTokenizer.next();
      if (wsTokenizer.peek().s === ']') {
        wsTokenizer.next();
        generators.push(new ArrayOp());
      } else {
        const e1 = parseExpression(tokenizer.strip(), functions);
        if (wsTokenizer.peek().s === ':') {
          wsTokenizer.next();
          const e2 = parseExpression(tokenizer.strip(), functions);
          wsTokenizer.expect(']');
          generators.push(new ArraySliceOp(e1, e2));
        } else {
          wsTokenizer.expect(']');
          generators.push(
            new PropertyLookupOp(e1, e1 instanceof LiteralOp && typeof e1.value === 'string')
          );
        }
      }
    } else if (token.s === '.') {
      wsTokenizer.next();
    } else {
      return new PathExp(generators);
    }
  });
};

const parseOperand = (tokenizer: Tokenizer, functions: Record<string, number>): Generator => {
  try {
    const tok = tokenizer.peek();
    if (tok.s === '[') {
      tokenizer.next();
      const inner = tokenizer.peek().s === ']' ? new Noop() : parseExpression(tokenizer, functions);
      tokenizer.expect(']');

      return new ArrayConstructionOp(inner);
    } else if (tok.s === '(') {
      tokenizer.next();
      const inner = parseExpression(tokenizer, functions);
      tokenizer.expect(')');
      return new ParenExpressionOp(inner);
    } else if (tok.s === '.') {
      return parsePathExpression(tokenizer, functions);
    } else if (tok.s === '$') {
      tokenizer.next();
      return new VariableExpansionOp('$' + tokenizer.next().s);
    } else if (tok.s === 'try') {
      tokenizer.next();
      const body = parseExpression(tokenizer, functions);
      return new TryCatchOp(
        body,
        tokenizer.accept('catch') ? parseExpression(tokenizer, functions) : new EmptyOp()
      );
    } else if (tok.s === 'if') {
      tokenizer.next();

      const condition = parseExpression(tokenizer, functions);
      tokenizer.expect('then');

      const ifConsequent = parseExpression(tokenizer, functions);

      const elifs: [Generator, Generator][] = [];

      return boundLoop(() => {
        if (tokenizer.accept('else')) {
          const elseConsequent = parseExpression(tokenizer, functions);
          tokenizer.expect('end');
          return new IfOp(condition, ifConsequent, elifs, elseConsequent);
        } else if (tokenizer.accept('elif')) {
          const elifCondition = parseExpression(tokenizer, functions);
          tokenizer.expect('then');
          const elifConsequent = parseExpression(tokenizer, functions);
          elifs.push([elifCondition, elifConsequent]);
        } else {
          tokenizer.expect('end');
          return new IfOp(condition, ifConsequent, []);
        }
      });
    } else if (tok.s === 'def') {
      tokenizer.next();

      const name = tokenizer.next();

      const args: string[] = [];
      if (tokenizer.peek().s === '(') {
        tokenizer.expect('(');
        while (tokenizer.peek().s !== ')') {
          args.push(tokenizer.next().s);
          if (!tokenizer.accept(';')) break;
        }
        tokenizer.expect(')');
      }

      tokenizer.expect(':');

      functions[name.s] = args.length;

      const innerFunctions = { ...functions };
      args.forEach(e => (innerFunctions[e] = 0));
      const body = parseExpression(tokenizer, innerFunctions);

      tokenizer.accept(';');

      return new FunctionDefOp(name.s, args, body);

      /* LITERALS ************************************************************************** */
    } else if (tok.type === 'num') {
      return new LiteralOp(Number(tokenizer.next().s));
    } else if (tok.s === '{') {
      const res = OObjects.parse(tokenizer);
      if (res.val.__generators) {
        return new ObjectTemplateOp(res.val);
      } else {
        return new LiteralOp(res.val);
      }
    } else if (tok.type === 'str') {
      return new LiteralOp(tokenizer.next().s.slice(1, -1));
    } else if (tok.s === 'null') {
      tokenizer.next();
      return new LiteralOp(null);
    } else if (tok.s === 'false' || tok.s === 'true') {
      tokenizer.next();
      return new LiteralOp(tok.s === 'true');

      /* FUNCTIONS ************************************************************************** */
    } else if (tok.type === 'id') {
      const op = tok.s;
      tokenizer.next();

      if (op in FN_REGISTRY) {
        const reg = FN_REGISTRY[op];

        if (!('args' in reg)) {
          return reg.fn();
        } else if (reg.args === '0&1' && tokenizer.peek().s !== '(') {
          return reg.fn(undefined);
        }

        return reg.fn(parseArgList(tokenizer, functions));
      } else if (op in functions) {
        return new FunctionCallOp(
          op,
          functions[op] === 0 ? undefined : parseArgList(tokenizer, functions)
        );
      } else {
        throw error(210, op);
      }
    }
  } finally {
    tokenizer.strip();
  }

  throw error(103, tokenizer.head);
};

const parseExpression = (
  tokenizer: Tokenizer,
  functions: Record<string, number>,
  lastOp: string = ''
): Generator => {
  let left = parseOperand(tokenizer, functions);

  return boundLoop(() => {
    const tok = tokenizer.peek().s;

    if (
      tok !== ';' &&
      !!BINOP_REGISTRY[tok] &&
      BINOP_ORDERING[tok] > (BINOP_ORDERING[lastOp] ?? 0)
    ) {
      const op = tokenizer.next().s;

      left = BINOP_REGISTRY[op](left, parseExpression(tokenizer, functions, op));
    } else {
      return left;
    }
  });
};

const parseArgList = (tokenizer: Tokenizer, functions: Record<string, number>): ArgListOp => {
  tokenizer.expect('(');
  const op = [];
  while (tokenizer.peek().s !== ')') {
    op.push(parseExpression(tokenizer, functions));
    if (!tokenizer.accept(';')) break;
  }
  tokenizer.expect(')');
  return new ArgListOp(op);
};

export const parse = (query: string): Generator => {
  const tokenizer = new Tokenizer(query);

  const functions = {};
  const op = [];
  while (tokenizer.peek().type !== 'end') {
    op.push(parseExpression(tokenizer, functions));
  }

  return op.reduceRight((a, b) => new ConcatenationOp(b, a));
};

export const parseAndQuery = (q: string, input: unknown[], bindings?: Record<string, unknown>) => {
  return [...query(parse(q), input, bindings)];
};

export const query = (query: Generator, input: unknown[], bindings?: Record<string, unknown>) => {
  return query.iterable(input, bindings ?? {});
};
