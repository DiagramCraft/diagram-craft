/* eslint-disable @typescript-eslint/no-explicit-any */
import { isObj } from './object.ts';
import { assert, NOT_IMPLEMENTED_YET, VERIFY_NOT_REACHED, VerifyNotReached } from './assert.ts';
import { isTaggedType, tag, TaggedType } from './types.ts';

const safeParseInt = (s: any) => {
  const n = Number(s);
  return isNaN(n) ? 0 : n;
};

type ResultSet = TaggedType<'resultSet', unknown[]>;

export const ResultSet = {
  of: (o: unknown): ResultSet => ({ _type: 'resultSet', _val: [o] }),
  ofList: (...o: unknown[]): ResultSet => ({ _type: 'resultSet', _val: o })
};

const eat = (remaining: string, s: string) => {
  if (remaining.startsWith(s)) return remaining.slice(s.length).trimStart();
  else return remaining;
};

const expect = (remaining: string, s: string) => {
  if (!remaining.startsWith(s)) throw new Error('Expect: ' + s);
  else return eat(remaining, s);
};

const isResultSet = (o: unknown): o is ResultSet => isTaggedType(o, 'resultSet');

const isOperator = (o: unknown): o is Operator => (o as any)?.evaluate;

interface Operator {
  evaluate(input: unknown): unknown;
}

interface Generator extends Operator {
  evaluate(input: unknown): ResultSet;
}

type OObjects = OObject | OBoolean | OArray | ONumber | OString | Operator;

export const OObjects = {
  parse(s: string): OObjects & { val(): unknown } {
    const r = OObjects.parseNext(s)[0];
    if (isOperator(r)) throw new Error();
    return r;
  },

  parseTemplate(s: string): OObjects {
    return OObjects.parseNext(s)[0];
  },

  parseNext(s: string): [OObjects, string] {
    if (s.startsWith('"')) {
      return OString.parse(s);
    } else if (s.startsWith('.')) {
      let end = 1;
      for (; end < s.length; end++) {
        if (s[end] === ',' || s[end] === '}' || s[end] === ' ' || s[end] === ':') break;
      }
      return [parse(s.slice(0, end)), s.slice(end)];
    } else if (s.startsWith('{')) {
      return OObject.parse(s);
    } else if (s.startsWith('(')) {
      const { sub } = parsePair(s, '(', ')');
      return [parse(sub.trim()), s.slice(sub.length + 2)];
    } else if (s.startsWith('[')) {
      return OArray.parse(s);
    } else if (s.match(/^[0-9].*/)) {
      return ONumber.parse(s);
    } else if (s.startsWith('true') || s.startsWith('false')) {
      return OBoolean.parse(s);
    } else {
      let end = 1;
      for (; end < s.length; end++) {
        if (!s[end].match(/^[a-zA-Z0-9_]/)) {
          break;
        }
      }
      return [new OString(s.slice(0, end)), s.slice(end)];
    }
  }
};

export class OObject {
  entries: [OString | Operator, OObjects][] = [];

  constructor(entries?: [OString | Operator, OObjects][]) {
    this.entries = entries ?? [];
  }

  static parse(s: string): [OObject, string] {
    const { sub } = parsePair(s, '{', '}');

    const obj = new OObject();

    let currentKey: OString | Operator | undefined = undefined;
    let remaining = sub.trim();

    while (remaining.length > 0) {
      const [entry, r] = OObjects.parseNext(remaining);
      remaining = r.trim();

      if (entry instanceof OString || isOperator(entry)) {
        if (currentKey) {
          obj.entries.push([currentKey, entry]);
          currentKey = undefined;
          remaining = eat(remaining, ',');
        } else {
          currentKey = entry;
          remaining = expect(remaining, ':');
        }
      } else if (entry instanceof OArray || entry instanceof ONumber || entry instanceof OBoolean) {
        assert.present(currentKey);
        obj.entries.push([currentKey, entry]);
        currentKey = undefined;
        remaining = eat(remaining, ',');
      } else {
        VERIFY_NOT_REACHED();
      }
    }

    return [obj, remaining];
  }

  val() {
    const dest: any = {};
    for (const [k, v] of this.entries) {
      if (isOperator(k) || isOperator(v)) throw new Error();
      dest[k.val()] = v.val();
    }
    return dest;
  }
}

export class OString {
  value: string;

  constructor(value: string) {
    this.value = value;
  }

  static parse(s: string): [OString, string] {
    let end = 1;
    for (; end < s.length; end++) {
      if (s[end] === '"') break;
    }

    return [new OString(s.slice(1, end)), s.slice(end + 1)];
  }

  val() {
    return this.value;
  }
}

export class OBoolean {
  value: boolean;

  constructor(value: boolean) {
    this.value = value;
  }

  static parse(s: string): [OBoolean, string] {
    if (s.startsWith('true')) {
      return [new OBoolean(true), s.slice(4)];
    } else if (s.startsWith('false')) {
      return [new OBoolean(false), s.slice(5)];
    } else {
      throw new VerifyNotReached();
    }
  }

  val() {
    return this.value;
  }
}

export class OArray {
  value: OObjects[] = [];

  constructor(value?: OObjects[]) {
    this.value = value ?? [];
  }

  static parse(s: string): [OArray, string] {
    const { sub } = parsePair(s, '[', ']');

    const arr = new OArray();

    let remaining = sub.trim();

    while (remaining.length > 0) {
      const [next, r] = OObjects.parseNext(remaining);
      remaining = r.trim();

      arr.value.push(next);

      if (remaining.startsWith(',')) remaining = eat(remaining, ',');
      else break;
    }

    return [arr, s.slice(sub.length + 2).trim()];
  }

  val(): unknown[] {
    return this.value.map(e => {
      if (isOperator(e)) throw new Error();
      return e.val();
    });
  }
}

export class ONumber {
  value: number;

  constructor(value: number) {
    this.value = value;
  }

  static parse(s: string): [ONumber, string] {
    let end = 0;
    for (; end < s.length; end++) {
      if (!s[end].match(/[0-9]/)) break;
    }

    return [new ONumber(Number(s.slice(0, end))), s.slice(end)];
  }

  val() {
    return this.value;
  }
}

export class PropertyLookupOp implements Operator {
  public readonly strict: boolean;
  public readonly identifier: string;

  constructor(identifier: string) {
    this.strict = !identifier.endsWith('?');
    this.identifier = identifier.replace(/\?$/, '');
  }

  evaluate(input: unknown): unknown {
    if (this.identifier === '') return input;
    if (this.strict && !isObj(input) && input !== undefined) throw new Error();
    assert.false(this.identifier === '__proto__' || this.identifier === 'constructor');
    if (!isObj(input)) return undefined;

    if (input instanceof Map) {
      return input.get(this.identifier);
    } else {
      return (input as any)[this.identifier];
    }
  }
}

export class ArrayIndexOp implements Operator {
  constructor(private readonly index: number) {}

  evaluate(input: unknown): unknown {
    if (input === undefined || !Array.isArray(input)) return undefined;
    return input[this.index];
  }
}

export class ArraySliceOp implements Operator {
  constructor(
    private readonly from: number,
    private readonly to: number
  ) {}

  evaluate(i: unknown): unknown {
    if (i === undefined || !Array.isArray(i)) return undefined;
    return i.slice(this.from, Math.min(this.to, i.length));
  }
}

export class ArrayGenerator implements Generator {
  constructor() {}

  evaluate(i: unknown): ResultSet {
    assert.true(Array.isArray(i));
    return ResultSet.ofList(...(i as unknown[]));
  }
}

export class ConcatenationGenerator implements Generator {
  constructor(public readonly nodes: Operator[]) {}

  evaluate(input: unknown): ResultSet {
    const dest: unknown[] = [];
    for (const n of this.nodes) {
      const r = n.evaluate(input);
      if (isResultSet(r)) {
        dest.push(...r._val);
      } else {
        dest.push(r);
      }
    }
    return ResultSet.ofList(...dest);
  }
}

export class PipeGenerator implements Generator {
  constructor(public readonly nodes: Operator[]) {}

  evaluate(input: unknown): ResultSet {
    let v = [input];
    for (const node of this.nodes) {
      const dest: unknown[] = [];
      for (const e of v) {
        const res = node.evaluate(e);
        if (isResultSet(res)) {
          dest.push(...res._val);
        } else {
          dest.push(res);
        }
      }
      v = dest;
    }
    return ResultSet.ofList(...v.filter(e => e !== undefined));
  }
}

export class ArrayConstructor implements Operator {
  constructor(public readonly node: Operator) {}

  evaluate(input: unknown): unknown {
    const v = this.node.evaluate(input);
    if (isResultSet(v)) {
      return [...v._val];
    } else {
      return [v];
    }
  }
}

export class RecursiveDescentGenerator implements Generator {
  constructor() {}

  evaluate(input: unknown): ResultSet {
    const dest: unknown[] = [];
    this.recurse(input, dest);
    return ResultSet.ofList(...dest);
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

export class AdditionBinaryOp implements Operator {
  constructor(
    public readonly left: Operator,
    public readonly right: Operator
  ) {}

  evaluate(input: unknown): unknown {
    const lvs = this.left.evaluate(input);
    const rvs = this.right.evaluate(input);

    if (Array.isArray(lvs) && Array.isArray(rvs)) {
      return [...lvs, ...rvs];
    } else if (isObj(lvs) && isObj(rvs)) {
      return { ...lvs, ...rvs };
    } else {
      return safeParseInt(lvs) + safeParseInt(rvs);
    }
  }
}

export class SubtractionBinaryOp implements Operator {
  constructor(
    public readonly left: Operator,
    public readonly right: Operator
  ) {}

  evaluate(input: unknown): unknown {
    const lvs = this.left.evaluate(input);
    const rvs = this.right.evaluate(input);

    if (Array.isArray(lvs) && Array.isArray(rvs)) {
      return lvs.filter(e => !rvs.includes(e));
    } else if (isObj(lvs) && isObj(rvs)) {
      return Object.fromEntries(Object.entries(lvs).filter(([k]) => !Object.keys(rvs).includes(k)));
    } else {
      return safeParseInt(lvs) - safeParseInt(rvs);
    }
  }
}

export class SimpleBinaryOp implements Operator {
  constructor(
    public readonly left: Operator,
    public readonly right: Operator,
    public readonly fn: (a: unknown, b: unknown) => unknown
  ) {}

  evaluate(input: unknown): unknown {
    const lvs = this.left.evaluate(input);
    const rvs = this.right.evaluate(input);
    return this.fn(lvs, rvs);
  }
}

class Literal implements Operator {
  constructor(public readonly value: unknown) {}

  evaluate(_input: unknown): unknown {
    return this.value;
  }
}

class LengthFilter implements Operator {
  constructor() {}

  evaluate(input: unknown): unknown {
    if (input === undefined || input === null) {
      return 0;
    } else if (Array.isArray(input) || typeof input === 'string') {
      return input.length;
    } else if (!isNaN(Number(input))) {
      return Math.abs(Number(input));
    } else if (isObj(input)) {
      return Object.keys(input).length;
    } else {
      return undefined;
    }
  }
}

class HasFn implements Operator {
  constructor(public readonly node: Operator) {}

  evaluate(input: unknown): unknown {
    assert.present(this.node);
    const res = this.node.evaluate(undefined);
    return (res as string | number) in (input as any);
  }
}

class InFn implements Operator {
  constructor(public readonly node: Operator) {}

  evaluate(input: unknown): unknown {
    assert.present(this.node);
    const res = this.node.evaluate(ResultSet.of(undefined));
    return (input as any) in (res as any);
  }
}

class SelectFn implements Operator {
  constructor(public readonly node: Operator) {}

  evaluate(input: unknown): unknown {
    assert.present(this.node);
    if (this.node.evaluate(input) === true) return input;
  }
}

class EqualsBinaryOp implements Operator {
  constructor(
    private readonly left: Operator,
    private readonly right: Operator,
    private readonly negate: boolean
  ) {}

  evaluate(input: unknown): unknown {
    const lvs = this.left.evaluate(input);
    const rvs = this.right.evaluate(input);

    if (Array.isArray(lvs) && Array.isArray(rvs)) {
      throw NOT_IMPLEMENTED_YET();
    } else if (isObj(lvs) && isObj(rvs)) {
      throw NOT_IMPLEMENTED_YET();
    } else {
      return this.negate ? lvs !== rvs : lvs === rvs;
    }
  }
}

class CmpBinaryOp implements Operator {
  constructor(
    private readonly left: Operator,
    private readonly right: Operator,
    private readonly cmp: (a: unknown, b: unknown) => boolean | any
  ) {}

  evaluate(input: unknown): unknown {
    const lvs = this.left.evaluate(input);
    const rvs = this.right.evaluate(input);
    return !!this.cmp(lvs, rvs);
  }
}

class AnyFilter implements Operator {
  evaluate(input: unknown): unknown {
    return Array.isArray(input) && input.some(a => !!a);
  }
}

class AllFilter implements Operator {
  evaluate(input: unknown): unknown {
    return Array.isArray(input) && input.every(a => !!a);
  }
}

type ArrayFn = (arr: [unknown, unknown][]) => [unknown, unknown][] | TaggedType<'single', unknown>;

class ArrayFilter implements Operator {
  constructor(
    private readonly node: Operator,
    private readonly fn: ArrayFn
  ) {}

  evaluate(input: unknown): unknown {
    if (Array.isArray(input)) {
      const res = this.fn(input.map(e => [e, this.node.evaluate(e)]));
      if (isTaggedType(res, 'single')) return res._val;
      if (Array.isArray(res)) return res.map(a => a[0]);
      else return res;
    }
    return input;
  }
}

const ArrayFilterFns: Record<string, ArrayFn> = {
  UNIQUE: arr => arr.filter((e, i) => arr.findIndex(a => a[1] === e[1]) === i),
  MIN: arr => {
    const min = Math.min(...arr.map(a => Number(a[1])));
    return tag('single', arr.find(a => a[1] === min)![0]);
  },
  MAX: arr => {
    const max = Math.max(...arr.map(a => Number(a[1])));
    return tag('single', arr.find(a => a[1] === max)![0]);
  },
  GROUP_BY: arr => {
    const dest: Record<string, unknown[]> = {};
    for (const [k, v] of arr) {
      dest[v as any] ??= [];
      dest[v as any].push(k);
    }
    return tag('single', Object.values(dest));
  },
  FLATTEN: arr => {
    const dest: unknown[] = arr.map(a => a[0]).flat();
    return tag('single', dest);
  }
};

class StringFn implements Operator {
  constructor(
    private readonly node: Operator,
    private readonly fn: (a: string, b: string) => unknown
  ) {}

  evaluate(input: unknown): unknown {
    const lvs = input;
    const rvs = this.node.evaluate(undefined);
    if (Array.isArray(lvs)) return lvs.map(a => this.fn(a as string, rvs as string));
    return this.fn(lvs as string, rvs as string);
  }
}

class JoinFn implements Operator {
  constructor(private readonly node: Operator) {}

  evaluate(input: unknown): unknown {
    const rvs = this.node.evaluate(undefined);
    if (Array.isArray(input)) return input.join(rvs as string);
    return input;
  }
}

class AbsFilter implements Operator {
  evaluate(input: unknown): unknown {
    if (typeof input === 'number') return Math.abs(input);
    return input;
  }
}

class KeysFilter implements Operator {
  evaluate(input: unknown): unknown {
    if (input && typeof input === 'object') return Object.keys(input).sort();
    return input;
  }
}

class MapValuesFn implements Operator {
  constructor(public readonly node: Operator) {}

  evaluate(input: unknown): unknown {
    assert.present(this.node);
    if (isObj(input)) {
      return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, this.node.evaluate(v)]));
    }
    return input;
  }
}

class ContainsFn implements Operator {
  constructor(public readonly node: Operator) {}

  evaluate(input: unknown): unknown {
    assert.present(this.node);
    const cv = this.node.evaluate(undefined);

    if (typeof cv === 'string') {
      return typeof input === 'string' ? input.includes(cv) : false;
    } else if (Array.isArray(cv)) {
      return Array.isArray(input) ? cv.every(e => input.some(v => v.includes(e))) : false;
    }

    // TODO: We don't support contains for objects yet
    return false;
  }
}

const parsePair = (q: string, left: string, right: string) => {
  let depth = 0;
  let end = 0;
  for (; end < q.length; end++) {
    if (q[end] === left) depth++;
    else if (q[end] === right) {
      depth--;
      if (depth === 0) break;
    }
  }
  assert.true(depth === 0);

  const sub = q.slice(1, end).trim();
  return { end, sub };
};

type FnRegistration =
  | { args: '0'; fn: () => Operator }
  | { args: '1'; fn: (arg: Operator) => Operator }
  | { args: '0&1'; fn: (arg: Operator | undefined) => Operator };
type BinaryOpRegistration = (l: Operator, r: Operator) => Operator;

const FN_REGISTRY: Record<string, FnRegistration> = {
  length: { args: '0', fn: () => new LengthFilter() },
  has: { args: '1', fn: a => new HasFn(a) },
  in: { args: '1', fn: a => new InFn(a) },
  map: { args: '1', fn: a => new ArrayConstructor(new PipeGenerator([new ArrayGenerator(), a])) },
  map_values: { args: '1', fn: a => new MapValuesFn(a) },
  select: { args: '1', fn: a => new SelectFn(a) },
  any: { args: '0', fn: () => new AnyFilter() },
  all: { args: '0', fn: () => new AllFilter() },
  unique_by: { args: '1', fn: a => new ArrayFilter(a, ArrayFilterFns.UNIQUE) },
  unique: { args: '0', fn: () => new ArrayFilter(new PropertyLookupOp(''), ArrayFilterFns.UNIQUE) },
  min_by: { args: '1', fn: a => new ArrayFilter(a, ArrayFilterFns.MIN) },
  min: { args: '0', fn: () => new ArrayFilter(new PropertyLookupOp(''), ArrayFilterFns.MIN) },
  max_by: { args: '1', fn: a => new ArrayFilter(a, ArrayFilterFns.MAX) },
  max: { args: '0', fn: () => new ArrayFilter(new PropertyLookupOp(''), ArrayFilterFns.MAX) },
  group_by: { args: '1', fn: a => new ArrayFilter(a, ArrayFilterFns.GROUP_BY) },
  startswith: { args: '1', fn: a => new StringFn(a, (a, b) => a.startsWith(b)) },
  endswith: { args: '1', fn: a => new StringFn(a, (a, b) => a.endsWith(b)) },
  abs: { args: '0', fn: () => new AbsFilter() },
  keys: { args: '0', fn: () => new KeysFilter() },
  split: { args: '1', fn: a => new StringFn(a, (a, b) => a.split(b)) },
  join: { args: '1', fn: a => new JoinFn(a) },
  contains: { args: '1', fn: a => new ContainsFn(a) },
  flatten: { args: '0', fn: () => new ArrayFilter(new Literal(1), ArrayFilterFns.FLATTEN) }
};

const BINOP_REGISTRY: Record<string, BinaryOpRegistration> = {
  '+': (l, r) => new AdditionBinaryOp(l, r),
  '-': (l, r) => new SubtractionBinaryOp(l, r),
  '%': (l, r) => new SimpleBinaryOp(l, r, (a, b) => safeParseInt(a) % safeParseInt(b)),
  '//': (l, r) => new SimpleBinaryOp(l, r, (a, b) => a ?? b),
  '==': (l, r) => new EqualsBinaryOp(l, r, false),
  '!=': (l, r) => new EqualsBinaryOp(l, r, true),
  '>=': (l, r) => new CmpBinaryOp(l, r, (a: any, b: any) => a >= b),
  '>': (l, r) => new CmpBinaryOp(l, r, (a: any, b: any) => a > b),
  '<=': (l, r) => new CmpBinaryOp(l, r, (a: any, b: any) => a <= b),
  '<': (l, r) => new CmpBinaryOp(l, r, (a: any, b: any) => a < b),
  and: (l, r) => new CmpBinaryOp(l, r, (a, b) => a && b),
  or: (l, r) => new CmpBinaryOp(l, r, (a, b) => a || b)
};

const FN_NAMES = Object.keys(FN_REGISTRY).sort((a, b) => b.length - a.length);
const BINOP_NAMES = Object.keys(BINOP_REGISTRY).sort((a, b) => b.length - a.length);

const nextToken = (q: string, arr: Operator[]): [string, Operator | undefined, Operator[]] => {
  let op: string | undefined;
  let m;
  if (q.startsWith('|')) {
    return [q.slice(1), undefined, arr];
  } else if (q.startsWith(',')) {
    const last = arr.at(-1)!;
    if (!(last instanceof ConcatenationGenerator)) {
      const seq = new ConcatenationGenerator([last]);
      arr[arr.length - 1] = seq;
      return [q.slice(1), undefined, seq.nodes];
    } else {
      return [q.slice(1), undefined, arr];
    }
  } else if (q.startsWith('..')) {
    return [q.slice(2), new RecursiveDescentGenerator(), arr];
  } else if (q.startsWith('[')) {
    const { end, sub } = parsePair(q, '[', ']');
    return [q.slice(end + 1), new ArrayConstructor(new PipeGenerator([parse(sub.trim())])), arr];
  } else if ((m = q.match(/^\.([a-zA-Z_]?[a-zA-Z0-9_]*)\[([^\]]*)\]/))) {
    const s = q.slice(m[0].length);

    const [, identifier, arrayQuery] = m;

    if (arrayQuery === '') {
      return [s, new PipeGenerator([new PropertyLookupOp(identifier), new ArrayGenerator()]), arr];
    } else if (arrayQuery.includes(':')) {
      const [from, to] = arrayQuery.split(':');

      return [
        s,
        new PipeGenerator([
          new PropertyLookupOp(identifier),
          new ArraySliceOp(from === '' ? 0 : parseInt(from), to === '' ? Infinity : parseInt(to))
        ]),
        arr
      ];
    } else {
      return [
        s,
        new PipeGenerator([
          new PropertyLookupOp(identifier),
          new ArrayIndexOp(parseInt(arrayQuery))
        ]),
        arr
      ];
    }
  } else if ((m = q.match(/^\.[a-zA-Z_]?[a-zA-Z0-9_]*\??/))) {
    return [q.slice(m[0].length), new PropertyLookupOp(m[0].slice(1)), arr];
  } else if (q.startsWith('not')) {
    arr[arr.length - 1] = new EqualsBinaryOp(arr.at(-1)!, new Literal(true), true);
    return [q.slice(3), undefined, arr];

    /* LITERALS ************************************************************************** */
  } else if ((m = q.match(/^-?[0-9]+/))) {
    return [q.slice(m[0].length), new Literal(Number(m[0])), arr];
  } else if (q.startsWith('{')) {
    const { end, sub } = parsePair(q, '{', '}');
    return [q.slice(end + 1), new Literal(OObjects.parse('{' + sub + '}').val()), arr];
  } else if (q.startsWith('"')) {
    const end = q.indexOf('"', 1);
    return [q.slice(end + 1), new Literal(q.slice(1, end)), arr];
  } else if (q.startsWith('null')) {
    return [q.slice(4), new Literal(null), arr];
  } else if (q.startsWith('false')) {
    return [q.slice(5), new Literal(false), arr];
  } else if (q.startsWith('true')) {
    return [q.slice(4), new Literal(true), arr];

    /* BINARY OPS ************************************************************************** */
  } else if ((op = BINOP_NAMES.find(o => q.startsWith(o)))) {
    const [nextS, nextTok, nextArr] = nextToken(q.slice(op.length).trim(), arr);
    assert.present(nextTok);
    arr[arr.length - 1] = BINOP_REGISTRY[op](arr.at(-1)!, nextTok);
    return [nextS, undefined, nextArr];

    /* FUNCTIONS ************************************************************************** */
  } else if ((op = FN_NAMES.find(o => q.startsWith(o)))) {
    const { args, fn: fnFn } = FN_REGISTRY[op];
    if (args === '0') {
      return [q.slice(op.length), fnFn(), arr];
    } else if (args === '0&1' && q[op.length] !== '(') {
      return [q.slice(op.length + 1), fnFn(undefined), arr];
    }
    const { end, sub } = parsePair(q.slice(op.length), '(', ')');
    return [q.slice(op.length + end + 1), fnFn(parse(sub)), arr];

    /* ERROR ****************************************************************************** */
  } else {
    throw new Error('Cannot parse: ' + q);
  }
};

export const parse = (query: string): Operator => {
  const dest: Operator[] = [];

  let arr = dest;
  let q = query;

  let i = 0;
  do {
    const [s, t, newArr] = nextToken(q, arr);
    if (t) arr.push(t);
    arr = newArr;

    q = s.trim();
    if (i++ > 1000) throw new Error('Infinite loop detected');
  } while (q.trim().length > 0);

  return dest.length === 1 ? dest[0] : new PipeGenerator(dest);
};

export const query = (query: string, input: unknown[]) => {
  const node = parse(query);

  const dest: unknown[] = [];
  for (const i of input) {
    let v = i;
    v = node.evaluate(v);
    if (isResultSet(v)) {
      dest.push(...v._val);
    } else {
      dest.push(v);
    }
  }
  return dest;
};

export const queryOne = (q: string, input: any) => {
  const res = query(q, [input]);
  if (res.length > 1) throw new Error();
  return res[0];
};
