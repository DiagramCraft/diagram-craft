/* eslint-disable @typescript-eslint/no-explicit-any */
import { isObj } from './object.ts';
import { assert, NOT_IMPLEMENTED_YET } from './assert.ts';
import { isTaggedType, tag, TaggedType } from './types.ts';

type FnRegistration =
  | { args: '0'; fn: () => Operator }
  | { args: '1'; fn: (arg: Operator) => Operator }
  | { args: '0&1'; fn: (arg: Operator | undefined) => Operator };
type BinaryOpRegistration = (l: Operator, r: Operator) => Operator;

const FN_REGISTRY: Record<string, FnRegistration> = {
  '..': { args: '0', fn: () => new RecursiveDescentGenerator() },
  not: { args: '0', fn: () => new NotFilter() },
  length: { args: '0', fn: () => new LengthFilter() },
  has: { args: '1', fn: a => new HasFn(a) },
  in: { args: '1', fn: a => new InFn(a) },
  map: { args: '1', fn: a => new ArrayConstructor(new PipeGenerator(new ArrayGenerator(), a)) },
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
  or: (l, r) => new CmpBinaryOp(l, r, (a, b) => a || b),
  '|': (l, r) => new PipeGenerator(l, r),
  ',': (l, r) => new ConcatenationGenerator(l, r)
};

const BINOP_ORDERING = Object.fromEntries(
  [
    [','],
    ['|'],
    ['//'],
    ['and', 'or'],
    ['==', '!=', '>=', '>', '<=', '<'],
    ['+', '-'],
    ['%']
  ].flatMap((e, idx) => e.map(a => [a, idx * 10])) as [string, number][]
);

const MAX_LOOP = 100;

const safeParseInt = (s: any) => {
  const n = Number(s);
  return isNaN(n) ? 0 : n;
};

type Token = {
  s: string;
  type: 'number' | 'string' | 'identifier' | 'operator' | 'separator' | 'end';
};

export class Tokenizer {
  public head: string;

  constructor(readonly query: string) {
    this.head = query;
  }

  peek(): Token {
    let m;
    if ((m = this.head.match(/^-?[0-9]+(\.[0-9]+)?/))) {
      return { s: m[0], type: 'number' };
    } else if ((m = this.head.match(/^"[^"]*"/))) {
      return { s: m[0], type: 'string' };
    } else if ((m = this.head.match(/^([a-zA-Z_][a-zA-Z0-9_]*|\.\.)/))) {
      return { s: m[0], type: 'identifier' };
    } else if (
      (m = this.head.match(/^(\|\||&&|==|!=|>=|<=|>|<|\+|-|%|\/\/|\.|\[|\]|\(|\)|,|:|{|}|\?|\|)/))
    ) {
      return { s: m[0], type: 'operator' };
    } else if ((m = this.head.match(/^(\s+)/))) {
      return { s: m[0], type: 'separator' };
    } else if (this.head === '') {
      return { s: '', type: 'end' };
    } else {
      throw new Error('Unexpected token: ' + this.head);
    }
  }

  next() {
    const s = this.peek();
    this.head = this.head.slice(s.s.length);
    return s;
  }

  expect(s: string) {
    if (this.peek().s === s) return this.next();
    else throw new Error('Expected: ' + s + ', found ' + JSON.stringify(this.peek()));
  }

  consumeWhitespace() {
    while (this.peek().type === 'separator') {
      this.head = this.head.slice(this.peek().s.length);
    }
  }

  accept(s: string) {
    return this.peek().s === s && this.expect(s);
  }
}

type ResultSet = TaggedType<'resultSet', unknown[]>;

export const ResultSet = {
  of: (o: unknown): ResultSet => ({ _type: 'resultSet', _val: [o] }),
  ofList: (...o: unknown[]): ResultSet => ({ _type: 'resultSet', _val: o })
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
  parse(tok: Tokenizer): OObjects & { val(): unknown } {
    const r = OObjects.parseNext(tok);
    if (isOperator(r)) throw new Error();
    return r;
  },

  parseTemplate(tok: Tokenizer): OObjects {
    return OObjects.parseNext(tok);
  },

  parseNext(tokenizer: Tokenizer): OObjects {
    const tok = tokenizer.next();
    if (tok.type === 'string') {
      return new OString(tok.s.slice(1, -1));
    } else if (tok.s === '.') {
      return parsePathExpression(tokenizer);
    } else if (tok.s === '{') {
      return OObject.parse(tokenizer);
    } else if (tok.s === '(') {
      const e = OObjects.parseNext(tokenizer);
      tokenizer.expect(')');
      return e;
    } else if (tok.s === '[') {
      return OArray.parse(tokenizer);
    } else if (tok.type === 'number') {
      return new ONumber(Number(tok.s));
    } else if (tok.s === 'true' || tok.s === 'false') {
      return new OBoolean(tok.s === 'true');
    } else {
      throw new Error('Cannot parse: ' + tokenizer.head);
    }
  }
};

export class OObject {
  entries: [OString | Operator, OObjects][] = [];

  constructor(entries?: [OString | Operator, OObjects][]) {
    this.entries = entries ?? [];
  }

  static parse(s: Tokenizer) {
    const obj = new OObject();

    let currentKey: OString | Operator | undefined = undefined;

    while (s.peek().s !== '}') {
      while (s.peek().type === 'separator') s.next();

      if (s.peek().type === 'identifier') {
        if (currentKey) {
          throw new Error('Cannot have two keys in a row');
        } else {
          currentKey = new OString(s.next().s);
          s.expect(':');
        }
      } else {
        const next = OObjects.parseNext(s);

        if (next instanceof OString || isOperator(next)) {
          if (currentKey) {
            obj.entries.push([currentKey, next]);
            currentKey = undefined;
            if (!s.accept(',')) break;
          } else {
            currentKey = next;
            s.expect(':');
          }
        } else {
          assert.present(currentKey);
          obj.entries.push([currentKey, next]);
          currentKey = undefined;
          if (!s.accept(',')) break;
        }
      }
    }

    s.expect('}');

    return obj;
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
  constructor(public value: string) {}

  val() {
    return this.value;
  }
}

export class OBoolean {
  constructor(public value: boolean) {}

  val() {
    return this.value;
  }
}

export class OArray {
  value: OObjects[] = [];

  constructor(value?: OObjects[]) {
    this.value = value ?? [];
  }

  static parse(s: Tokenizer) {
    const arr = new OArray();

    while (s.peek().s !== ']') {
      s.consumeWhitespace();
      arr.value.push(OObjects.parseNext(s));
      if (!s.accept(',')) break;
    }
    s.expect(']');

    return arr;
  }

  val(): unknown[] {
    return this.value.map(e => {
      if (isOperator(e)) throw new Error();
      return e.val();
    });
  }
}

export class ONumber {
  constructor(public value: number) {}

  val() {
    return this.value;
  }
}

export class PipeGenerator implements Generator {
  constructor(
    private readonly left: Operator,
    private readonly right: Operator
  ) {}

  evaluate(input: unknown): ResultSet {
    let v = [input];
    for (const node of [this.left, this.right]) {
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

export class PathExpression implements Operator {
  constructor(public readonly nodes: Operator[]) {}

  evaluate(input: unknown): unknown {
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
    const results = v.filter(e => e !== undefined);
    if (results.length === 0) return undefined;
    if (results.length === 1) return results[0];

    return ResultSet.ofList(...results);
  }
}

export class PropertyLookupOp implements Operator {
  constructor(
    private readonly identifier: string,
    private readonly strict = true
  ) {}

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
  constructor(
    private readonly left: Operator,
    private readonly right: Operator
  ) {}

  evaluate(input: unknown): ResultSet {
    const dest: unknown[] = [];
    for (const n of [this.left, this.right]) {
      const r = n.evaluate(input);
      if (isResultSet(r)) {
        dest.push(...r._val);
      } else if (r !== undefined) {
        dest.push(r);
      }
    }

    return ResultSet.ofList(...dest);
  }
}

export class ArrayConstructor implements Operator {
  constructor(private readonly node: Operator) {}

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
    private readonly left: Operator,
    private readonly right: Operator
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
    private readonly left: Operator,
    private readonly right: Operator
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
    private readonly left: Operator,
    private readonly right: Operator,
    private readonly fn: (a: unknown, b: unknown) => unknown
  ) {}

  evaluate(input: unknown): unknown {
    const lvs = this.left.evaluate(input);
    const rvs = this.right.evaluate(input);
    return this.fn(lvs, rvs);
  }
}

class Literal implements Operator {
  constructor(private readonly value: unknown) {}

  evaluate() {
    return this.value;
  }
}

class LengthFilter implements Operator {
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

class NotFilter implements Operator {
  evaluate(input: unknown): unknown {
    return !input;
  }
}

class HasFn implements Operator {
  constructor(private readonly node: Operator) {}

  evaluate(input: unknown): unknown {
    const res = this.node.evaluate(undefined);
    return (res as string | number) in (input as any);
  }
}

class InFn implements Operator {
  constructor(private readonly node: Operator) {}

  evaluate(input: unknown): unknown {
    const res = this.node.evaluate(ResultSet.of(undefined));
    return (input as any) in (res as any);
  }
}

class SelectFn implements Operator {
  constructor(private readonly node: Operator) {}

  evaluate(input: unknown): unknown {
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

const parsePathExpression = (tokenizer: Tokenizer): Operator => {
  const dest: Operator[] = [new PropertyLookupOp('')];

  tokenizer.accept('.');

  let token = tokenizer.peek();

  let i = 0;
  while (i++ < MAX_LOOP) {
    if (token.type === 'identifier') {
      tokenizer.next();
      const strict = !tokenizer.accept('?');
      dest.push(new PropertyLookupOp(token.s, strict));
    } else if (token.type === 'operator' && token.s === '[') {
      tokenizer.next();
      const nextToken = tokenizer.next();
      if (nextToken.s === ']') {
        dest.push(new ArrayGenerator());
      } else if (nextToken.type === 'number') {
        const nextNextToken = tokenizer.next();
        if (nextNextToken.s === ':') {
          dest.push(new ArraySliceOp(parseInt(nextToken.s), parseInt(tokenizer.next().s)));
          tokenizer.expect(']');
        } else if (nextNextToken.s === ']') {
          dest.push(new ArrayIndexOp(parseInt(nextToken.s)));
        }
      } else {
        throw new Error('Unexpected token: ' + nextToken.s);
      }
    } else if (token.s === '.') {
      tokenizer.next();
    } else {
      break;
    }

    token = tokenizer.peek();
  }

  return new PathExpression(dest);
};

const parseOperand = (tokenizer: Tokenizer): Operator => {
  const tok = tokenizer.peek();
  if (tok.s === '[') {
    tokenizer.next();
    const inner = parseExpression(tokenizer, undefined);
    tokenizer.expect(']');

    return new ArrayConstructor(inner);
  } else if (tok.s === '(') {
    tokenizer.next();
    const inner = parseExpression(tokenizer, undefined);
    tokenizer.expect(')');
    return inner;
  } else if (tok.s === '.') {
    return parsePathExpression(tokenizer);

    /* LITERALS ************************************************************************** */
  } else if (tok.type === 'number') {
    return new Literal(Number(tokenizer.next().s));
  } else if (tok.s === '{') {
    const res = OObjects.parse(tokenizer);
    return new Literal(res.val());
  } else if (tok.type === 'string') {
    return new Literal(tokenizer.next().s.slice(1, -1));
  } else if (tok.s === 'null') {
    tokenizer.next();
    return new Literal(null);
  } else if (tok.s === 'false' || tok.s === 'true') {
    tokenizer.next();
    return new Literal(tok.s === 'true');

    /* FUNCTIONS ************************************************************************** */
  } else if (tok.type === 'identifier') {
    const op = tok.s;
    tokenizer.next();

    const { args, fn: fnFn } = FN_REGISTRY[op];

    if (args === '0') {
      return fnFn();
    } else if (args === '0&1' && tokenizer.peek().s !== '(') {
      return fnFn(undefined);
    }

    tokenizer.expect('(');
    const inner = parseExpression(tokenizer, undefined);
    tokenizer.expect(')');

    return fnFn(inner);
  }

  throw new Error('Cannot parse: ' + tokenizer.head);
};

const parseExpression = (tokenizer: Tokenizer, lastOp: string | undefined): Operator => {
  tokenizer.consumeWhitespace();

  let left = parseOperand(tokenizer);
  assert.present(left);

  let i = 0;
  do {
    tokenizer.consumeWhitespace();

    if (
      Object.keys(BINOP_REGISTRY).includes(tokenizer.peek().s) &&
      (BINOP_ORDERING[tokenizer.peek().s] ?? 0) >= (BINOP_ORDERING[lastOp ?? ''] ?? 0)
    ) {
      const op = tokenizer.next().s;

      const right = parseExpression(tokenizer, op);
      left = BINOP_REGISTRY[op](left, right);
    } else {
      return left;
    }
  } while (i++ < MAX_LOOP);
  throw new Error('Infinite loop');
};

export const parse = (query: string): Operator => {
  const tokenizer = new Tokenizer(query);

  const op = parseExpression(tokenizer, undefined);

  if (tokenizer.peek().type !== 'end') {
    throw new Error('Cannot parse: ' + tokenizer.head);
  }

  return op;
};

export const query = (query: string, input: unknown[]) => {
  const node = parse(query);

  const dest: unknown[] = [];
  for (const i of input) {
    let v = i;
    v = node.evaluate(v);
    if (isResultSet(v)) {
      dest.push(...v._val);
    } else if (v !== undefined) {
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
