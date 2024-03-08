/* eslint-disable @typescript-eslint/no-explicit-any */

/** Builtins *************************************************************************** */

const builtins = [
  'paths:path(..)|select(length > 0)',
  'map(f):[.[]|f]',
  'del(f):delpaths([path(f)])',
  'with_entries(f):to_entries|map(f)|from_entries',
  'arrays:select(type=="array")',
  'objects:select(type=="object")',
  'iterables:select(type|.=="array"or.=="object")',
  'scalars:select(type|.!="array"and.!="object")',
  'values:select(.!=null)',
  'nulls:select(.==null)',
  'booleans:select(type=="boolean")',
  'while(c;u):def _i:if c then ., (u|_i) else empty end;_i',
  'until(c;n):def _u:if c then . else (n|_u) end;_u',
  'transpose:[range(0;map(length)|max//0) as $i|[.[][$i]]]'
];

/** Error handling ********************************************************************* */

const BACKTRACK_ERROR = Symbol('backtrack');

class Break {
  constructor(public readonly label: string) {}
}

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
  205: 'Expected array-like object';
  206: 'Index cannot be negative';
  207: 'Expected var or destructable object';
  208: 'Expected var';
  210: 'Unknown function';
  301: 'Expected exactly one';
};

export const error = (code: keyof Errors, ...params: unknown[]) => {
  return new Error(`${code}: ${params.join(', ')}`);
};

type ConstructorTypeOf<T> = new (...args: any[]) => T;
function verifyOpType<T extends Generator>(
  op: Generator,
  type: ConstructorTypeOf<T>
): asserts op is T {
  if (!(op instanceof type)) throw error(204, type.name, op.constructor.name);
}

/** Utils ****************************************************************************** */

let lastId = 0;
const newid = () => `__${++lastId}`;

type Result<T> = { value?: T; done?: boolean };

const iterNth = <T>(iterable: Iterable<T>, n: number): Result<T> | undefined => {
  if (n < 0) return { value: [...iterable].at(n) };
  const iterator = iterable[Symbol.iterator]();

  while (n-- > 0) {
    if (iterator.next().done) return undefined;
  }
  return iterator.next();
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
  if (generators.length === 0) return yield value([]);
  for (const item of generators[idx].iter(input, context)) {
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
  if (arr.length !== 1) throw error(301);
  return arr[0];
};

const one = <T>(it: Iterable<T>): T | undefined => Array.from(it)[0];

const isArray = Array.isArray;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && !isArray(x);

/** Data types ************************************************************************* */

const asArray = (obj: unknown): unknown[] => {
  if (isArray(obj)) return obj;
  else if (typeof obj === 'string') return obj.split('');
  else {
    throw error(205, obj);
  }
};

const indices = (lvs: unknown, rvs: unknown) => {
  let fn: (start: number) => number;
  if (typeof lvs === 'string' && typeof rvs === 'string') {
    fn = c => lvs.indexOf(rvs, c);
  } else if (isArray(lvs) && !isArray(rvs)) {
    fn = c => lvs.indexOf(rvs, c);
  } else {
    const arr = asArray(lvs);
    const searchFor = asArray(rvs);
    fn = c => {
      for (let i = c; i < arr.length; i++) {
        // TODO: This is quite slow :)
        if (isEqual(arr.slice(i, i + searchFor.length), searchFor)) {
          return i;
        }
      }
      return -1;
    };
  }

  const res = [];
  let idx = -1;
  while ((idx = fn(idx + 1)) !== -1) {
    res.push(idx);
  }
  return res;
};

const repeat = (rvs: number, lvs: string) => (rvs < 0 || isNaN(rvs) ? undefined : lvs.repeat(rvs));

const multiply = (lvs: unknown, rvs: unknown) => {
  if (typeof lvs === 'string' && typeof rvs === 'number') {
    return repeat(rvs, lvs);
  }
  if (typeof lvs === 'number' && typeof rvs === 'string') {
    return repeat(lvs, rvs);
  }
  return (lvs as number) * (rvs as number);
};

const divide = (lvs: unknown, rvs: unknown) => {
  if (typeof lvs === 'string' && typeof rvs === 'string') {
    return lvs.split(rvs);
  }
  return (lvs as number) / (rvs as number);
};

const TYPE_ORDERING = ['false', 'true', 'number', 'string', 'array', 'object'];

const sortType = (a: unknown): string => {
  if (a === null || a === undefined) return 'null';
  if (isArray(a)) return 'array';
  return typeof a === 'boolean' ? a.toString() : typeof a;
};

const compare = (lvs: unknown, rvs: unknown): number => {
  if (lvs === rvs) return 0;

  const lvsType = sortType(lvs);
  const rvsType = sortType(rvs);

  if (lvsType === rvsType) {
    if (lvsType === 'number') return (lvs as number) - (rvs as number);
    if (lvsType === 'string') return (lvs as string).localeCompare(rvs as string);

    if (lvsType === 'array') {
      if ((lvs as unknown[]).length === 0 || (rvs as unknown[]).length === 0) {
        return (lvs as unknown[]).length - (rvs as unknown[]).length;
      }
      return (
        compare((lvs as unknown[])[0], (rvs as unknown[])[0]) ||
        compare((lvs as unknown[]).slice(1), (rvs as unknown[]).slice(1))
      );
    }

    if (lvsType === 'object') {
      const lkeys = Object.keys(lvs as Record<string, unknown>).sort(compare);
      const r = compare(lkeys, Object.keys(rvs as Record<string, unknown>).sort(compare));
      if (r !== 0) return r;

      for (const key of lkeys) {
        const r = compare((lvs as any)[key], (rvs as any)[key]);
        if (r !== 0) return r;
      }
      return 0;
    }
  }

  return TYPE_ORDERING.indexOf(lvsType) - TYPE_ORDERING.indexOf(rvsType);
};

const contains = (a: unknown, b: unknown): boolean => {
  if (typeof a === 'string' && typeof b === 'string') return a.includes(b);
  if (isArray(a) && isArray(b)) return b.every(e => a.some(k => contains(k, e)));
  if (isObj(a) && isObj(b)) {
    return Object.entries(b).every(([key, val]) => contains(prop(a, key), val));
  }
  return a === b;
};

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
  if (idx === '__proto__' || idx === 'constructor') throw error(202);
};

const prop = (lvs: unknown, idx: unknown) => {
  checkValidIdx(idx);

  if (isArray(lvs) && typeof idx === 'number') return lvs.at(idx);
  if (isObj(lvs)) {
    return lvs instanceof Map ? lvs.get(idx) : lvs[idx as string];
  }
  throw error(203, lvs);
};

const setProp = (lvs: unknown, idx: unknown, rvs: unknown) => {
  checkValidIdx(idx);

  if (isArray(lvs) && typeof idx === 'number') {
    lvs[idx < 0 ? lvs.length + idx : idx] = rvs;
  } else if (isObj(lvs)) {
    lvs instanceof Map ? lvs.set(idx, rvs) : (lvs[idx as string] = rvs);
  } else {
    throw error(203, lvs);
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
    if (Math.abs(idx) >= lvs.length) return;
    lvs.splice(idx, 1);
  } else if (isObj(lvs)) {
    lvs instanceof Map ? lvs.delete(idx) : delete lvs[idx as string];
  } else {
    throw error(203, lvs);
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
const setPath = <T>(base: T | undefined, path: PathElement[], val: unknown): T => {
  const dest = base ?? (mkObj(path.at(0)!) as T);
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
      const last = mod.path.at(-1);
      let arr = evalPath(mod.path.slice(0, -1), this.target);
      if (!arr) {
        if (mod.path.length <= 1) continue;

        arr = typeof last === 'number' ? [] : {};

        setPath(this.target, mod.path.slice(0, -1), arr);
      }
      setProp(arr, last, mod.val);
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

const every = (a: unknown[]) => a.every(b => !!b);
const some = (a: unknown[]) => a.some(b => !!b);

const FN_REGISTRY: Record<string, FnRegistration> = {
  '../0': () => new RecursiveDescentOp(),
  'abs/0': () => new FnOp(a => (typeof a === 'number' ? Math.abs(a) : a)),
  'add/0': () => new BaseArrayOp(Array_Add),
  'all/0': () => new AnyAllOp([], every),
  'all/1': a => new AnyAllOp(a.args, every),
  'all/2': a => new AnyAllOp(a.args, every),
  'any/0': () => new AnyAllOp([], some),
  'any/1': a => new AnyAllOp(a.args, some),
  'any/2': a => new AnyAllOp(a.args, some),
  'atan/0': () => new MathOp(Math.atan),
  'contains/1': arg => new Fn1Op(arg, (a, b) => contains(a, b)),
  'cos/0': () => new MathOp(Math.cos),
  'delpaths/1': a => new DelPathsOp(a),
  'empty/0': () => mkEmptyOp(),
  'endswith/1': a => new Fn1Op<string>(a, (a, b) => a.endsWith(b), true),
  'error/0': () => new ErrorOp(literal('')),
  'error/1': a => new ErrorOp(a),
  'first/0': () => new NthOp([literal(0)]),
  'first/1': a => new NthOp([literal(0), ...a.args]),
  'flatten/0': () => new FlattenOp(literal(100)),
  'flatten/1': a => new FlattenOp(a),
  'floor/0': () => new MathOp(Math.floor),
  'from_entries/0': () =>
    new FnOp(
      a =>
        isArray(a) &&
        Object.fromEntries(a.map(e => [e.name ?? e.Name ?? e.key ?? e.Key, e.value ?? e.Value]))
    ),
  'fromjson/0': () => new FnOp(a => JSON.parse(a as string)),
  'getpath/1': a => new GetPathOp(a),
  'group_by/1': a => new BaseArrayOp(Array_GroupBy, a),
  'has/1': arg => new Fn1Op(arg, (a, b) => (b as any) in (a as any)),
  'in/1': arg => new Fn1Op(arg, (a, b) => (a as any) in (b as any)),
  'IN/1': a => new INOp(new IdentityOp(), a.args[0]),
  'IN/2': a => new INOp(a.args[0], a.args[1]),
  'indices/1': a => new Fn1Op<string>(a, (a, b) => indices(a, b)),
  'index/1': a => new Fn1Op<string>(a, (a, b) => indices(a, b)[0]),
  'isnan/0': () => new FnOp(a => isNaN(a as number)),
  'join/1': a => new JoinOp(a),
  'keys/0': () => new KeysOp(),
  'last/0': () => new NthOp([literal(-1)], true),
  'last/1': a => new NthOp([literal(-1), ...a.args], true),
  'length/0': () => new LengthOp(),
  'fabs/0': () => new FnOp(a => (typeof a === 'number' ? Math.abs(a) : a)),
  'limit/2': a => new LimitOp(a),
  'ltrimstr/1': a => new Fn1Op<string>(a, (a, b) => (a.startsWith(b) ? a.slice(b.length) : a)),
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
  'reverse/0': () => new FnOp(a => (isArray(a) ? [...a].reverse() : a)),
  'rindex/1': a => new Fn1Op<string>(a, (a, b) => indices(a, b).at(-1)),
  'rtrimstr/1': a => new Fn1Op<string>(a, (a, b) => (a.endsWith(b) ? a.slice(0, -b.length) : a)),
  'select/1': a => new SelectOp(a),
  'setpath/2': a => new SetPathOp(a),
  'sin/0': () => new MathOp(Math.sin),
  'sort/0': () => new FnOp(a => (isArray(a) ? [...a].sort(compare) : a)),
  'sort_by/1': a => new BaseArrayOp(Array_SortBy, a),
  'split/1': a => new Fn1Op<string>(a, (a, b) => a.split(b)),
  'sqrt/0': () => new MathOp(Math.sqrt),
  'startswith/1': a => new Fn1Op<string>(a, (a, b) => a.startsWith(b), true),
  'test/1': a => new MatchOp(a, true),
  'test/2': a => new MatchOp(a, true),
  'to_entries/0': () =>
    new FnOp(a =>
      Object.entries(a as Record<string, unknown>).map(([k, v]) => ({ key: k, value: v }))
    ),
  'tojson/0': () => new FnOp(a => JSON.stringify(a)),
  'tonumber/0': () => new FnOp(a => Number(a)),
  'type/0': () => new FnOp(a => (isArray(a) ? 'array' : a === null ? 'null' : typeof a)),
  'unique/0': () => new BaseArrayOp(Array_Unique),
  'unique_by/1': a => new BaseArrayOp(Array_Unique, a)
};

const BINOP_REGISTRY: Record<string, BinaryOpRegistration> = {
  '+': (l, r) => new BinaryOp(l, r, add),
  '-': (l, r) => new BinaryOp(l, r, subtract),
  '%': (l, r) => new BinaryOp(l, r, (a, b) => (a as number) % (b as number)),
  '*': (l, r) => new BinaryOp(l, r, multiply),
  '/': (l, r) => new BinaryOp(l, r, divide),
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
    [',', '|'],
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

    if ((m = this.head.match(/^-?(nan|([\d]+(\.[\d]+)?(e-?\+?[\d]+)?))/))) {
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

type ArrayFn<T = unknown, R = unknown[]> = (
  arr: Array<{
    val: T;
    keys: unknown[];
  }>
) => R;

type FnDef = {
  arg?: string[];
  body: Generator[];
};

const isGenerator = (o: unknown): o is Generator => typeof o === 'object' && 'iter' in (o as any);

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
  iter(input: Iterable<Value>, context: Context): Iterable<Value>;
}

abstract class BaseGenerator<T extends Array<Value> = Value[]> implements Generator {
  constructor(public readonly generators: Generator[] = []) {}

  *iter(input: Iterable<Value>, context: Context): Iterable<Value> {
    try {
      for (const e of input) {
        yield* this.onInput(e, context);
      }
    } catch (e) {
      handleError(e);
    }
  }

  *onInput(e: Value, context: Context): Iterable<Value> {
    for (const args of iterateAll(this.generators, [e], context)) {
      yield* this.onElement(e, args.val as T, context);
    }
  }

  *onElement(_e: Value, _args: T, _context: Context): Iterable<Value> {
    // Do nothing
  }
}

abstract class BaseGenerator0 extends BaseGenerator<[]> {
  constructor() {
    super();
  }

  *onInput(e: Value, context: Context): Iterable<Value> {
    yield* this.onElement(e, [], context);
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

type PathAndValue = { path: PathElement[]; val: unknown };

export const OObjects = {
  parse: (tok: Tokenizer): PathAndValue[] => OObjects.parseNext(tok, []),

  parseString: (s: string): PathAndValue[] => OObjects.parse(new Tokenizer(s)),

  parseNext(tokenizer: Tokenizer, path: PathElement[]): PathAndValue[] {
    const tok = tokenizer.next();

    if (tok.type === 'str') {
      return [{ path, val: tok.s.slice(1, -1) }];
    } else if (tok.s === '.') {
      return [{ path, val: parsePathExpression(tokenizer, {}) }];
    } else if (tok.s === '$') {
      return [{ path, val: new VarRefOp('$' + tokenizer.next().s) }];
    } else if (tok.s === '{') {
      return OObjects.parseObject(tokenizer, path);
    } else if (tok.s === '(') {
      const e = parseExpression(tokenizer, {});
      tokenizer.expect(')');
      return [{ path, val: e }];
    } else if (tok.s === '[') {
      return OObjects.parseArray(tokenizer, path);
    } else if (tok.type === 'num') {
      return [{ path, val: Number(tok.s) }];
    } else if (tok.s === 'true' || tok.s === 'false') {
      return [{ path, val: tok.s === 'true' }];
    } else if (tok.type === 'id') {
      return [{ path, val: tok.s }];
    }

    throw error(102, tokenizer.head);
  },

  parseObject(s: Tokenizer, path: PathElement[]) {
    const arr: PathAndValue[] = [];

    let currentKey: any = undefined;

    while (!s.accept('}')) {
      if (currentKey) {
        arr.push(...OObjects.parseNext(s, [...path, currentKey]));

        s.accept(',');
        currentKey = undefined;
      } else {
        const tokenType = s.peek().type;
        const next = OObjects.parseNext(s, []);
        currentKey = next[0].val;

        if (!s.accept(':')) {
          currentKey = (
            currentKey instanceof VarRefOp ? currentKey.id.slice(1) : currentKey
          ) as any;

          next.forEach(e =>
            arr.push({
              val: tokenType === 'id' ? parsePathExpression(new Tokenizer('.' + e.val), {}) : e.val,
              path: [...path, currentKey, ...e.path]
            })
          );

          s.accept(',');
          currentKey = undefined;
        }
      }
    }

    return arr.length === 0 ? [{ path, val: {} }] : arr;
  },

  parseArray(s: Tokenizer, path: PathElement[]): PathAndValue[] {
    const arr: PathAndValue[] = [];

    while (!s.accept(']')) {
      arr.push(...OObjects.parseNext(s, [...path, arr.length]));
      s.accept(',');
    }

    return arr;
  }
};

/** Generators ********************************************************************* */

// TODO: Maybe there's a nicer way to make sure the PipeOp always branches to the right
class PipeOp implements Generator {
  constructor(
    private left: Generator,
    private right: Generator
  ) {
    if (left instanceof PipeOp) {
      this.left = left.left;
      this.right = new PipeOp(left.right, right);
    }
  }

  *iter(input: Iterable<Value>, context: Context) {
    try {
      yield* this.right.iter(this.left.iter(input, context), context);
    } catch (e) {
      if (e instanceof Break && this.left instanceof LabelOp && e.label === this.left.label) {
        return;
      }
      handleError(e);
    }
  }
}

class PathExp implements Generator {
  constructor(private readonly generators: Generator[]) {}

  *iter(input: Iterable<Value>, context: Context) {
    yield* this.generators.reduceRight((a, b) => new PipeOp(b, a)).iter(input, context);
  }
}

class MathOp extends BaseGenerator0 {
  constructor(private readonly fn: (a: number) => number) {
    super();
  }

  *onElement({ val: v }: Value) {
    yield value(this.fn(safeNum(v)));
  }
}

class FnOp extends BaseGenerator0 {
  constructor(private readonly fn: (a: unknown) => unknown) {
    super();
  }

  *onElement({ val: v }: Value) {
    yield value(this.fn(v));
  }
}

class AnyAllOp extends BaseGenerator0 {
  constructor(
    private readonly args: Generator[],
    private fn: (a: unknown[]) => boolean
  ) {
    super();
  }

  *onInput(e: Value, context: Context): any {
    const arr: Value[] = [];

    if (this.args.length <= 1) {
      if (!isArray(e.val)) throw error(201);
      arr.push(...e.val);
    } else {
      try {
        for (const v of this.args[0].iter([e], context)) {
          arr.push(v);
        }
      } catch (ex) {
        arr.push(value(false));
      }
    }

    return yield value(
      this.fn(
        arr.map(k =>
          this.args.length === 0 ? k : exactOne(this.args.at(-1)!.iter([k], context)).val
        )
      )
    );
  }
}

class Fn1Op<A = unknown, B = A> extends BaseGenerator1<B> {
  constructor(
    node: Generator,
    private readonly fn: (a: A, b: B) => unknown,
    private processArray = false
  ) {
    super(node);
  }

  *onElement({ val: v }: Value<A | A[]>, [{ val: arg }]: [Value<B>]) {
    yield value(
      this.processArray && isArray(v) ? v.map(e => this.fn(e, arg)) : this.fn(v as A, arg)
    );
  }
}

class IdentityOp extends BaseGenerator0 {
  *onElement(e: Value) {
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

  *onElement(e: Value, [identifier]: [Value<string>]): Iterable<Value> {
    try {
      yield valueWithPath(e, prop(e.val, identifier.val), identifier.val);
    } catch (err) {
      if (e.val === undefined) return yield valueWithPath(e, undefined, identifier.val);
      if (this.strict) throw err;
    }
  }
}

class ArraySliceOp extends BaseGenerator2<number, number> {
  constructor(
    r1: VarRefOp,
    r2: VarRefOp,
    private strict: boolean
  ) {
    super(r1, r2);
  }

  *onElement(e: Value, [f, t]: [Value<number>, Value<number>]): any {
    const v = e.val;
    if (!isArray(v) && typeof v !== 'string') {
      if (this.strict) throw error(203);
      return v === undefined ? yield value(undefined) : undefined;
    }
    const pe = {
      start: Math.floor(f.val),
      end: t.val === undefined ? v.length : Math.ceil(t.val)
    };
    yield valueWithPath(e, v.slice(pe.start, pe.end), pe);
  }
}

class ArrayOp extends BaseGenerator0 {
  constructor(private readonly strict: boolean) {
    super();
  }

  *onInput(e: Value) {
    const v = e.val;
    if (!isArray(v)) {
      if (this.strict) throw error(201);
      return;
    }
    for (let i = 0; i < v.length; i++) {
      yield valueWithPath(e, v[i], i);
    }
  }
}

class ConcatenationOp extends BaseGenerator2 {
  *onInput(e: Value, context: Context) {
    yield* this.generators[0].iter([e], context);
    yield* this.generators[1].iter([e], context);
  }
}

class ArrayConstructionOp extends BaseGenerator1 {
  *onInput(e: Value, context: Context) {
    yield value([...this.generators[0].iter([e], context)].map(k => k.val));
  }
}

class PathOp extends BaseGenerator1 {
  *onInput(e: Value, context: Context) {
    for (const v of this.generators[0].iter([e], context)) {
      yield value(v.path);
    }
  }
}

class RecursiveDescentOp extends BaseGenerator0 {
  *onInput(e: Value) {
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

  *onElement(_e: Value, [{ val: l }, { val: r }]: [Value, Value]) {
    yield value(this.fn(l, r));
  }
}

const literal = (a: unknown) => new LiteralOp(a);

class LiteralOp implements Generator {
  constructor(public readonly val: unknown) {}

  *iter() {
    yield value(this.val);
  }
}

class LengthOp extends BaseGenerator0 {
  *onInput({ val: e }: Value) {
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
  *onElement(_e: Value, [arg]: [Value]) {
    throw arg.val;
  }
}

class INOp extends BaseGenerator2 {
  *onInput(val: Value, context: Context) {
    const source = [...this.generators[0].iter([val], context)].map(e => e.val);
    const arg = [...this.generators[1].iter([val], context)].map(e => e.val);
    yield value(source.some(k => arg.includes(k)));
  }
}

class SelectOp extends BaseGenerator1<boolean> {
  *onElement(e: Value, [r]: [Value<boolean>]) {
    if (r.val) {
      yield e;
    }
  }
}

class VarBindingOp extends BaseGenerator1 {
  constructor(
    public readonly target: Generator | string,
    node: Generator
  ) {
    super(node);
  }

  *onElement(el: Value, [v]: [Value], context: Context) {
    this.getElement(context, v, el);

    yield el;
  }

  getElement(context: Context, v: Value, el: Value) {
    const id = this.getId();
    if (id !== undefined) {
      context.bindings[id] = v;
    } else if (this.target instanceof ObjectLiteralOp) {
      const resolvedValues = [...this.target.values];
      for (const v of resolvedValues) {
        v.path = v.path.map(e => (isGenerator(e) ? (one(e.iter([el], context))?.val as any) : e));
      }

      for (const pv of resolvedValues) {
        if (!(pv.val instanceof VarRefOp)) throw error(208);
        context.bindings[(pv.val as VarRefOp).id] = value(evalPath(pv.path, v.val));
      }
    } else {
      throw error(207);
    }
  }

  public getId(): string | undefined {
    return typeof this.target === 'string' ? this.target : (this.target as VarRefOp).id;
  }
}

/*
 To handle a situation like .[] | .a = 1
 .[] will yield val with a path starting with a number
 Similarly, evaluating .a in the context of this val, will also yield a path
 starting with a number

 TODO: Maybe there's a better way to handle this situation when evaluating the assignTo
       in the context of the val
*/
const normalizePath = (val: Value, assignTo: Value) =>
  typeof assignTo.path![0] === 'number' && val.path && typeof val.path![0] === 'number'
    ? assignTo.path!.slice(1)
    : assignTo.path!;

class UpdateAssignmentOp extends BaseGenerator2 {
  *onInput(e: Value, context: Context) {
    const mod = new Modification(shallowClone(e.val ?? {}));

    const lh = [...this.generators[0].iter([e], context)];
    for (const lhe of lh) {
      const r = one(this.generators[1].iter([lhe], context));
      if (r === undefined) {
        mod.del(lhe.path!.slice(0, -1), lhe.path!.at(-1));
      } else {
        mod.set(normalizePath(e, lhe), r.val);
      }
    }

    yield value(mod.apply());
  }
}

class AssignmentOp extends BaseGenerator2 {
  *onInput(e: Value, context: Context) {
    const lh = [...this.generators[0].iter([e], context)];
    for (const r of this.generators[1].iter([e], context)) {
      const mod = new Modification(shallowClone(e.val ?? {}));
      for (const lhe of lh) {
        mod.set(normalizePath(e, lhe), r.val);
      }
      yield value(mod.apply());
    }
  }
}

class ArgListOp implements Generator {
  constructor(public readonly args: Generator[]) {}

  *iter(input: Iterable<Value>, context: Context): Iterable<Value> {
    try {
      if (this.args.length === 1) {
        yield* this.args[0].iter(input, context);
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

  *onInput(el: Value, context: Context): Iterable<Value> {
    if (!isArray(el.val)) return yield el;
    const res = this.fn(
      el.val.map(e => ({
        val: e,
        keys: [...this.generators[0].iter([value(e)], context)].map(e => e.val)
      }))
    );

    for (const e of res) yield value(e);
  }
}

// TODO: Maybe repurpose in terms on sort
const Array_Unique: ArrayFn = arr => [
  arr
    .filter((e, i) => arr.findIndex(a => a.keys[0] === e.keys[0]) === i)
    .sort((a, b) => (a.keys[0] as number) - (b.keys[0] as number))
    .map(k => k.val)
];

const Array_Add: ArrayFn = arr => [
  arr.length === 0 ? undefined : arr.map(a => a.val).reduce((a, b) => add(a, b))
];

const Array_Min: ArrayFn = arr => [Array_SortBy(arr)[0].at(0)];

const Array_Max: ArrayFn = arr => [Array_SortBy(arr)[0].at(-1)];

const Array_GroupBy: ArrayFn = arr => {
  const dest: Record<string, unknown[]> = {};
  for (const e of arr) {
    dest[e.keys[0] as any] ??= [];
    dest[e.keys[0] as any].push(e.val);
  }
  return [Object.values(dest)];
};

const Array_SortBy: ArrayFn<unknown, [unknown[]]> = arr => [
  arr.sort((e1, e2) => compare(e1.keys, e2.keys)).map(e => e.val)
];

class MatchOp extends BaseGenerator2<string, string | undefined> {
  constructor(
    args: ArgListOp,
    private readonly onlyTest = false
  ) {
    super(args.args[0], args.args[1] ?? literal(''));
  }

  *onElement({ val: v }: Value<string>, [re, flags]: [Value<string>, Value<string | undefined>]) {
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
  constructor(
    private readonly args: Generator[],
    private allowNegative: boolean = false
  ) {
    super(args[0]);
  }

  *onElement(val: Value, [index]: [Value<number>], context: Context) {
    const idx = safeNum(index.val);
    if (!this.allowNegative && idx < 0) throw error(206);
    if (this.args.length === 1 && isArray(val.val)) {
      yield valueWithPath(val, val.val.at(idx), idx);
    } else if (this.args.length === 2) {
      const res = iterNth(this.args[1].iter([value(val.val)], context), idx);
      if (!res || res.done) return;
      yield res.value ?? value(undefined);
    }
  }
}

class FlattenOp extends BaseGenerator1<number> {
  *onElement({ val: v }: Value, [arg]: [Value<number>]) {
    if (arg.val < 0) throw error(206);
    yield value(isArray(v) ? v.flat(arg.val) : v);
  }
}

class ObjectLiteralOp extends BaseGenerator0 {
  constructor(public readonly values: PathAndValue[]) {
    super();
  }

  *onInput(el: Value, context: Context): Iterable<Value> {
    const resolvedValues = [...this.values];

    const generators: Generator[] = [];
    for (const v of resolvedValues) {
      v.path = v.path.map(e => (isGenerator(e) ? (one(e.iter([el], context))?.val as any) : e));

      if (isGenerator(v.val)) generators.push(v.val);
    }

    for (const a of iterateAll(generators, [el], context)) {
      yield value(
        resolvedValues.reduce(
          (dest, v) => setPath(dest, v.path, isGenerator(v.val) ? a.val.shift()!.val : v.val),
          {}
        )
      );
    }
  }
}

class JoinOp extends BaseGenerator1<string> {
  *onElement({ val: v }: Value, [r]: [Value<string>]) {
    yield value(isArray(v) ? v.join(r.val) : v);
  }
}

class KeysOp extends BaseGenerator0 {
  *onElement({ val: el }: Value) {
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
  *onInput({ val: v }: Value, context: Context): Iterable<Value> {
    if (isObj(v)) {
      yield value(
        Object.fromEntries(
          Object.entries(v).map(([k, v]) => [
            k,
            exactOne(this.generators[0].iter([value(v)], context)).val
          ])
        )
      );
    } else if (isArray(v)) {
      yield value(v.map(e => exactOne(this.generators[0].iter([value(e)], context)).val));
    } else {
      yield value(v);
    }
  }
}

class VarRefOp extends BaseGenerator0 {
  constructor(public readonly id: string) {
    super();
  }

  *onInput(_el: Value, context: Context) {
    yield context.bindings[this.id];
  }
}

class FunctionCallOp extends BaseGenerator0 {
  constructor(
    public readonly id: string,
    public readonly arg?: ArgListOp
  ) {
    super();
  }

  *onElement(input: Value, _: unknown, context: Context): Iterable<Value> {
    const fnDef = context.bindings[this.id].val as FnDef;

    const newBindings = { ...context.bindings };
    (fnDef.arg ?? []).forEach((a, idx) => {
      newBindings[a] = {
        val: {
          body: [this.arg!.args[idx]]
        }
      };
    });

    for (const b of fnDef.body) {
      if (b instanceof FunctionDefOp) {
        newBindings[b.id] = {
          val: {
            body: b.body
          }
        };
      }
    }

    yield* fnDef.body.at(-1)!.iter([input], {
      ...context,
      bindings: newBindings
    });
  }
}

class FunctionDefOp extends BaseGenerator0 {
  constructor(
    public readonly id: string,
    public readonly arg: string[],
    public readonly body: Generator[]
  ) {
    super();
  }

  // eslint-disable-next-line require-yield
  *onElement(_input: Value, _: [], context: Context) {
    context.bindings[this.id] = value({
      arg: this.arg,
      body: this.body
    });
  }
}

class RangeOp extends BaseGenerator {
  *onElement(_el: Value, args: Value[]): Iterable<Value> {
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

  *onElement(el: Value, [M]: Value[], context: Context) {
    let limit = safeNum(M.val);
    if (limit > 0) {
      for (const e of this.node.args[1].iter([el], context)) {
        yield e;
        if (--limit === 0) break;
      }
    }
  }
}

class ParenExpressionOp extends BaseGenerator1 {
  *onInput(e: Value, context: Context) {
    yield* this.generators[0].iter([e], { ...context, bindings: { ...context.bindings } });
  }
}

class TryCatchOp extends BaseGenerator {
  constructor(
    private readonly body: Generator,
    private readonly catchBody: Generator
  ) {
    super([body]);
  }

  *onInput(e: Value, context: Context): Iterable<Value> {
    try {
      yield* this.body.iter([e], context);
    } catch (err) {
      yield* this.catchBody.iter([value(err)], context);
    }
  }
}

class IfOp extends BaseGenerator {
  constructor(
    condition: Generator,
    private readonly ifBody: Generator,
    private readonly elifs: [Generator, Generator][],
    private readonly elseBody?: Generator
  ) {
    super([condition, ...elifs.map(e => e[0])]);
  }

  *onElement(e: Value, [ifCond, ...elifConds]: Value[], context: Context): Iterable<Value> {
    if (isTrue(ifCond.val)) {
      yield* this.ifBody.iter([e], context);
    } else {
      for (let idx = 0; idx < elifConds.length; idx++) {
        if (isTrue(elifConds[idx].val)) {
          return yield* this.elifs![idx][1].iter([e], context);
        }
      }

      yield* this.elseBody?.iter([e], context) ?? [e];
    }
  }
}

class GetPathOp extends BaseGenerator1<PathElement[]> {
  *onElement(input: Value, [path]: [Value<PathElement[]>], _context: Context): Iterable<Value> {
    yield value(evalPath(path.val, input.val as PathElement[]));
  }
}

class DelPathsOp extends BaseGenerator1<PathElement[][]> {
  *onElement(input: Value, [paths]: [Value<PathElement[][]>], _context: Context): Iterable<Value> {
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

  *onElement(input: Value, [path, v]: [Value<PathElement[]>, Value], _context: Context) {
    const mod = new Modification(shallowClone(input.val));
    mod.set(path.val, v.val);
    yield value(mod.apply());
  }
}

class ReduceOp extends BaseGenerator0 {
  constructor(
    private readonly source: VarBindingOp,
    private readonly init: Generator,
    private readonly op: Generator
  ) {
    super();
  }

  *onInput(e: Value, context: Context): Iterable<Value> {
    const innerContext = { ...context, bindings: { ...context.bindings } };

    let acc = exactOne(this.init.iter([e], innerContext));
    for (const s of this.source.generators[0].iter([e], context)) {
      this.source.getElement(innerContext, s, e);
      acc = exactOne(this.op.iter([acc], innerContext));
    }

    yield acc;
  }
}

class ForeachOp extends BaseGenerator0 {
  constructor(
    private readonly exp: VarBindingOp,
    private readonly init: Generator,
    private readonly update: Generator,
    private readonly extract?: Generator
  ) {
    super();
  }

  *onInput(e: Value, context: Context): Iterable<Value> {
    const innerContext = { ...context, bindings: { ...context.bindings } };

    let acc = exactOne(this.init.iter([e], innerContext));
    for (const s of this.exp.generators[0].iter([e], context)) {
      this.exp.getElement(innerContext, s, e);
      acc = exactOne(this.update.iter([acc], innerContext));
      yield this.extract ? exactOne(this.extract.iter([acc], innerContext)) : acc;
    }
  }
}

class LabelOp implements Generator {
  constructor(
    public readonly label: string,
    private readonly br = false
  ) {}

  *iter(input: Iterable<Value>) {
    if (this.br) throw new Break(this.label);
    yield* input;
  }
}

class PickOp extends BaseGenerator1 {
  *onInput(e: Value, context: Context) {
    let dest: unknown = undefined;
    for (const { path: p } of this.generators[0].iter([e], context)) {
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
        generators.push(new ArrayOp(!wsTokenizer.accept('?')));
      } else {
        tokenizer.strip();
        const e1 =
          tokenizer.peek().s === ']' || tokenizer.peek().s === ':'
            ? new LiteralOp(0)
            : parseExpression(tokenizer, functions);
        const e1Id = newid();
        vars.push(new VarBindingOp(e1Id, e1));

        if (wsTokenizer.peek().s === ':') {
          wsTokenizer.next();
          tokenizer.strip();

          const e2Id = newid();
          vars.push(
            new VarBindingOp(
              e2Id,
              tokenizer.peek().s === ']'
                ? new LiteralOp(undefined)
                : parseExpression(tokenizer, functions)
            )
          );

          wsTokenizer.expect(']');
          generators.push(
            new ArraySliceOp(new VarRefOp(e1Id), new VarRefOp(e2Id), !wsTokenizer.accept('?'))
          );
        } else {
          wsTokenizer.expect(']');
          generators.push(
            new PropertyLookupOp(
              new VarRefOp(e1Id),
              e1 instanceof LiteralOp && typeof e1.val === 'string'
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

const parseOperand = (
  tokenizer: Tokenizer,
  functions: Record<string, number>,
  lastOp: string = ''
): Generator => {
  try {
    const tok = tokenizer.peek();
    if (tok.s === '[' && lastOp !== 'as') {
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
        tokenizer.accept('catch') ? parseOperand(tokenizer, functions) : mkEmptyOp()
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

      const body: Generator[] = [];
      do {
        body.push(parseExpression(tokenizer, innerFunctions));
        tokenizer.accept(';');
      } while (body.at(-1) instanceof FunctionDefOp);

      return new FunctionDefOp(name.s, args, body);
    } else if (tok.s === 'reduce') {
      tokenizer.next();

      const assignment = parseExpression(tokenizer, functions);
      verifyOpType(assignment, VarBindingOp);

      const [arg1, arg2] = parseArgList(tokenizer, functions);
      return new ReduceOp(assignment, arg1, arg2);
    } else if (tok.s === 'foreach') {
      tokenizer.next();

      const exp = parseExpression(tokenizer, functions);
      verifyOpType(exp, VarBindingOp);

      const [init, update, extract] = parseArgList(tokenizer, functions);
      return new ForeachOp(exp, init, update, extract);
    } else if (tok.s === 'label') {
      tokenizer.next();
      return new LabelOp(tokenizer.next().s + tokenizer.next().s);
    } else if (tok.s === 'break') {
      tokenizer.next();
      return new LabelOp(tokenizer.next().s + tokenizer.next().s, true);

      /* LITERALS ************************************************************************** */
    } else if (tok.type === 'num') {
      return literal(Number(tokenizer.next().s));
    } else if (tok.s === '{' || tok.s === '[') {
      const res = OObjects.parse(tokenizer);
      return new ObjectLiteralOp(res);
    } else if (tok.type === 'str') {
      const value = tokenizer.next().s;

      if (value.includes('\\(')) {
        let r = value.slice(1) + tokenizer.head;
        const dest: Generator[] = [];

        while (r.includes('\\(')) {
          const idx = r.indexOf('\\(');
          dest.push(literal(r.slice(0, idx)));
          r = r.slice(idx + 2);
          tokenizer.head = r;
          dest.push(parseExpression(tokenizer, functions));
          r = tokenizer.head.slice(1);
        }

        dest.push(literal(r.slice(0, r.indexOf('"'))));
        tokenizer.head = r.slice(1);

        return dest.reduceRight((a, b) => new BinaryOp(b, a, add));
      }
      return literal(value.slice(1, -1));
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
  let left = parseOperand(tokenizer, functions, lastOp);
  if (left instanceof FunctionDefOp) return left;

  return boundLoop(() => {
    const tok = tokenizer.peek().s;

    if (tok === '[') {
      tokenizer.head = '| .' + tokenizer.head;
      return;
    }

    if (!!BINOP_REGISTRY[tok] && BINOP_ORDERING[tok] > (BINOP_ORDERING[lastOp] ?? 0)) {
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

export const parse = (query: string, includeBuiltins = true): Generator => {
  const functions = {};
  const op = includeBuiltins
    ? builtins.map(b => parseExpression(new Tokenizer(`def ` + b), functions))
    : [];

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
  for (const e of query.iter(input.map(value), {
    bindings: {
      ...Object.fromEntries(Object.entries(bindings ?? {}).map(([k, v]) => [k, value(v)])),
      $__loc__: value({ file: '<top-level>', line: 1 })
    }
  })) {
    yield e.val;
  }
}
