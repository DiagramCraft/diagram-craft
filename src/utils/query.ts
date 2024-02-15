/* eslint-disable @typescript-eslint/no-explicit-any */
import { isTaggedType, tag, TaggedType } from './types.ts';

/** Builtins *************************************************************************** */

const builtins = [
  'def paths: path(..)|select(length > 0)',
  'def map(f): [.[]|f]',
  'def del(f): delpaths([path(f)])'
];

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
  202: 'Invalid index';
  203: 'Expected indexable object';
  204: 'Expected expression of type';
  210: 'Unknown function';
  301: 'Expected exactly one';
};

const error = (code: keyof Errors, ...params: unknown[]) => {
  throw new Error(`${code}: ${params.join(', ')}`);
};

type ConstructorTypeOf<T> = new (...args: any[]) => T;
function verifyOpType<T extends Generator>(
  op: Generator,
  type: ConstructorTypeOf<T>
): asserts op is T {
  if (!(op instanceof type)) error(204, type.name, op.constructor.name);
}

/** Utils ****************************************************************************** */

let lastId = 0;
const newid = () => `__${++lastId}`;

const iterNth = <T>(iterable: Iterable<T>, n: number): T | undefined => {
  if (n < 0) return [...iterable].at(n);
  const iterator = iterable[Symbol.iterator]();

  // eslint-disable-next-line no-constant-condition
  while (n-- > 0) {
    if (iterator.next().done) return undefined;
  }
  return iterator.next().value;
};

// To ensure no infinite loops
const boundLoop = <T>(fn: () => T) => {
  for (let i = 0; i < 1000; i++) {
    const res = fn();
    if (res !== undefined) return res;
  }
  throw error(100);
};

const safeNum = (s: any) => (isNaN(Number(s)) ? 0 : Number(s));

const shallowClone = (v: unknown) => (isArray(v) ? [...v] : isObj(v) ? { ...v } : v);

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
  if (arr.length !== 1) error(301);
  return arr[0];
};

const one = <T>(it: Iterable<T>): T | undefined => Array.from(it)[0];

const isArray = Array.isArray;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && !isArray(x);

/** Data types ************************************************************************* */

const add = (lvs: unknown, rvs: unknown) => {
  if (isArray(lvs) && isArray(rvs)) return [...lvs, ...rvs];
  if (typeof lvs === 'string' && typeof rvs === 'string') return lvs + rvs;
  if (isObj(lvs) && isObj(rvs)) return { ...lvs, ...rvs };
  return safeNum(lvs) + safeNum(rvs);
};

const subtract = (lvs: unknown, rvs: unknown) => {
  if (isArray(lvs) && isArray(rvs)) {
    return lvs.filter(element => !rvs.includes(element));
  }

  if (isObj(lvs) && isObj(rvs)) {
    const rvsKeys = Object.keys(rvs);
    return Object.fromEntries(Object.entries(lvs).filter(([key]) => !rvsKeys.includes(key)));
  }

  return safeNum(lvs) - safeNum(rvs);
};

const checkValidIdx = (idx: unknown) => {
  if (idx === '__proto__' || idx === 'constructor') error(202);
};

const prop = (lvs: unknown, idx: unknown) => {
  checkValidIdx(idx);

  if (isArray(lvs) && typeof idx === 'number') return lvs.at(idx);
  if (isObj(lvs)) {
    return lvs instanceof Map ? lvs.get(idx) : lvs[idx as string];
  }
  error(203, lvs);
};

const setProp = (lvs: unknown, idx: unknown, rvs: unknown) => {
  checkValidIdx(idx);

  if (isArray(lvs) && typeof idx === 'number') {
    lvs[idx < 0 ? lvs.length + idx : idx] = rvs;
  } else if (isObj(lvs)) {
    lvs instanceof Map ? lvs.set(idx, rvs) : (lvs[idx as string] = rvs);
  } else {
    error(203, lvs);
  }
};

const propAndClone = (lvs: unknown, idx: unknown) => {
  const next = shallowClone(prop(lvs, idx));
  if (next !== undefined) setProp(lvs, idx, next);
  return next;
};

const deleteProp = (lvs: unknown, idx: unknown) => {
  checkValidIdx(idx);

  if (isArray(lvs) && typeof idx === 'number') {
    lvs.splice(idx, 1);
  } else if (isObj(lvs)) {
    lvs instanceof Map ? lvs.delete(idx) : delete lvs[idx as string];
  } else {
    error(203, lvs);
  }
};

const evalPath = (path: PathElement[], obj: unknown) => {
  let dest = obj;
  for (const e of path) {
    dest = propAndClone(dest, e);
    if (dest === undefined) return undefined;
  }
  return dest;
};

const mkObj = (p: PathElement) => (typeof p === 'number' ? [] : {});

// TODO: Do we need to add step by step cloning in here
const setPath = (base: any | undefined, path: PathElement[], val: unknown): unknown => {
  const dest = base ?? mkObj(path.at(0)!);
  let parent: any = dest;
  for (const [i, k] of path.entries()) {
    if (i < path.length - 1) {
      parent[k as any] ??= mkObj(path[i + 1]!);
      parent = parent[k as any];
    } else {
      setProp(parent, k, val);
    }
  }
  return dest;
};

const isEqual = (lvs: unknown, rvs: unknown) => {
  if ((isArray(lvs) && isArray(rvs)) || (isObj(lvs) && isObj(rvs))) {
    return JSON.stringify(lvs) === JSON.stringify(rvs);
  }
  return lvs === rvs;
};

const isNotEqual = (lvs: unknown, rvs: unknown) => !isEqual(lvs, rvs);

const isTrue = (e: unknown) => e !== false && e !== undefined && e !== null;

class Modification {
  private dels: Map<string, { path: PathElement[]; idxs: unknown[] }> = new Map();
  private mods: Array<{ path: PathElement[]; val: unknown }> = [];

  constructor(private target: unknown) {}

  set(path: PathElement[], val: unknown) {
    this.mods.push({ path, val });
  }

  del(path: PathElement[], idx: unknown) {
    const key = path.join(',');
    (this.dels.get(key) ?? this.dels.set(key, { path, idxs: [] }).get(key)!).idxs.push(idx);
  }

  apply() {
    for (const mod of this.mods) {
      const arr = evalPath(mod.path.slice(0, -1), this.target);
      if (!arr) continue;
      setProp(arr, mod.path.at(-1), mod.val);
    }

    for (const { path: p, idxs } of this.dels.values()) {
      const arr = evalPath(p, this.target);
      if (!arr) continue;

      for (const idx of idxs.sort().reverse()) {
        deleteProp(arr, idx);
      }
    }

    return this.target;
  }
}

/** Functions ************************************************************************** */

type FnRegistration = (arg: ArgListOp) => Generator;
type BinaryOpRegistration = (l: Generator, r: Generator) => Generator;

const FN_REGISTRY: Record<string, FnRegistration> = {
  '../0': () => new RecursiveDescentOp(),
  'abs/0': () => new FnOp(a => (typeof a === 'number' ? Math.abs(a) : a)),
  'add/0': () => new BaseArrayOp(Array_Add),
  'all/0': () => new FnOp(a => isArray(a) && a.every(b => !!b)),
  'any/0': () => new FnOp(a => isArray(a) && a.some(b => !!b)),
  'atan/0': () => new MathOp(Math.atan),
  'contains/1': a => new ContainsOp(a),
  'cos/0': () => new MathOp(Math.cos),
  'delpaths/1': a => new DelPathsOp(a),
  'empty/0': () => mkEmptyOp(),
  'endswith/1': a => new StringOp(a, (a, b) => a.endsWith(b)),
  'error/0': () => new ErrorOp(literal('')),
  'error/1': a => new ErrorOp(a),
  'first/0': () => new NthOp([literal(0)]),
  'first/1': a => new NthOp([literal(0), ...a.args]),
  'flatten/0': () => new FlattenOp(literal(100)),
  'flatten/1': a => new FlattenOp(a),
  'floor/0': () => new MathOp(Math.floor),
  'fromjson/0': () => new FnOp(a => JSON.parse(a as string)),
  'getpath/1': a => new GetPathOp(a),
  'group_by/1': a => new BaseArrayOp(Array_GroupBy, a),
  'has/1': a => new HasOp(a),
  'in/1': a => new InOp(a),
  'join/1': a => new JoinOp(a),
  'keys/0': () => new KeysOp(),
  'last/0': () => new NthOp([literal(-1)]),
  'last/1': a => new NthOp([literal(-1), ...a.args]),
  'length/0': () => new LengthOp(),
  'limit/2': a => new LimitOp(a),
  'map_values/1': a => new MapValuesOp(a),
  'match/1': a => new MatchOp(a),
  'match/2': a => new MatchOp(a),
  'max/0': () => new BaseArrayOp(Array_Max),
  'max_by/1': a => new BaseArrayOp(Array_Max, a),
  'min/0': () => new BaseArrayOp(Array_Min),
  'min_by/1': a => new BaseArrayOp(Array_Min, a),
  'not/0': () => new FnOp(a => !isTrue(a)),
  'nth/1': a => new NthOp(a.args),
  'nth/2': a => new NthOp(a.args),
  'path/1': a => new PathOp(a),
  'pick/1': a => new PickOp(a),
  'range/1': a => new RangeOp([literal(0), a.args[0], literal(1)]),
  'range/2': a => new RangeOp([...a.args, literal(1)]),
  'range/3': a => new RangeOp(a.args),
  'select/1': a => new SelectOp(a),
  'setpath/2': a => new SetPathOp(a),
  'sin/0': () => new MathOp(Math.sin),
  'split/1': a => new StringOp(a, (a, b) => a.split(b)),
  'sqrt/0': () => new MathOp(Math.sqrt),
  'startswith/1': a => new StringOp(a, (a, b) => a.startsWith(b)),
  'test/1': a => new MatchOp(a, true),
  'test/2': a => new MatchOp(a, true),
  'tojson/0': () => new FnOp(a => JSON.stringify(a)),
  'unique/0': () => new BaseArrayOp(Array_Unique),
  'unique_by/1': a => new BaseArrayOp(Array_Unique, a)
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
  as: (l, r) => new VarBindingOp(r as VarRefOp | string, l),
  '|=': (l, r) => new UpdateAssignmentOp(l, r),
  '=': (l, r) => new AssignmentOp(l, r),
  '+=': (l, r) => new UpdateAssignmentOp(l, new BinaryOp(new IdentityOp(), r, add)),
  '-=': (l, r) => new UpdateAssignmentOp(l, new BinaryOp(new IdentityOp(), r, subtract)),
  '*=': (l, r) => new UpdateAssignmentOp(l, new BinaryOp(new IdentityOp(), r, (a, b) => a * b)),
  '/=': (l, r) => new UpdateAssignmentOp(l, new BinaryOp(new IdentityOp(), r, (a, b) => a / b)),
  '%=': (l, r) => new UpdateAssignmentOp(l, new BinaryOp(new IdentityOp(), r, (a, b) => a % b)),
  '//=': (l, r) => new UpdateAssignmentOp(l, new BinaryOp(new IdentityOp(), r, (a, b) => a ?? b))
};

const BINOP_ORDERING = Object.fromEntries(
  [
    [';'],
    [','],
    ['|'],
    ['as'],
    ['//'],
    ['and', 'or'],
    ['==', '!=', '>=', '>', '<=', '<', '|=', '=', '+=', '-=', '*=', '/=', '%=', '//='],
    ['+', '-'],
    ['*', '/', '%']
  ].flatMap((e, idx) => e.map(a => [a, idx * 10])) as [string, number][]
);

const BINOP_RE = new RegExp(
  '^(' +
    [...Object.keys(BINOP_ORDERING), ...':[]().${}?'.split('')]
      .sort((a, b) => b.length - a.length)
      .map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|') +
    ')'
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
    }

    if ((m = this.head.match(/^-?[\d]+(\.[\d]+)?/))) {
      return { s: m[0], type: 'num' };
    }

    if ((m = this.head.match(/^"[^"]*"/))) {
      return { s: m[0], type: 'str' };
    }

    if ((m = this.head.match(/^([a-zA-Z_][\w]*|\.\.)/))) {
      return { s: m[0], type: 'id' };
    }

    if ((m = this.head.match(BINOP_RE))) {
      return { s: m[0], type: 'op' };
    }

    if ((m = this.head.match(/^(\s+)/))) {
      return { s: m[0], type: 'sep' };
    }

    if (this.head === '') {
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

  keepWS() {
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
  constructor(public readonly generators: Generator[] = []) {}

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
    super();
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
      const e = parseExpression(tokenizer, {});
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

class FnOp extends BaseGenerator0 {
  constructor(private readonly fn: (a: unknown) => unknown) {
    super();
  }

  *handle({ val: v }: Value) {
    yield value(this.fn(v));
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
    if (v === undefined || !isArray(v)) return;
    const pe = { start: Math.floor(f.val), end: Math.ceil(t.val) };
    yield valueWithPath(e, v.slice(pe.start, pe.end), pe);
  }
}

class ArrayOp extends BaseGenerator0 {
  *handleInput(e: Value) {
    const v = e.val;
    if (v === undefined || !isArray(v)) throw error(201);
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
    if (isArray(input)) {
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

const literal = (a: unknown) => new LiteralOp(a);

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
    } else if (isArray(e) || typeof e === 'string') {
      yield value(e.length);
    } else if (!isNaN(Number(e))) {
      yield value(Math.abs(Number(e)));
    } else if (isObj(e)) {
      yield value(e instanceof Map ? e.size : Object.keys(e).length);
    }
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
    public readonly id: VarRefOp | string,
    node: Generator
  ) {
    super(node);
  }

  *handle(e: Value, [v]: [Value], context: Context) {
    context.bindings[this.getId()] = v;
    yield e;
  }

  public getId() {
    return typeof this.id === 'string' ? this.id : this.id.identifier;
  }
}

class UpdateAssignmentOp extends BaseGenerator2 {
  *handleInput(e: Value, context: Context) {
    const mod = new Modification(shallowClone(e.val ?? {}));

    const lh = [...this.generators[0].iterable([e], context)];
    for (const lhe of lh) {
      const r = one(this.generators[1].iterable([lhe], context));
      if (r === undefined) {
        mod.del(lhe.path!.slice(0, -1), lhe.path!.at(-1));
      } else {
        mod.set(lhe.path!, r.val);
      }
    }

    yield value(mod.apply());
  }
}

class AssignmentOp extends BaseGenerator2 {
  *handleInput(e: Value, context: Context) {
    const lh = [...this.generators[0].iterable([e], context)];
    for (const r of this.generators[1].iterable([e], context)) {
      const mod = new Modification(shallowClone(e.val ?? {}));
      for (const lhe of lh) {
        mod.set(lhe.path!, r.val);
      }
      yield value(mod.apply());
    }
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

class BaseArrayOp extends BaseGenerator1 {
  constructor(
    private readonly fn: ArrayFn,
    node: Generator = new IdentityOp()
  ) {
    super(node);
  }

  *handleInput(el: Value, context: Context): Iterable<Value> {
    if (!isArray(el.val)) return yield el;
    const res = this.fn(
      el.val.map(e => [e, exactOne(this.generators[0].iterable([value(e)], context)).val])
    );

    if (isTaggedType(res, 'single')) return yield value(res._val);

    return yield value(isArray(res) ? (this.fn(res) as [unknown, unknown][]).map(a => a[0]) : res);
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
    super(args.args[0], args.args[1] ?? literal(''));
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
  constructor(private readonly args: Generator[]) {
    super(args[0]);
  }

  *handle(val: Value, [index]: [Value<number>], context: Context) {
    const idx = safeNum(index.val);
    if (this.args.length === 1 && isArray(val.val)) {
      yield valueWithPath(val, val.val.at(idx), idx);
    } else if (this.args.length === 2) {
      yield iterNth(this.args[1].iterable([value(val.val)], context), idx) ?? value(undefined);
    }
  }
}

class FlattenOp extends BaseGenerator1<number> {
  *handle({ val: v }: Value, [arg]: [Value<number>]) {
    yield value(isArray(v) ? v.flat(arg.val) : v);
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
    yield value(isArray(v) ? v.map(e => this.fn(e, arg)) : this.fn(v, arg));
  }
}

class JoinOp extends BaseGenerator1<string> {
  *handle({ val: v }: Value, [r]: [Value<string>]) {
    yield value(isArray(v) ? v.join(r.val) : v);
  }
}

class KeysOp extends BaseGenerator0 {
  *handle({ val: el }: Value) {
    if (el && typeof el === 'object')
      yield value(
        Object.keys(el)
          .sort()
          .map(e => (isArray(el) ? Number(e) : e))
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
    } else if (isArray(v)) {
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
      } else if (isArray(a.val)) {
        yield value(
          isArray(v)
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
    const from = args[0].val as number;
    const to = args[1].val as number;
    const step = args[2].val as number;

    for (let i = from; step > 0 ? i < to : i > to; i += step) {
      yield value(i);
    }
  }
}

class Noop extends BaseGenerator0 {}

const mkEmptyOp = () =>
  new FnOp(() => {
    throw BACKTRACK_ERROR;
  });

class LimitOp extends BaseGenerator1 {
  constructor(private readonly node: ArgListOp) {
    super(node.args[0]);
  }

  *handle(el: Value, [M]: Value[], context: Context) {
    let limit = safeNum(M.val);
    if (limit > 0) {
      for (const e of this.node.args[1].iterable([el], context)) {
        yield e;
        if (--limit === 0) break;
      }
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

      yield* this.elseConsequent?.iterable([e], context) ?? [e];
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
    const mod = new Modification(shallowClone(input.val));

    for (const path of paths.val) {
      if (path.length === 0) return yield value(undefined);
      mod.del(path.slice(0, -1), path.at(-1));
    }

    yield value(mod.apply());
  }
}

class SetPathOp extends BaseGenerator2<PathElement[]> {
  constructor(n: ArgListOp) {
    super(n.args[0], n.args[1]);
  }

  *handle(input: Value, [path, v]: [Value<PathElement[]>, Value], _context: Context) {
    const mod = new Modification(shallowClone(input.val));
    mod.set(path.val, v.val);
    yield value(mod.apply());
  }
}

class ReduceOp extends BaseGenerator0 {
  constructor(
    private readonly sourceGen: VarBindingOp,
    private readonly initGen: Generator,
    private readonly opGen: Generator
  ) {
    super();
  }

  *handleInput(e: Value, context: Context): Iterable<Value> {
    const id = this.sourceGen.getId();
    const innerContext = { ...context, bindings: { ...context.bindings } };

    let acc = exactOne(this.initGen.iterable([e], innerContext));
    for (const s of this.sourceGen.generators[0].iterable([e], context)) {
      innerContext.bindings[id] = s;
      acc = exactOne(this.opGen.iterable([acc], innerContext));
    }

    yield acc;
  }
}

class PickOp extends BaseGenerator1 {
  *handleInput(e: Value, context: Context) {
    let dest: unknown = undefined;
    for (const { path: p } of this.generators[0].iterable([e], context)) {
      dest = setPath(dest, p!, evalPath(p!, e.val ?? {}));
    }
    yield value(dest);
  }
}

/** Parser ************************************************************************** */

const parsePathExpression = (
  tokenizer: Tokenizer,
  functions: Record<string, number>
): Generator => {
  const vars: Generator[] = [];
  const generators: Generator[] = [new IdentityOp()];

  const wsTokenizer = tokenizer.keepWS();
  wsTokenizer.accept('.');

  return boundLoop(() => {
    const token = wsTokenizer.peek();
    if (token.type === 'id' || token.type === 'str') {
      wsTokenizer.next();
      const s = token.type === 'str' ? token.s.slice(1, -1) : token.s;
      const strict = !wsTokenizer.accept('?');
      generators.push(new PropertyLookupOp(literal(s), strict));
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
        tokenizer.accept('catch') ? parseExpression(tokenizer, functions) : mkEmptyOp()
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
    } else if (tok.s === 'reduce') {
      tokenizer.next();

      const assignment = parseExpression(tokenizer, functions);
      verifyOpType(assignment, VarBindingOp);

      const [arg1, arg2] = parseArgList(tokenizer, functions);
      return new ReduceOp(assignment, arg1, arg2);

      /* LITERALS ************************************************************************** */
    } else if (tok.type === 'num') {
      return literal(Number(tokenizer.next().s));
    } else if (tok.s === '{') {
      const res = OObjects.parse(tokenizer);
      if (res.val.__generators) {
        return new ObjectTemplateOp(res.val);
      } else {
        return literal(res.val);
      }
    } else if (tok.type === 'str') {
      return literal(tokenizer.next().s.slice(1, -1));
    } else if (tok.s === 'null') {
      tokenizer.next();
      return literal(null);
    } else if (tok.s === 'false' || tok.s === 'true') {
      tokenizer.next();
      return literal(tok.s === 'true');

      /* FUNCTIONS ************************************************************************** */
    } else if (tok.type === 'id') {
      tokenizer.next();

      const argList = new ArgListOp(parseArgList(tokenizer, functions));

      const op = tok.s;
      const qOp = op + '/' + argList.args.length;

      if (qOp in FN_REGISTRY) {
        return FN_REGISTRY[qOp](argList);
      } else if (op in functions) {
        return new FunctionCallOp(op, argList);
      }

      throw error(210, qOp);
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

const parseArgList = (tokenizer: Tokenizer, functions: Record<string, number>): Generator[] => {
  if (!tokenizer.accept('(')) return [];
  //tokenizer.expect('(');
  const op = [];
  while (tokenizer.peek().s !== ')') {
    op.push(parseExpression(tokenizer, functions));
    if (!tokenizer.accept(';')) break;
  }
  tokenizer.expect(')');
  return op;
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
