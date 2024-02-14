/* eslint-disable @typescript-eslint/no-explicit-any */
import { isTaggedType, tag, TaggedType } from './types.ts';
import { newid } from './id.ts';

/*
TODO:
  string interpolation
*/

/** Builtins *************************************************************************** */

const builtins = [
  'def paths: path(..)|select(length > 0)',
  'def map(f): [.[]|f]',
  'def del(f): delpaths([path(f)])'
];

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

const shallowClone = (v: unknown) => (Array.isArray(v) ? [...v] : isObj(v) ? { ...v } : v);

function* iterateAll(
  generators: Generator[],
  input: Iterable<Value>,
  context: Context,
  idx: number = 0,
  arr?: Value[]
): Iterable<Value<Value[]>> {
  for (const item of generators[idx].iterable(input, context)) {
    const newArray = [...(arr ?? []), item];
    if (idx === generators.length - 1) {
      yield value(newArray);
    } else {
      yield* iterateAll(generators, input, context, idx + 1, newArray);
    }
  }
}

const exactOne = <T>(it: Iterable<T>): T => {
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

const checkValidIdx = (idx: string) => {
  if (idx === '__proto__' || idx === 'constructor') throw new Error();
};

const prop = (lvs: unknown, idx: unknown) => {
  if (Array.isArray(lvs) && typeof idx === 'number') return lvs.at(idx);
  if (isObj(lvs)) {
    checkValidIdx(idx as string);
    return lvs instanceof Map ? lvs.get(idx) : lvs[idx as string];
  }
  throw new Error();
};

const setProp = (lvs: unknown, idx: unknown, rvs: unknown) => {
  if (Array.isArray(lvs) && typeof idx === 'number') {
    lvs[idx] = rvs;
  } else if (isObj(lvs)) {
    checkValidIdx(idx as string);
    lvs instanceof Map ? lvs.set(idx, rvs) : (lvs[idx as string] = rvs);
  } else {
    throw new Error();
  }
};

const propAndClone = (lvs: unknown, idx: unknown) => {
  const next = shallowClone(prop(lvs, idx));
  if (next !== undefined) setProp(lvs, idx, next);
  return next;
};

const deleteProp = (lvs: unknown, idx: unknown) => {
  if (Array.isArray(lvs) && typeof idx === 'number') {
    lvs.splice(idx, 1);
  } else if (isObj(lvs)) {
    checkValidIdx(idx as string);
    lvs instanceof Map ? lvs.delete(idx) : delete lvs[idx as string];
  } else {
    throw new Error();
  }
};

const evalPath = (path: PathElement[], obj: unknown, clone = false) => {
  let dest = obj;
  for (const e of path) {
    dest = clone ? propAndClone(dest, e) : prop(dest, e);
    if (dest === undefined) return undefined;
  }
  return dest;
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
  match: { args: '1', fn: a => new MatchOp(a) },
  path: { args: '1', fn: a => new PathOp(a) },
  getpath: { args: '1', fn: a => new GetPathOp(a) },
  delpaths: { args: '1', fn: a => new DelPathsOp(a) },
  setpath: { args: '1', fn: a => new SetPathOp(a) }
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
  '>=': (l, r) => new BinaryOp(l, r, (a, b) => a >= b),
  '>': (l, r) => new BinaryOp(l, r, (a, b) => a > b),
  '<=': (l, r) => new BinaryOp(l, r, (a, b) => a <= b),
  '<': (l, r) => new BinaryOp(l, r, (a, b) => a < b),
  and: (l, r) => new BinaryOp(l, r, (a, b) => !!(a && b)),
  or: (l, r) => new BinaryOp(l, r, (a, b) => !!(a || b)),
  '|': (l, r) => new PipeOp(l, r),
  ',': (l, r) => new ConcatenationOp(l, r),
  ';': (l, r) => new ConcatenationOp(l, r),
  as: (l, r) => new VarBindingOp(r, l),
  '|=': (l, r) => new UpdateAssignmentOp(l, r)
};

const BINOP_ORDERING = Object.fromEntries(
  [
    [';'],
    [','],
    ['|'],
    ['as'],
    ['//'],
    ['and', 'or'],
    ['==', '!=', '>=', '>', '<=', '<', '|='],
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
        /^(\|\||\|=|&&|==|!=|>=|<=|>|<|\+|-|%|\/\/|\.|\[|\]|\(|\)|,|:|;|\$|{|}|\*|\/|\?|\|)/
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
    else throw error(102, s, this.peek().s, this.head);
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

type Bindings = Record<string, Value>;
type Context = {
  bindings: Bindings;
};

type PathElement = string | number | { start: number; end: number };

type Value<T = unknown> = {
  val: T;
  path?: PathElement[];
};

const valueWithPath = (p: Value, v: unknown, pe: PathElement) => {
  return { val: v, path: [...(p.path ?? []), pe] };
};

const value = <T>(v: T): Value<T> => ({ val: v });
const values = (v: unknown[]) => v.map(value);

interface Generator {
  iterable(input: Iterable<Value>, context: Context): Iterable<Value>;
}

abstract class BaseGenerator<T extends Array<Value> = Value[]> implements Generator {
  constructor(protected readonly generators: Generator[] = []) {}

  *iterable(input: Iterable<Value>, context: Context): Iterable<Value> {
    try {
      for (const e of input) {
        yield* this.handleInput(e, context);
      }
    } catch (e) {
      handleError(e);
    }
  }

  *handleInput(e: Value, context: Context): Iterable<Value> {
    for (const args of iterateAll(this.generators, [e], context)) {
      yield* this.handle(e, args.val as T, context);
    }
  }

  *handle(_e: Value, _args: T, _context: Context): Iterable<Value> {
    // Do nothing
  }
}

abstract class BaseGenerator0 extends BaseGenerator<[]> {
  constructor() {
    super([]);
  }

  *handleInput(e: Value, context: Context): Iterable<Value> {
    yield* this.handle(e, [], context);
  }
}

abstract class BaseGenerator1<T = unknown> extends BaseGenerator<Value<T>[]> {
  constructor(a: Generator) {
    super([a]);
  }
}

abstract class BaseGenerator2<A = unknown, B = unknown> extends BaseGenerator<
  [Value<A>, Value<B>]
> {
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

  *iterable(input: Iterable<Value>, context: Context) {
    try {
      yield* this.right.iterable(this.left.iterable(input, context), context);
    } catch (e) {
      handleError(e);
    }
  }
}

class PathExp implements Generator {
  constructor(private readonly generators: Generator[]) {}

  *iterable(input: Iterable<Value>, context: Context) {
    yield* this.generators.reduceRight((a, b) => new PipeOp(b, a)).iterable(input, context);
  }
}

class MathOp extends BaseGenerator0 {
  constructor(private readonly fn: (a: number) => number) {
    super();
  }

  *handle({ val: v }: Value) {
    yield value(this.fn(safeNum(v)));
  }
}

class IdentityOp extends BaseGenerator0 {
  *handle(e: Value) {
    yield { val: e.val, path: e.path ?? [] };
  }
}

class PropertyLookupOp extends BaseGenerator1<string> {
  constructor(
    node: Generator,
    private readonly strict = true
  ) {
    super(node);
  }

  *handle(e: Value, [identifier]: [Value<string>]): Iterable<Value> {
    try {
      yield valueWithPath(e, prop(e.val, identifier.val), identifier.val);
    } catch (err) {
      if (e.val === undefined) return yield valueWithPath(e, undefined, identifier.val);
      if (this.strict) throw err;
    }
  }
}

class ArraySliceOp extends BaseGenerator2<number, number> {
  *handle(e: Value, [f, t]: [Value<number>, Value<number>]) {
    const v = e.val;
    if (v === undefined || !Array.isArray(v)) return;
    const pe = { start: Math.floor(f.val), end: Math.ceil(t.val) };
    yield valueWithPath(e, v.slice(pe.start, pe.end), pe);
  }
}

class ArrayOp extends BaseGenerator0 {
  *handleInput(e: Value) {
    const v = e.val;
    if (v === undefined || !Array.isArray(v)) throw error(201);
    for (let i = 0; i < v.length; i++) {
      yield valueWithPath(e, v[i], i);
    }
  }
}

class ConcatenationOp extends BaseGenerator2 {
  *handleInput(e: Value, context: Context) {
    yield* this.generators[0].iterable([e], context);
    yield* this.generators[1].iterable([e], context);
  }
}

class ArrayConstructionOp extends BaseGenerator1 {
  *handleInput(e: Value, context: Context) {
    yield value([...this.generators[0].iterable([e], context)].map(k => k.val));
  }
}

class PathOp extends BaseGenerator1 {
  *handleInput(e: Value, context: Context) {
    for (const v of this.generators[0].iterable([e], context)) {
      yield value(v.path);
    }
  }
}

class RecursiveDescentOp extends BaseGenerator0 {
  *handleInput(e: Value) {
    const dest: Value[] = [];
    this.recurse(e.val, dest, [...(e.path ?? [])]);
    yield* dest;
  }

  private recurse(input: unknown, dest: Value[], path: any[]) {
    dest.push({ val: input, path: [...path] });
    if (Array.isArray(input)) {
      input.map((e, idx) => this.recurse(e, dest, [...path, idx]));
    } else if (isObj(input)) {
      for (const key in input) {
        this.recurse(input[key], dest, [...path, key]);
      }
    }
  }
}

class BinaryOp extends BaseGenerator2 {
  constructor(
    left: Generator,
    right: Generator,
    private readonly fn: (a: any, b: any) => any
  ) {
    super(left, right);
  }

  *handle(_e: Value, [{ val: l }, { val: r }]: [Value, Value]) {
    yield value(this.fn(l, r));
  }
}

class LiteralOp implements Generator {
  constructor(public readonly value: unknown) {}

  *iterable() {
    yield value(this.value);
  }
}

class LengthOp extends BaseGenerator0 {
  *handleInput({ val: e }: Value) {
    if (e === undefined || e === null) {
      yield value(0);
    } else if (Array.isArray(e) || typeof e === 'string') {
      yield value(e.length);
    } else if (!isNaN(Number(e))) {
      yield value(Math.abs(Number(e)));
    } else if (isObj(e)) {
      yield value(e instanceof Map ? e.size : Object.keys(e).length);
    }
  }
}

class NotOp extends BaseGenerator0 {
  *handleInput({ val: e }: Value) {
    yield value(!isTrue(e));
  }
}

class ErrorOp extends BaseGenerator1 {
  // eslint-disable-next-line require-yield
  *handle(_e: Value, [arg]: [Value]) {
    throw arg.val;
  }
}

class HasOp extends BaseGenerator1 {
  *handle({ val: e }: Value, [arg]: [Value]) {
    yield value((arg.val as any) in (e as any));
  }
}

class InOp extends BaseGenerator1 {
  *handle({ val: e }: Value, [arg]: [Value]) {
    yield value((e as any) in (arg.val as any));
  }
}

class SelectOp extends BaseGenerator1<boolean> {
  *handle(e: Value, [r]: [Value<boolean>]) {
    if (r.val) {
      yield e;
    }
  }
}

class VarBindingOp extends BaseGenerator1 {
  constructor(
    private readonly id: Generator | string,
    node: Generator
  ) {
    super(node);
  }

  *handle(e: Value, [v]: [Value], context: Context) {
    context.bindings[typeof this.id === 'string' ? this.id : (this.id as VarRefOp).identifier] = v;
    yield e;
  }
}

class UpdateAssignmentOp extends BaseGenerator2 {
  *handleInput(e: Value, context: Context) {
    const dest = e.val;
    const lh = [...this.generators[0].iterable([e], context)];
    for (const lhe of lh) {
      const parent = evalPath((lhe.path ?? []).slice(0, -1), dest, true);

      const r = exactOne(this.generators[1].iterable([lhe], context));
      setProp(parent, lhe.path!.at(-1), r.val);
    }
    yield { val: dest };
  }
}

class ArgListOp implements Generator {
  constructor(public readonly args: Generator[]) {}

  *iterable(input: Iterable<Value>, context: Context): Iterable<Value> {
    try {
      if (this.args.length === 1) {
        yield* this.args[0].iterable(input, context);
      } else {
        yield* iterateAll(this.args, input, context);
      }
    } catch (e) {
      handleError(e);
    }
  }
}

class AnyOp extends BaseGenerator0 {
  *handle({ val: v }: Value) {
    yield value(Array.isArray(v) && v.some(a => !!a));
  }
}

class AllOp extends BaseGenerator0 {
  *handle({ val: v }: Value) {
    yield value(Array.isArray(v) && v.every(a => !!a));
  }
}

class BaseArrayOp extends BaseGenerator1 {
  constructor(
    private readonly fn: ArrayFn,
    node: Generator = new IdentityOp()
  ) {
    super(node);
  }

  *handleInput(el: Value, context: Context): Iterable<Value> {
    if (!Array.isArray(el.val)) return yield el;
    const res = this.fn(
      el.val.map(e => [e, exactOne(this.generators[0].iterable([value(e)], context)).val])
    );

    if (isTaggedType(res, 'single')) return yield value(res._val);

    return yield value(
      Array.isArray(res) ? (this.fn(res) as [unknown, unknown][]).map(a => a[0]) : res
    );
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

  *handle({ val: v }: Value<string>, [re, flags]: [Value<string>, Value<string | undefined>]) {
    if (flags.val?.includes('g') && !this.onlyTest) {
      yield* values([...v.matchAll(new RegExp(re.val, flags.val))]!.map(e => this.mapMatch(e)));
    } else {
      const a = v.match(new RegExp(re.val, flags.val ?? ''));
      yield value(this.onlyTest ? !!a : this.mapMatch(a!));
    }
  }

  private mapMatch(e: RegExpMatchArray) {
    return {
      offset: e.index,
      length: e[0].length,
      string: e[0],
      captures: e.slice(1).map(el => ({
        length: el.length,
        string: el
      }))
    };
  }
}

class NthOp extends BaseGenerator1<number> {
  constructor(private readonly args: ArgListOp) {
    super(args.args[0]);
  }

  *handle({ val: el }: Value, [index]: [Value<number>], context: Context) {
    const idx = safeNum(index.val);
    if (this.args.args.length === 1 && Array.isArray(el)) {
      yield value(el.at(idx));
    } else if (this.args.args.length === 2) {
      yield [...this.args.args[1].iterable([value(el)], context)].at(idx) ?? value(undefined);
    }
  }
}

class FlattenOp extends BaseGenerator1<number> {
  *handle({ val: v }: Value, [arg]: [Value<number>]) {
    yield value(Array.isArray(v) ? v.flat(arg.val) : v);
  }
}

class ObjectTemplateOp extends BaseGenerator0 {
  constructor(private readonly template: any) {
    super();
  }

  *handleInput(el: Value, context: Context): Iterable<Value> {
    const generators = this.template.__generators as Map<string, Generator>;
    const iterables = [...generators.keys()];

    for (const a of iterateAll([...generators.values()], [el], context)) {
      const obj: Record<string, Value> = {};
      iterables.forEach((k, i) => (obj[k] = a.val[i]));
      yield value(this.applyTemplate(this.template, obj));
    }
  }

  private applyTemplate(target: Record<string, unknown>, assignment: Record<string, Value>) {
    const dest: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(target)) {
      if (k === '__generators') continue;

      const key = assignment[k]?.val === undefined ? k : (assignment[k].val as string);

      if (typeof v === 'string') {
        dest[key] = assignment[v].val;
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

  *handle({ val: v }: Value<string | string[]>, [{ val: arg }]: [Value<string>]) {
    yield value(Array.isArray(v) ? v.map(e => this.fn(e, arg)) : this.fn(v, arg));
  }
}

class JoinOp extends BaseGenerator1<string> {
  *handle({ val: v }: Value, [r]: [Value<string>]) {
    yield value(Array.isArray(v) ? v.join(r.val) : v);
  }
}

class AbsOp extends BaseGenerator0 {
  *handle({ val: v }: Value) {
    yield value(typeof v === 'number' ? Math.abs(v) : v);
  }
}

class KeysOp extends BaseGenerator0 {
  *handle({ val: el }: Value) {
    if (el && typeof el === 'object')
      yield value(
        Object.keys(el)
          .sort()
          .map(e => (Array.isArray(el) ? Number(e) : e))
      );
    else yield value(el);
  }
}

class MapValuesOp extends BaseGenerator1 {
  *handleInput({ val: v }: Value, context: Context): Iterable<Value> {
    if (isObj(v)) {
      yield value(
        Object.fromEntries(
          Object.entries(v).map(([k, v]) => [
            k,
            exactOne(this.generators[0].iterable([value(v)], context)).val
          ])
        )
      );
    } else if (Array.isArray(v)) {
      yield value(v.map(e => exactOne(this.generators[0].iterable([value(e)], context)).val));
    } else {
      yield value(v);
    }
  }
}

class ContainsOp extends BaseGenerator1 {
  *handleInput({ val: v }: Value, context: Context) {
    for (const a of this.generators[0].iterable([value(undefined)], context)) {
      if (typeof a.val === 'string') {
        yield value(typeof v === 'string' ? v.includes(a.val) : false);
      } else if (Array.isArray(a.val)) {
        yield value(
          Array.isArray(v)
            ? a.val.every(e =>
                (v as unknown[]).some(v => v === e || (typeof v === 'string' && v.includes(e)))
              )
            : false
        );
      } else {
        yield value(false);
      }
    }
  }
}

class VarRefOp extends BaseGenerator0 {
  constructor(public readonly identifier: string) {
    super();
  }

  *handleInput(_el: Value, context: Context) {
    yield context.bindings[this.identifier];
  }
}

class FunctionCallOp extends BaseGenerator0 {
  constructor(
    public readonly identifier: string,
    public readonly arg?: ArgListOp
  ) {
    super();
  }

  *handle(input: Value, _: unknown, context: Context): Iterable<Value> {
    const fnDef = context.bindings[this.identifier].val as FnDef;

    const newBindings = { ...context.bindings };
    (fnDef.arg ?? []).forEach((a, idx) => {
      newBindings[a] = {
        val: {
          body: this.arg!.args[idx]
        }
      };
    });

    yield* fnDef.body.iterable([input], {
      ...context,
      bindings: newBindings
    });
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
  *handle(_input: Value, _: [], context: Context) {
    context.bindings[this.identifier] = value({
      arg: this.arg,
      body: this.body
    });
  }
}

class RangeOp extends BaseGenerator {
  *handle(_el: Value, args: Value[]): Iterable<Value> {
    const from = (args.length === 1 ? 0 : args[0].val) as number;
    const to = (args.length === 1 ? args[0].val : args[1].val) as number;
    const step = (args[2]?.val ?? 1) as number;

    for (let i = from; step > 0 ? i < to : i > to; i += step) {
      yield value(i);
    }
  }
}

class Noop extends BaseGenerator0 {}

class EmptyOp extends BaseGenerator0 {
  // eslint-disable-next-line require-yield
  *handle(_e: Value) {
    throw BACKTRACK_ERROR;
  }
}

class LimitOp extends BaseGenerator1 {
  constructor(private readonly node: ArgListOp) {
    super(node.args[0]);
  }

  *handle(el: Value, [M]: Value[], context: Context) {
    let limit = safeNum(M.val);
    for (const e of this.node.args[1].iterable([el], context)) {
      if (limit-- === 0) break;
      yield e;
    }
  }
}

class ParenExpressionOp extends BaseGenerator1 {
  *handleInput(e: Value, context: Context) {
    yield* this.generators[0].iterable([e], { ...context, bindings: { ...context.bindings } });
  }
}

class TryCatchOp extends BaseGenerator {
  constructor(
    private readonly body: Generator,
    private readonly catchBody: Generator
  ) {
    super([body]);
  }

  *handleInput(e: Value, context: Context): Iterable<Value> {
    try {
      yield* this.body.iterable([e], context);
    } catch (err) {
      yield* this.catchBody.iterable([value(err)], context);
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

  *handle(e: Value, [ifCond, ...elifConds]: Value[], context: Context): Iterable<Value> {
    if (isTrue(ifCond.val)) {
      yield* this.ifConsequent.iterable([e], context);
    } else {
      for (let idx = 0; idx < elifConds.length; idx++) {
        if (isTrue(elifConds[idx].val)) {
          return yield* this.elifs![idx][1].iterable([e], context);
        }
      }

      if (this.elseConsequent) {
        yield* this.elseConsequent.iterable([e], context);
      } else {
        yield e;
      }
    }
  }
}

class GetPathOp extends BaseGenerator1<PathElement[]> {
  *handle(input: Value, [path]: [Value<PathElement[]>], _context: Context): Iterable<Value> {
    yield value(evalPath(path.val, input.val as PathElement[]));
  }
}

class DelPathsOp extends BaseGenerator1<PathElement[][]> {
  *handle(input: Value, [paths]: [Value<PathElement[][]>], _context: Context): Iterable<Value> {
    const arrs: Map<string, { path: PathElement[]; idxs: number[] }> = new Map();
    const root = shallowClone(input.val);

    for (const path of paths.val) {
      if (path.length === 0) return yield value(undefined);

      const dest = evalPath(path.slice(0, -1), root, true);
      if (dest === undefined) continue;

      if (Array.isArray(dest)) {
        const pathToArray = path.slice(0, -1);
        const key = pathToArray.join(',');
        if (!arrs.has(key)) {
          arrs.set(key, { path: pathToArray, idxs: [] });
        }
        arrs.get(key)!.idxs.push(Number(path[path.length - 1]));
      } else {
        deleteProp(dest, path[path.length - 1]);
      }
    }

    // Need to handle arrays at the end to handle out of order array index paths
    for (const { path: p, idxs } of arrs.values()) {
      const arr = evalPath(p, root);
      if (!arr) continue;

      for (const idx of idxs.sort().reverse()) {
        deleteProp(arr, idx);
      }
    }

    yield value(root);
  }
}

class SetPathOp extends BaseGenerator2<PathElement[]> {
  constructor(n: ArgListOp) {
    super(n.args[0], n.args[1]);
  }

  *handle(input: Value, [path, v]: [Value<PathElement[]>, Value], _context: Context) {
    const root = shallowClone(input.val);
    const dest = evalPath(path.val.slice(0, -1), root, true);
    setProp(dest, path.val[path.val.length - 1], v.val);
    yield value(root);
  }
}

/** Parser ************************************************************************** */

const parsePathExpression = (
  tokenizer: Tokenizer,
  functions: Record<string, number>
): Generator => {
  const vars: Generator[] = [];
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
        const e1Id = newid();
        vars.push(new VarBindingOp(e1Id, e1));

        if (wsTokenizer.peek().s === ':') {
          wsTokenizer.next();
          const e2Id = newid();
          vars.push(new VarBindingOp(e2Id, parseExpression(tokenizer.strip(), functions)));

          wsTokenizer.expect(']');
          generators.push(new ArraySliceOp(new VarRefOp(e1Id), new VarRefOp(e2Id)));
        } else {
          wsTokenizer.expect(']');
          generators.push(
            new PropertyLookupOp(
              new VarRefOp(e1Id),
              e1 instanceof LiteralOp && typeof e1.value === 'string'
            )
          );
        }
      }
    } else if (token.s === '.') {
      wsTokenizer.next();
    } else {
      return new PathExp([...vars, ...generators]);
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
      return new VarRefOp('$' + tokenizer.next().s);
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
  const functions = {};
  const op = builtins.map(b => parseExpression(new Tokenizer(b), functions));

  const tokenizer = new Tokenizer(query);
  while (tokenizer.peek().type !== 'end') {
    op.push(parseExpression(tokenizer, functions));
  }

  return op.reduceRight((a, b) => new ConcatenationOp(b, a));
};

export const parseAndQuery = (q: string, input: unknown[], bindings?: Record<string, unknown>) => {
  return [...query(parse(q), input, bindings)];
};

export function* query(query: Generator, input: unknown[], bindings?: Record<string, unknown>) {
  for (const e of query.iterable(input.map(value), {
    bindings: Object.fromEntries(Object.entries(bindings ?? {}).map(([k, v]) => [k, value(v)]))
  })) {
    yield e.val;
  }
}
