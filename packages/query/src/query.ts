/* eslint-disable @typescript-eslint/no-explicit-any */

const isArray = Array.isArray;
const isString = (s: unknown): s is string => typeof s === 'string';
const isNumber = (s: unknown): s is number => typeof s === 'number';
const isBoolean = (s: unknown): s is boolean => typeof s === 'boolean';
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && !isArray(x);

/** Builtins *************************************************************************** */

const builtins = [
  'select(f):if f then . else empty end',
  'paths:path(..)|select(length > 0)',
  'map(f):[.[]|f]',
  'del(f):delpaths([path(f)])',
  'with_entries(f):to_entries|map(f)|from_entries',
  'numbers:select(type=="number")',
  'arrays:select(type=="array")',
  'objects:select(type=="object")',
  'iterables:select(type|.=="array"or.=="object")',
  'scalars:select(type|.!="array"and.!="object")',
  'values:select(.!=null)',
  'nulls:select(.==null)',
  'booleans:select(type=="boolean")',
  'while(c;u):def _i:if c then .,(u|_i) else empty end;_i',
  'until(c;n):def _u:if c then . else (n|_u) end;_u',
  'transpose:[range(0;map(length)|max//0) as $i|[.[][$i]]]',
  'INDEX(s;ie):reduce s as $row ({};.[$row|ie|tostring] = $row)',
  'INDEX(ie):INDEX(.[];ie)',
  'JOIN($idx;ie):[.[]|[.,($idx[ie])]]',
  'JOIN($idx;stream;ie):stream|[.,$idx[ie]]',
  'JOIN($idx;stream;ie;je):stream|[.,$idx[ie]]|je',
  'IN(s):any(s==.;.)',
  'IN(src;s):any(src==s;.)',
  'join($x):reduce .[] as $i (null;(if .==null then "" else .+$x end)+($i|if type=="boolean" or type=="number" then tostring else .//"" end))//""',
  'isempty(g):first((g|false),true)',
  'inside(xs):. as $x|xs|contains($x)',
  'combinations:if length == 0 then [] else .[0][] as $x|(.[1:]|combinations) as $y|[$x]+$y end',
  'combinations(n):. as $dot|[range(n)|$dot]|combinations',
  'recurse(f):def r:.,(f|r);r',
  'recurse(f;cond):def r:.,(f|select(cond)|r);r',
  'recurse:recurse(.[]?)',
  'walk(f):def w:if type == "object" then map_values(w) elif type == "array" then map(w) else . end|f;w'
];

/** Error handling ********************************************************************* */

const BACKTRACK_ERROR = Symbol('backtrack');
const ANONYMOUS_ERROR = Symbol('anonymous');

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
  209: 'Expected negatable expression';
  210: 'Unknown function';
  211: 'Cannot divide by zero';
  212: 'Cannot set at index nan';
  213: 'Invalid type';
  214: 'Cannot index object by number';
  215: 'Cannot add';
  301: 'Expected exactly one';
};

export const error = (code: keyof Errors, ...params: unknown[]) =>
  new Error(`${code}: ${params.join(', ')}`);

const assertString = <T>(e: T): string => {
  if (!isString(e)) throw error(213, e);
  return e;
};

type ConstructorTypeOf<T> = new (...args: any[]) => T;
function assertOpType<T extends Generator>(
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
  if (n < 0) return { value: Array.from(iterable).at(n) };
  const iterator = iterable[Symbol.iterator]();

  while (n-- > 0) {
    if (iterator.next().done) return undefined;
  }
  return iterator.next();
};

// To ensure no infinite loops
const boundLoop = <T>(fn: () => T) => {
  let max = 1000;
  while (max-- > 0) {
    const res = fn();
    if (res) return res;
  }
  throw error(100);
};

const safeNum = (s: unknown) => (isNaN(Number(s)) ? 0 : Number(s));

const shallowClone = (v: unknown) => (isArray(v) ? [...v] : isObj(v) ? { ...v } : v);

function* iterateAll(
  generators: Generator[],
  input: Iterable<Value>,
  context: Bindings,
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

/** Data types ************************************************************************* */

const asArray = (obj: unknown): unknown[] => {
  if (isArray(obj)) return obj;
  else if (isString(obj)) return obj.split('');
  else throw error(205, obj);
};

const indices = (lvs: unknown, rvs: unknown) => {
  let fn: (start: number) => number;
  if (isString(lvs) && isString(rvs)) {
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

const deepMerge = (target: any, elm: any) => {
  const result: any = target;

  if (!isObj(result) || !isObj(elm)) return result;

  for (const key of Object.keys(elm)) {
    if (isObj(elm[key])) {
      result[key] ??= {};
      if (!isObj(result[key])) result[key] = elm[key];
      else deepMerge(result[key], elm[key]);
    } else if (elm[key] !== undefined) {
      result[key] = elm[key];
    }
  }

  return result;
};

const multiply = (lvs: unknown, rvs: unknown) => {
  if (isString(lvs) && isNumber(rvs)) return repeat(rvs, lvs);
  if (isNumber(lvs) && isString(rvs)) return repeat(lvs, rvs);
  if (isObj(lvs) && isObj(rvs)) return deepMerge(lvs, rvs);
  return (lvs as number) * (rvs as number);
};

const divide = (lvs: unknown, rvs: unknown) => {
  if (isString(lvs) && isString(rvs)) {
    return lvs.split(rvs);
  }
  if (rvs === 0) throw error(211);
  return (lvs as number) / (rvs as number);
};

const remainder = (a: unknown, b: unknown) => {
  if (b === 0) throw error(211);
  return (a as number) % (b as number);
};

const TYPE_ORDERING = ['false', 'true', 'number', 'string', 'array', 'object'];

const sortType = (a: unknown): string => {
  if (a === null || a === undefined) return 'null';
  if (isArray(a)) return 'array';
  return isBoolean(a) ? a.toString() : typeof a;
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
  if (isString(a) && isString(b)) return a.includes(b);
  if (isArray(a) && isArray(b)) return b.every(e => a.some(k => contains(k, e)));
  if (isObj(a) && isObj(b)) {
    return Object.entries(b).every(([key, val]) => contains(prop(a, key), val));
  }
  return a === b;
};

const add = (lvs: unknown, rvs: unknown) => {
  if (isArray(lvs) && isArray(rvs)) return [...lvs, ...rvs];
  if (isString(lvs) && isString(rvs)) return lvs + rvs;
  if (isObj(lvs) && isObj(rvs)) return { ...lvs, ...rvs };

  // TODO: Can we simplify this logic
  if ((lvs !== null && isObj(lvs)) || (rvs !== null && isObj(rvs)) || isArray(lvs) || isArray(rvs))
    throw error(215);
  if ((lvs === null || lvs === undefined) && (rvs === null || rvs === undefined)) return undefined;
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

  if (isArray(lvs) && isNumber(idx)) return isNaN(idx) ? undefined : lvs.at(idx);
  if (isObj(lvs)) {
    return lvs instanceof Map ? lvs.get(idx) : lvs[idx as string];
  }
  throw error(203, lvs);
};

const setProp = (lvs: unknown, idx: unknown, rvs: unknown) => {
  checkValidIdx(idx);

  if (isArray(lvs) && isNumber(idx)) {
    if (isNaN(idx)) throw error(212);
    if (idx < 0 && lvs.length + idx < 0) throw error(202);
    lvs[idx < 0 ? lvs.length + idx : Math.floor(idx)] = rvs;
  } else if (isObj(lvs)) {
    if (isNumber(idx)) throw error(214);
    if (lvs instanceof Map) {
      lvs.set(idx, rvs);
    } else {
      lvs[idx as string] = rvs;
    }
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

  if (isArray(lvs) && isNumber(idx)) {
    if (Math.abs(idx) >= lvs.length) return;
    lvs.splice(idx, 1);
  } else if (isObj(lvs)) {
    if (lvs instanceof Map) {
      lvs.delete(idx);
    } else {
      delete lvs[idx as string];
    }
  } else {
    throw error(203, lvs);
  }
};

const evalPath = (path: PathElement[], obj: unknown) => {
  let dest = obj;
  if (dest === undefined) return undefined;
  for (const e of path) {
    dest = propAndClone(dest, e);
    if (dest === undefined) return undefined;
  }
  return dest;
};

const mkObj = (p: PathElement) => (isNumber(p) ? [] : {});

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

        arr = isNumber(last) ? [] : {};

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
  'abs/0': () => new FnOp(a => (isNumber(a) ? Math.abs(a) : a)),
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
  'empty/0': () => new EmptyOp(),
  'endswith/1': a => new Fn1Op<string>(a, (a, b) => a.endsWith(b), true),
  'error/0': () => new ErrorOp(literal(ANONYMOUS_ERROR)),
  'error/1': a => new ErrorOp(a),
  'explode/0': () =>
    new FnOp(a =>
      assertString(a)
        .split('')
        .map(e => e.codePointAt(0))
    ),
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
  'implode/0': () => new FnOp(a => String.fromCodePoint(...(a as number[]))),
  'in/1': arg => new Fn1Op(arg, (a, b) => (a as any) in (b as any)),
  'indices/1': a => new Fn1Op<string>(a, (a, b) => indices(a, b)),
  'index/1': a => new Fn1Op<string>(a, (a, b) => (a === '' ? undefined : indices(a, b)[0])),
  'isnan/0': () => new FnOp(a => isNaN(a as number)),
  'keys/0': () => new KeysOp(),
  'last/0': () => new NthOp([literal(-1)], true),
  'last/1': a => new NthOp([literal(-1), ...a.args], true),
  'length/0': () => new LengthOp(),
  'utf8bytelength/0': () => new FnOp(a => new TextEncoder().encode(assertString(a)).length),
  'log2/0': () => new MathOp(Math.log2),
  'fabs/0': () => new FnOp(a => (isNumber(a) ? Math.abs(a) : a)),
  'limit/2': a => new LimitOp(a),
  'ltrimstr/1': a =>
    new Fn1Op<string>(a, (a, b) =>
      assertString(a).startsWith(assertString(b)) ? a.slice(b.length) : a
    ),
  'map_values/1': a => new MapValuesOp([a]),
  'match/1': a => new MatchOp(a),
  'match/2': a => new MatchOp(a),
  'max/0': () => new BaseArrayOp(Array_Max),
  'max_by/1': a => new BaseArrayOp(Array_Max, a),
  'min/0': () => new BaseArrayOp(Array_Min),
  'min_by/1': a => new BaseArrayOp(Array_Min, a),
  'not/0': () => new FnOp(a => !isTrue(a)),
  'nth/1': a => new NthOp(a.args),
  'nth/2': a => new NthOp(a.args),
  'path/1': a => new PathOp([a]),
  'pick/1': a => new PickOp([a]),
  'pow/2': arg => new Fn1Op<unknown, Value<number>[]>(arg, (_a, b) => Math.pow(b[0].val, b[1].val)),
  'range/1': a => new RangeOp([literal(0), a.args[0], literal(1)]),
  'range/2': a => new RangeOp([...a.args, literal(1)]),
  'range/3': a => new RangeOp(a.args),
  'reverse/0': () => new FnOp(a => (isArray(a) ? [...a].reverse() : a)),
  'rindex/1': a => new Fn1Op<string>(a, (a, b) => indices(a, b).at(-1)),
  'round/0': () => new MathOp(Math.round),
  'rtrimstr/1': a =>
    new Fn1Op<string>(a, (a, b) =>
      assertString(a).endsWith(assertString(b)) ? a.slice(0, -b.length) : a
    ),
  'setpath/2': a => new SetPathOp(a.args),
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
      Object.entries(a as Record<string, unknown>).map(([k, v]) => ({
        key: k,
        value: v
      }))
    ),
  'tojson/0': () => new FnOp(a => JSON.stringify(a)),
  'tonumber/0': () => new FnOp(a => Number(a)),
  'tostring/0': () => new FnOp(a => (isString(a) ? a : JSON.stringify(a))),
  'type/0': () => new FnOp(a => (isArray(a) ? 'array' : a === null ? 'null' : typeof a)),
  'unique/0': () => new BaseArrayOp(Array_Unique),
  'unique_by/1': a => new BaseArrayOp(Array_Unique, a)
};

const BINOP_REGISTRY: Record<string, BinaryOpRegistration> = {
  '+': (l, r) => new BinaryOp(l, r, add),
  '-': (l, r) => new BinaryOp(l, r, subtract),
  '%': (l, r) => new BinaryOp(l, r, remainder),
  '*': (l, r) => new BinaryOp(l, r, multiply),
  '/': (l, r) => new BinaryOp(l, r, divide),
  '//': (l, r) => new AlternativeOp([l, r]),
  '==': (l, r) => new BinaryOp(l, r, isEqual),
  '!=': (l, r) => new BinaryOp(l, r, isNotEqual),
  '>=': (l, r) => new BinaryOp(l, r, (a, b) => a >= b),
  '>': (l, r) => new BinaryOp(l, r, (a, b) => a > b),
  '<=': (l, r) => new BinaryOp(l, r, (a, b) => a <= b),
  '<': (l, r) => new BinaryOp(l, r, (a, b) => a < b),
  'and': (l, r) => new AndOp([l, r]),
  'or': (l, r) => new BinaryOp(l, r, (a, b) => !!(a || b)),
  '|': (l, r) => new PipeOp(l, r),
  ',': (l, r) => new ConcatenationOp([l, r]),
  'as': (l, r) => new VarBindingOp(r as VarRefOp | string, l),
  '|=': (l, r) => new UpdateAssignmentOp([l, r]),
  '=': (l, r) => new AssignmentOp([l, r]),
  '+=': (l, r) => new UpdateAssignmentOp([l, new BinaryOp(new IdentityOp(), r, add)]),
  '-=': (l, r) => new UpdateAssignmentOp([l, new BinaryOp(new IdentityOp(), r, subtract)]),
  '*=': (l, r) => new UpdateAssignmentOp([l, new BinaryOp(new IdentityOp(), r, multiply)]),
  '/=': (l, r) => new UpdateAssignmentOp([l, new BinaryOp(new IdentityOp(), r, divide)]),
  '%=': (l, r) => new UpdateAssignmentOp([l, new BinaryOp(new IdentityOp(), r, remainder)]),
  '//=': (l, r) => new UpdateAssignmentOp([l, new BinaryOp(new IdentityOp(), r, (a, b) => a ?? b)])
};

const BINOP_ORDERING = Object.fromEntries(
  [
    [';'],
    ['|'],
    [','],
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

  unget(t: Token) {
    this.head = t.s + this.head;
    return this;
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

  expect(s: string) {
    if (this.peek().s === s) return this.next(true);
    throw error(102, s, this.peek().s, this.head);
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
  bindings?: Bindings;
};

type Bindings = Record<string, Value>;

type PathElement = string | number | { start: number; end: number };

type Value<T = unknown> = {
  val: T;
  path?: PathElement[];
};

const value = <T>(v: T): Value<T> => ({ val: v });
const valueWithPath = <T>(p: Value<T>, v: T, pe: PathElement) => ({
  val: v,
  path: [...(p.path ?? []), pe]
});
const values = (v: unknown[]) => v.map(value);

interface Generator {
  iter(input: Iterable<Value>, context: Bindings): Iterable<Value>;
}

const isGenerator = (o: unknown): o is Generator => isObj(o) && 'iter' in (o as any);

abstract class BaseGenerator<T extends Array<Value> = Value[]> implements Generator {
  public readonly generators: Generator[];

  constructor(generators: Generator | Generator[] = []) {
    this.generators = isArray(generators) ? generators : [generators];
  }

  *iter(input: Iterable<Value>, context: Bindings): Iterable<Value> {
    try {
      for (const e of input) {
        yield* this.onInput(e, context);
      }
    } catch (e) {
      handleError(e);
    }
  }

  *onInput(e: Value, context: Bindings): Iterable<Value> {
    for (const args of iterateAll(this.generators, [e], context)) {
      yield* this.onElement(e, args.val as T, context);
    }
  }

  *onElement(_e: Value, _args: T, _context: Bindings): Iterable<Value> {
    // Do nothing
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
      return [{ path, val: parseOperand(tokenizer.unget(tok), {}) }];
    } else if (tok.s === '$') {
      return [{ path, val: new VarRefOp('$' + tokenizer.next().s) }];
    } else if (tok.s === '{') {
      return OObjects.parseObject(tokenizer, path);
    } else if (tok.s === '(') {
      return [{ path, val: parseTo(')', tokenizer, {}) }];
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
              val: tokenType === 'id' ? parseOperand(new Tokenizer('.' + e.val), {}) : e.val,
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

  *iter(input: Iterable<Value>, context: Bindings) {
    try {
      for (const e of this.left.iter(input, context)) {
        yield* this.right.iter([e], context);
      }
    } catch (e) {
      if (e instanceof Break && this.left instanceof LabelOp && e.label === this.left.label) {
        return;
      }
      handleError(e);
    }
  }
}

class Operand implements Generator {
  constructor(private readonly generators: Generator[]) {}

  *iter(input: Iterable<Value>, context: Bindings) {
    if (this.generators.length === 0) return;
    yield* this.generators.reduceRight((a, b) => new PipeOp(b, a)).iter(input, context);
  }
}

class FnOp extends BaseGenerator<[]> {
  constructor(private readonly fn: (a: unknown) => unknown) {
    super();
  }

  *onElement(v: Value) {
    yield value(this.fn(v.val));
  }
}

class MathOp extends FnOp {
  constructor(fn: (a: number) => number) {
    super(a => fn(safeNum(a)));
  }
}

class AnyAllOp extends BaseGenerator {
  constructor(
    args: Generator[],
    private fn: (a: unknown[]) => boolean
  ) {
    super(args);
  }

  *onInput(e: Value, context: Bindings): any {
    const arr: Value[] = [];

    if (this.generators.length <= 1) {
      if (!isArray(e.val)) throw error(201);
      arr.push(...e.val);
    } else {
      try {
        for (const v of this.generators[0].iter([e], context)) {
          arr.push(v);
        }
      } catch (ex) {
        arr.push(value(false));
      }
    }

    return yield value(
      this.fn(
        arr.map(k =>
          this.generators.length === 0
            ? k
            : exactOne(this.generators.at(-1)!.iter([k], context)).val
        )
      )
    );
  }
}

class Fn1Op<A = unknown, B = A> extends BaseGenerator<[Value<B>]> {
  constructor(
    node: Generator,
    private readonly fn: (a: A, b: B) => unknown,
    private processArray = false
  ) {
    super([node]);
  }

  *onElement({ val: v }: Value<A | A[]>, [{ val: arg }]: [Value<B>]) {
    yield value(
      this.processArray && isArray(v) ? v.map(e => this.fn(e, arg)) : this.fn(v as A, arg)
    );
  }
}

class IdentityOp extends BaseGenerator<[]> {
  *onElement(e: Value) {
    yield { val: e.val, path: e.path ?? [] };
  }
}

class PropertyLookupOp extends BaseGenerator<[Value<string>]> {
  *onElement(e: Value, [{ val: identifier }]: [Value<string>]): Iterable<Value> {
    yield valueWithPath(e, e.val === undefined ? undefined : prop(e.val, identifier), identifier);
  }
}

class ArraySliceOp extends BaseGenerator<[Value<number>, Value<number>]> {
  constructor(
    r1: VarRefOp,
    r2: VarRefOp,
    private strict: boolean
  ) {
    super([r1, r2]);
  }

  *onElement(e: Value, [f, t]: [Value<number>, Value<number>]): any {
    const v = e.val;
    if (!isArray(v) && !isString(v)) {
      if (this.strict) throw error(203);
      return v === undefined && (yield value(undefined));
    }
    const pe = {
      start: Math.floor(f.val),
      end: t.val === undefined || isNaN(t.val) ? v.length : Math.ceil(t.val)
    };
    yield valueWithPath(e, v.slice(pe.start, pe.end), pe);
  }
}

class ArrayOp extends BaseGenerator<[]> {
  *onInput(e: Value) {
    const v = e.val;
    if (isObj(v)) return yield* Object.values(v).map(value);
    if (!isArray(v)) throw error(201);

    for (let i = 0; i < v.length; i++) {
      yield valueWithPath(e, v[i], i);
    }
  }
}

class ConcatenationOp extends BaseGenerator<[Value, Value]> {
  *onInput(e: Value, context: Bindings) {
    yield* this.generators[0].iter([e], context);
    yield* this.generators[1].iter([e], context);
  }
}

class ArrayConstructionOp extends BaseGenerator<[Value]> {
  *onInput(e: Value, context: Bindings) {
    yield value(Array.from(this.generators[0].iter([e], context)).map(k => k.val));
  }
}

class PathOp extends BaseGenerator<[Value]> {
  *onInput(e: Value, context: Bindings) {
    yield* Array.from(this.generators[0].iter([e], context)).map(k => value(k.path));
  }
}

class RecursiveDescentOp extends BaseGenerator<[]> {
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

class AndOp extends BaseGenerator<[Value, Value]> {
  *onInput(e: Value, context: Bindings): Iterable<Value> {
    for (const left of this.generators[0].iter([e], context)) {
      if (!isTrue(left.val)) return yield value(false);
      for (const right of this.generators[1].iter([e], context)) {
        return yield value(isTrue(right.val));
      }
    }
  }
}

class BinaryOp extends BaseGenerator<[Value, Value]> {
  constructor(
    left: Generator,
    right: Generator,
    private readonly fn: (a: any, b: any) => any
  ) {
    super([left, right]);
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

class AlternativeOp extends BaseGenerator<[Value, Value]> {
  *onInput(e: Value, context: Bindings) {
    const res = [...this.generators[0].iter([e], context)];
    if (res.every(k => !k.val)) {
      yield* this.generators[1].iter([e], context);
    } else yield* res.filter(k => !!k.val);
  }
}

class LengthOp extends BaseGenerator<[]> {
  *onInput({ val: e }: Value) {
    if (e === undefined || e === null) {
      yield value(0);
    } else if (isArray(e) || isString(e)) {
      yield value(e.length);
    } else if (!isNaN(Number(e))) {
      yield value(Math.abs(Number(e)));
    } else if (isObj(e)) {
      yield value(e instanceof Map ? e.size : Object.keys(e).length);
    }
  }
}

class ErrorOp extends BaseGenerator<[Value]> {
  // eslint-disable-next-line require-yield
  *onElement(_e: Value, [arg]: [Value]) {
    throw arg.val;
  }
}

class VarBindingOp extends BaseGenerator<[Value]> {
  constructor(
    public readonly target: VarRefOp | ObjectLiteralOp | string,
    node: Generator
  ) {
    super([node]);
  }

  *onElement(el: Value, [v]: [Value], context: Bindings) {
    this.getElement(context, v, el);

    yield el;
  }

  getElement(context: Bindings, v: Value, el: Value) {
    const id = this.getId();
    if (id !== undefined) {
      context[id] = v;
    } else if (this.target instanceof ObjectLiteralOp) {
      const resolvedValues = [...this.target.values];
      for (const v of resolvedValues) {
        v.path = v.path.map(e => (isGenerator(e) ? (one(e.iter([el], context))?.val as any) : e));
      }

      for (const pv of resolvedValues) {
        if (!(pv.val instanceof VarRefOp)) throw error(208);
        context[pv.val.id] = value(evalPath(pv.path, v.val));
      }
    } else {
      throw error(207);
    }
  }

  public getId(): string | undefined {
    return isString(this.target) ? this.target : (this.target as VarRefOp).id;
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
  isNumber(assignTo.path![0]) && val.path && isNumber(val.path![0])
    ? assignTo.path!.slice(1)
    : assignTo.path!;

class UpdateAssignmentOp extends BaseGenerator<[Value, Value]> {
  *onInput(e: Value, context: Bindings) {
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

class AssignmentOp extends BaseGenerator<[Value, Value]> {
  *onInput(e: Value, context: Bindings) {
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

  *iter(input: Iterable<Value>, context: Bindings): Iterable<Value> {
    yield* this.args.length === 1
      ? this.args[0].iter(input, context)
      : iterateAll(this.args, input, context);
  }
}

class BaseArrayOp extends BaseGenerator<[Value]> {
  constructor(
    private readonly fn: ArrayFn,
    node: Generator = new IdentityOp()
  ) {
    super([node]);
  }

  *onInput(el: Value, context: Bindings): Iterable<Value> {
    if (!isArray(el.val)) return yield el;
    yield* this.fn(
      el.val.map(e => ({
        val: e,
        keys: [...this.generators[0].iter([value(e)], context)].map(e => e.val)
      }))
    ).map(value);
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

class MatchOp extends BaseGenerator<[Value<string>, Value<string | undefined>]> {
  constructor(
    args: ArgListOp,
    private readonly onlyTest = false
  ) {
    super([args.args[0], args.args[1] ?? literal('')]);
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

class NthOp extends BaseGenerator<[Value<number>]> {
  constructor(
    private readonly args: Generator[],
    private allowNegative: boolean = false
  ) {
    super([args[0]]);
  }

  *onElement(val: Value, [index]: [Value<number>], context: Bindings) {
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

class FlattenOp extends BaseGenerator<[Value<number>]> {
  *onElement({ val: v }: Value, [arg]: [Value<number>]) {
    if (arg.val < 0) throw error(206);
    yield value(isArray(v) ? v.flat(arg.val) : v);
  }
}

class ObjectLiteralOp extends BaseGenerator<[]> {
  constructor(public readonly values: PathAndValue[]) {
    super();
  }

  *onInput(el: Value, context: Bindings): Iterable<Value> {
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

class KeysOp extends BaseGenerator<[]> {
  *onElement({ val: el }: Value) {
    const transform = (e: unknown) => (isArray(el) ? Number(e) : e);
    yield el && typeof el === 'object' ? value(Object.keys(el).sort().map(transform)) : value(el);
  }
}

class MapValuesOp extends BaseGenerator<[Value]> {
  *onInput({ val: v }: Value, context: Bindings): Iterable<Value> {
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

class VarRefOp extends BaseGenerator<[]> {
  constructor(public readonly id: string) {
    super();
  }

  *onInput(_el: Value, context: Bindings) {
    yield context[this.id];
  }
}

class FunctionCallOp extends BaseGenerator<[]> {
  constructor(
    public readonly id: string,
    public readonly arg?: ArgListOp
  ) {
    super();
  }

  *onElement(input: Value, _: unknown, context: Bindings): Iterable<Value> {
    const fnDef = context[this.id + '/' + (this.arg?.args.length ?? 0)].val as FnDef;

    const newBindings = { ...context, ...(fnDef.bindings ?? {}) };

    (fnDef.arg ?? []).forEach((a, idx) => {
      newBindings[a + '/0'] = {
        val: {
          body: [this.arg!.args[idx]],
          bindings: context
        }
      };
    });

    for (const b of fnDef.body) {
      yield* b.iter([input], newBindings);
    }
  }
}

class FunctionDefOp extends BaseGenerator<[]> {
  constructor(
    public readonly id: string,
    public readonly args: string[],
    public readonly body: Generator[]
  ) {
    super();

    for (let i = args.length - 1; i >= 0; i--) {
      const arg = args[i];
      if (arg.startsWith('$')) {
        args[i] = arg.slice(1);
        body[body.length - 1] = new PipeOp(
          new VarBindingOp(new VarRefOp(arg), new FunctionCallOp(arg.slice(1), new ArgListOp([]))),
          body.at(-1)!
        );
      }
    }
  }

  // eslint-disable-next-line require-yield
  *onElement(_input: Value, _: [], context: Bindings) {
    context[this.id + '/' + this.args.length] = value({
      arg: this.args,
      body: this.body,
      bindings: { ...context }
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

class EmptyOp extends FnOp {
  constructor() {
    super(() => {
      throw BACKTRACK_ERROR;
    });
  }
}

class LimitOp extends BaseGenerator<[Value, Value]> {
  constructor(private readonly node: ArgListOp) {
    super([node.args[0]]);
  }

  *onElement(el: Value, [M]: Value[], context: Bindings) {
    let limit = safeNum(M.val);
    if (limit > 0) {
      for (const e of this.node.args[1].iter([el], context)) {
        yield e;
        if (--limit === 0) break;
      }
    }
  }
}

class ParenExpressionOp extends BaseGenerator<[Value]> {
  *onInput(e: Value, context: Bindings) {
    yield* this.generators[0].iter([e], { ...context });
  }
}

class TryCatchOp extends BaseGenerator {
  constructor(
    private readonly body: Generator,
    private readonly catchBody: Generator
  ) {
    super([body]);
  }

  *onInput(e: Value, context: Bindings): Iterable<Value> {
    try {
      yield* this.body.iter([e], context);
    } catch (err) {
      yield* this.catchBody.iter([err === ANONYMOUS_ERROR ? e : value(err)], context);
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

  *onElement(e: Value, [ifCond, ...elifConds]: Value[], context: Bindings): Iterable<Value> {
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

class GetPathOp extends BaseGenerator<[Value<PathElement[]>]> {
  *onElement(input: Value, [path]: [Value<PathElement[]>]): Iterable<Value> {
    yield {
      val: evalPath(path.val, input.val as PathElement[]),
      path: [...(input.path ?? []), ...path.val]
    };
  }
}

class DelPathsOp extends BaseGenerator<[Value<PathElement[][]>]> {
  *onElement(input: Value, [paths]: [Value<PathElement[][]>]): Iterable<Value> {
    const mod = new Modification(shallowClone(input.val));

    for (const path of paths.val) {
      if (path.length === 0) return yield value(undefined);
      mod.del(path.slice(0, -1), path.at(-1));
    }

    yield value(mod.apply());
  }
}

class SetPathOp extends BaseGenerator<[Value<PathElement[]>, Value<PathElement[]>]> {
  *onElement(input: Value, [path, v]: [Value<PathElement[]>, Value]) {
    const mod = new Modification(shallowClone(input.val));
    mod.set(path.val, v.val);
    yield value(mod.apply());
  }
}

class ReduceOp extends BaseGenerator<[]> {
  constructor(
    private readonly source: VarBindingOp,
    private readonly init: Generator,
    private readonly op: Generator
  ) {
    super();
  }

  *onInput(e: Value, context: Bindings): Iterable<Value> {
    const innerContext = { ...context };

    let acc = exactOne(this.init.iter([e], innerContext));
    for (const s of this.source.generators[0].iter([e], context)) {
      this.source.getElement(innerContext, s, e);
      acc = exactOne(this.op.iter([acc], innerContext));
    }

    yield acc;
  }
}

class ForeachOp extends BaseGenerator<[]> {
  constructor(
    private readonly exp: VarBindingOp,
    private readonly init: Generator,
    private readonly update: Generator,
    private readonly extract?: Generator
  ) {
    super();
  }

  *onInput(e: Value, context: Bindings): Iterable<Value> {
    const innerContext = { ...context };

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

class PickOp extends BaseGenerator<[Value]> {
  *onInput(e: Value, context: Bindings) {
    let dest: unknown = undefined;
    for (const { path: p } of this.generators[0].iter([e], context)) {
      dest = setPath(dest, p!, evalPath(p!, e.val ?? {}));
    }
    yield value(dest);
  }
}

class UnaryMinusOp extends BaseGenerator {
  *onElement(_e: Value, [r]: Value[]) {
    if (!isNumber(r.val)) throw error(209);
    yield value(-safeNum(r.val));
  }
}

/** Parser ************************************************************************** */

const parseDestructionTarget = (tokenizer: Tokenizer): Generator => {
  const tok = tokenizer.peek();

  if (tok.s === '[' || tok.s === '{') {
    return new ObjectLiteralOp(OObjects.parse(tokenizer));
  } else if (tokenizer.accept('$')) {
    return new VarRefOp('$' + tokenizer.next().s);
  }
  throw error(102, tokenizer.head);
};

const parseOperand = (tokenizer: Tokenizer, functions: Record<string, number>): Generator => {
  const vars: Generator[] = [];
  const gen: Generator[] = [];

  const bind = (g: Generator) => {
    const id = newid();
    vars.push(new VarBindingOp(id, g));
    return new VarRefOp(id);
  };

  boundLoop(() => {
    try {
      const tok = tokenizer.peek();

      if (tokenizer.accept('[')) {
        if (gen.length === 0) {
          gen.push(new ArrayConstructionOp([parseTo(']', tokenizer, functions)]));
        } else if (tokenizer.accept(']')) {
          gen.push(new ArrayOp());
        } else {
          const startId = bind(
            tokenizer.peek().s === ':' ? literal(0) : parseExpression(tokenizer, functions)
          );

          if (tokenizer.accept(':')) {
            const endId = bind(
              tokenizer.peek().s === ']'
                ? literal(undefined)
                : parseExpression(tokenizer, functions)
            );

            tokenizer.expect(']');
            gen.push(new ArraySliceOp(startId, endId, !tokenizer.accept('?')));
          } else {
            tokenizer.expect(']');
            gen.push(new PropertyLookupOp(startId));
          }
        }
      } else if (tokenizer.accept('?')) {
        gen[gen.length - 1] = new TryCatchOp(new Operand([gen.at(-1)!]), new EmptyOp());
      } else if (tokenizer.accept('(')) {
        gen.push(new ParenExpressionOp([parseTo(')', tokenizer, functions)]));
      } else if (tok.s === '.') {
        tokenizer.next(false);

        const tok = tokenizer.peek();
        if (tok.type === 'id' || tok.type === 'str') {
          tokenizer.next();
          gen.push(
            new PropertyLookupOp([literal(tok.type === 'str' ? tok.s.slice(1, -1) : tok.s)])
          );
        } else {
          gen.push(new IdentityOp());
        }
      } else if (tokenizer.accept('$')) {
        gen.push(new VarRefOp('$' + tokenizer.next().s));
      } else if (tokenizer.accept('try')) {
        const body = parseExpression(tokenizer, functions);
        gen.push(
          new TryCatchOp(
            body,
            tokenizer.accept('catch') ? parseOperand(tokenizer, functions) : new EmptyOp()
          )
        );
      } else if (tokenizer.accept('if')) {
        const condition = parseTo('then', tokenizer, functions);

        const ifConsequent = parseExpression(tokenizer, functions);

        const elifs: [Generator, Generator][] = [];

        boundLoop(() => {
          if (tokenizer.accept('elif')) {
            elifs.push([
              parseTo('then', tokenizer, functions),
              parseExpression(tokenizer, functions)
            ]);
          } else {
            if (tokenizer.accept('else')) {
              gen.push(
                new IfOp(condition, ifConsequent, elifs, parseTo('end', tokenizer, functions))
              );
            } else {
              tokenizer.expect('end');
              gen.push(new IfOp(condition, ifConsequent, []));
            }
            return true;
          }
        });
      } else if (tokenizer.accept('def')) {
        const name = tokenizer.next();

        const args: string[] = [];
        if (tokenizer.accept('(')) {
          while (tokenizer.peek().s !== ')') {
            const k = tokenizer.next().s;
            args.push(k === '$' ? k + tokenizer.next().s : k);
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

        gen.push(new FunctionDefOp(name.s, args, body));
        return true;
      } else if (tokenizer.accept('reduce')) {
        const assignment = parseExpression(tokenizer, functions);
        assertOpType(assignment, VarBindingOp);

        const [arg1, arg2] = parseArgList(tokenizer, functions);
        gen.push(new ReduceOp(assignment, arg1, arg2));
      } else if (tokenizer.accept('foreach')) {
        const exp = parseExpression(tokenizer, functions);
        assertOpType(exp, VarBindingOp);

        const [init, update, extract] = parseArgList(tokenizer, functions);
        gen.push(new ForeachOp(exp, init, update, extract));
      } else if (tokenizer.accept('label')) {
        gen.push(new LabelOp(tokenizer.next().s + tokenizer.next().s));
      } else if (tokenizer.accept('break')) {
        gen.push(new LabelOp(tokenizer.next().s + tokenizer.next().s, true));

        /* LITERALS ************************************************************************** */
      } else if (tok.type === 'num') {
        gen.push(literal(Number(tokenizer.next().s)));
      } else if (tok.s === '{') {
        gen.push(new ObjectLiteralOp(OObjects.parse(tokenizer)));
      } else if (tok.type === 'str') {
        const value = tokenizer.next().s;

        if (value.includes('\\(')) {
          let r = value.slice(1) + tokenizer.head;
          const dest: Generator[] = [];

          let idx = 0;
          while ((idx = r.indexOf('\\(')) >= 0) {
            dest.push(literal(r.slice(0, idx)));
            r = r.slice(idx + 2);
            tokenizer.head = r;
            dest.push(
              new PipeOp(
                parseExpression(tokenizer, functions),
                new FnOp(a => (isString(a) ? a : JSON.stringify(a)))
              )
            );
            r = tokenizer.head.slice(1);
          }

          dest.push(literal(r.slice(0, r.indexOf('"'))));
          tokenizer.head = r.slice(1);

          gen.push(dest.reduceRight((a, b) => new BinaryOp(b, a, add)));
        } else {
          gen.push(literal(value.slice(1, -1)));
        }
      } else if (tokenizer.accept('null')) {
        gen.push(literal(null));
      } else if (tokenizer.accept('infinite')) {
        gen.push(literal(Number.POSITIVE_INFINITY));
      } else if (tokenizer.accept('false')) {
        gen.push(literal(false));
      } else if (tokenizer.accept('true')) {
        gen.push(literal(true));

        /* FUNCTIONS ************************************************************************** */
      } else if (tok.type === 'id') {
        const origHead = tokenizer.head;
        tokenizer.next(false);

        const argList = new ArgListOp(parseArgList(tokenizer, functions));

        const op = tok.s;
        const qOp = op + '/' + argList.args.length;

        if (qOp in FN_REGISTRY) {
          gen.push(FN_REGISTRY[qOp](argList));
        } else if (op in functions) {
          gen.push(new FunctionCallOp(op, argList));
        } else {
          if (argList.args.length > 0 && op !== 'else') throw error(210, qOp);
          tokenizer.head = origHead;
          return true;
        }
      } else if (gen.length === 0 && tokenizer.accept('-')) {
        gen.push(new UnaryMinusOp([parseExpression(tokenizer, functions)]));
      } else {
        return true;
      }
    } finally {
      tokenizer.strip();
    }
  });

  if (vars.length === 0 && gen.length === 1) return gen[0];

  return new Operand([...vars, ...gen]);
};

const parseTo = (s: string, tokenizer: Tokenizer, functions: Record<string, number>) => {
  const d = parseExpression(tokenizer, functions);
  tokenizer.expect(s);
  return d;
};

const parseExpression = (
  tokenizer: Tokenizer,
  functions: Record<string, number>,
  lastOp: string = ''
): Generator => {
  let left = parseOperand(tokenizer, functions);
  if (left instanceof FunctionDefOp) return left;

  return boundLoop(() => {
    const tok = tokenizer.peek().s;

    if (!BINOP_REGISTRY[tok] || BINOP_ORDERING[tok] <= (BINOP_ORDERING[lastOp] ?? 0)) {
      return left;
    }

    const op = tokenizer.next().s;
    left = BINOP_REGISTRY[op](
      left,
      op === 'as' ? parseDestructionTarget(tokenizer) : parseExpression(tokenizer, functions, op)
    );
  });
};

const parseArgList = (tokenizer: Tokenizer, functions: Record<string, number>): Generator[] => {
  const op: Generator[] = [];
  if (!tokenizer.accept('(')) return op;
  while (!tokenizer.accept(')')) {
    op.push(parseExpression(tokenizer, functions));
    if (!tokenizer.accept(';')) break;
  }
  tokenizer.expect(')');
  return op;
};

let builtinsCache: Generator[] | undefined = undefined;
const builtinsCacheFunctions: Record<string, any> = {};

const initializeCache = () => {
  builtinsCache = builtins.map(b =>
    parseExpression(new Tokenizer(`def ${b}`), builtinsCacheFunctions)
  );
};

export const parse = (query: string, includeBuiltins = true): Generator => {
  if (includeBuiltins && !builtinsCache) initializeCache();

  const functions = includeBuiltins ? { ...builtinsCacheFunctions } : {};
  const op = includeBuiltins ? [...builtinsCache!] : [];

  const tokenizer = new Tokenizer(query);
  while (tokenizer.peek().type !== 'end') {
    const l = tokenizer.head.length;
    op.push(parseExpression(tokenizer, functions));
    if (l === tokenizer.head.length) throw error(103, tokenizer.head);
  }

  return op.reduceRight((a, b) => new ConcatenationOp([b, a]));
};

export const parseAndQuery = (q: string, input: unknown[], bindings?: Record<string, unknown>) => {
  return [...query(parse(q), input, bindings)];
};

export function* query(query: Generator, input: unknown[], bindings?: Record<string, unknown>) {
  for (const e of query.iter(values(input), {
    ...Object.fromEntries(Object.entries(bindings ?? {}).map(([k, v]) => [k, value(v)])),
    $__loc__: value({ file: '<top-level>', line: 1 })
  })) {
    yield e.val;
  }
}
