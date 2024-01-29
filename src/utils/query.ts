/* eslint-disable @typescript-eslint/no-explicit-any */
import { isObj } from './object.ts';
import { assert, NOT_IMPLEMENTED_YET } from './assert.ts';
import { isTaggedType, tag, TaggedType } from './types.ts';

type FnRegistration =
  | { args: '0'; fn: () => Generator }
  | { args: '1'; fn: (arg: Generator) => Generator }
  | { args: '0&1'; fn: (arg: Generator | undefined) => Generator };
type BinaryOpRegistration = (l: Generator, r: Generator) => Generator;

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

const isGenerator = (o: unknown): o is Generator => (o as any)?.iterable;

interface Generator {
  iterable(input: Iterable<unknown>): Iterable<unknown>;
}

abstract class BaseGenerator implements Generator {
  *iterable(input: Iterable<unknown>): Iterable<unknown> {
    for (const e of input) {
      yield* this.handleElement(e);
    }
  }

  abstract handleElement(e: unknown): Iterable<unknown>;
}

type OObjects = OObject | OBoolean | OArray | ONumber | OString | Generator;

export const OObjects = {
  parse(tok: Tokenizer): OObjects & { val(): unknown } {
    const r = OObjects.parseNext(tok);
    if (isGenerator(r)) throw new Error();
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
  entries: [OString | Generator, OObjects][] = [];

  constructor(entries?: [OString | Generator, OObjects][]) {
    this.entries = entries ?? [];
  }

  static parse(s: Tokenizer) {
    const obj = new OObject();

    let currentKey: OString | Generator | undefined = undefined;

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

        if (next instanceof OString || isGenerator(next)) {
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
      if (isGenerator(k) || isGenerator(v)) throw new Error();
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
      if (isGenerator(e)) throw new Error();
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
    private readonly left: Generator,
    private readonly right: Generator
  ) {}

  *iterable(input: Iterable<unknown>): Iterable<unknown> {
    yield* this.right.iterable(this.left.iterable(input));
  }
}

export class PathExpression extends PipeGenerator {
  constructor(left: Generator, right: Generator) {
    super(left, right);
  }
}

export class PropertyLookupOp extends BaseGenerator {
  constructor(
    private readonly identifier: string,
    private readonly strict = true
  ) {
    super();
  }

  *handleElement(e: unknown): Iterable<unknown> {
    if (this.identifier === '') {
      yield e;
    } else {
      if (this.strict && !isObj(e) && e !== undefined) throw new Error();
      assert.false(this.identifier === '__proto__' || this.identifier === 'constructor');
      if (!isObj(e)) {
        return;
      }

      if (e instanceof Map) {
        yield e.get(this.identifier);
      } else {
        yield (e as any)[this.identifier];
      }
    }
  }
}

export class ArrayIndexOp extends BaseGenerator {
  constructor(private readonly index: number) {
    super();
  }

  *handleElement(e: unknown): Iterable<unknown> {
    if (e === undefined || !Array.isArray(e) || this.index >= e.length) return;
    yield e[this.index];
  }
}

export class ArraySliceOp extends BaseGenerator {
  constructor(
    private readonly from: number,
    private readonly to: number
  ) {
    super();
  }

  *handleElement(e: unknown): Iterable<unknown> {
    if (e === undefined || !Array.isArray(e)) return;
    yield e.slice(this.from, Math.min(this.to, e.length));
  }
}

export class ArrayGenerator extends BaseGenerator {
  *handleElement(e: unknown): Iterable<unknown> {
    if (!Array.isArray(e)) throw new Error('Not an array');
    yield* e;
  }
}

export class ConcatenationGenerator extends BaseGenerator {
  constructor(
    private readonly left: Generator,
    private readonly right: Generator
  ) {
    super();
  }

  *handleElement(e: unknown): Iterable<unknown> {
    yield* this.left.iterable([e]);
    yield* this.right.iterable([e]);
  }
}

export class ArrayConstructor implements Generator {
  constructor(private readonly node: Generator) {}

  *iterable(input: Iterable<unknown>): Iterable<unknown> {
    yield [...this.node.iterable(input)];
  }
}

export class RecursiveDescentGenerator extends BaseGenerator {
  *handleElement(e: unknown): Iterable<unknown> {
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

abstract class BinaryOperator implements Generator {
  constructor(
    protected readonly left: Generator,
    protected readonly right: Generator
  ) {}

  abstract combine(l: unknown, r: unknown): unknown;

  *iterable(input: Iterable<unknown>): Iterable<unknown> {
    for (const r of this.right.iterable(input)) {
      for (const l of this.left.iterable(input)) {
        yield this.combine(l, r);
      }
    }
  }
}

export class AdditionBinaryOp extends BinaryOperator {
  constructor(left: Generator, right: Generator) {
    super(left, right);
  }

  combine(lvs: unknown, rvs: unknown) {
    if (Array.isArray(lvs) && Array.isArray(rvs)) {
      return [...lvs, ...rvs];
    } else if (isObj(lvs) && isObj(rvs)) {
      return { ...lvs, ...rvs };
    } else {
      return safeParseInt(lvs) + safeParseInt(rvs);
    }
  }
}

export class SubtractionBinaryOp extends BinaryOperator {
  constructor(left: Generator, right: Generator) {
    super(left, right);
  }

  combine(lvs: unknown, rvs: unknown) {
    if (Array.isArray(lvs) && Array.isArray(rvs)) {
      return lvs.filter(e => !rvs.includes(e));
    } else if (isObj(lvs) && isObj(rvs)) {
      return Object.fromEntries(Object.entries(lvs).filter(([k]) => !Object.keys(rvs).includes(k)));
    } else {
      return safeParseInt(lvs) - safeParseInt(rvs);
    }
  }
}

export class SimpleBinaryOp extends BinaryOperator {
  constructor(
    left: Generator,
    right: Generator,
    private readonly fn: (a: unknown, b: unknown) => unknown
  ) {
    super(left, right);
  }

  combine(lvs: unknown, rvs: unknown) {
    return this.fn(lvs, rvs);
  }
}

class Literal implements Generator {
  constructor(private readonly value: unknown) {}

  iterable() {
    return [this.value];
  }
}

class LengthFilter extends BaseGenerator {
  *handleElement(e: unknown): Iterable<unknown> {
    if (e === undefined || e === null) {
      yield 0;
    } else if (Array.isArray(e) || typeof e === 'string') {
      yield e.length;
    } else if (!isNaN(Number(e))) {
      yield Math.abs(Number(e));
    } else if (isObj(e)) {
      yield Object.keys(e).length;
    }
  }
}

class NotFilter extends BaseGenerator {
  *handleElement(e: unknown): Iterable<unknown> {
    yield !e;
  }
}

class HasFn extends BaseGenerator {
  constructor(private readonly node: Generator) {
    super();
  }

  *handleElement(e: unknown): Iterable<unknown> {
    yield (exactOne(this.node.iterable([undefined])) as string | number) in (e as any);
  }
}

class InFn extends BaseGenerator {
  constructor(private readonly node: Generator) {
    super();
  }

  *handleElement(e: unknown): Iterable<unknown> {
    yield (e as any) in (exactOne(this.node.iterable([undefined])) as any);
  }
}

class SelectFn extends BaseGenerator {
  constructor(private readonly node: Generator) {
    super();
  }

  *handleElement(e: unknown): Iterable<unknown> {
    for (const r of this.node.iterable([e])) {
      if (r === true) {
        yield e;
      }
    }
  }
}

class EqualsBinaryOp extends BinaryOperator {
  constructor(
    left: Generator,
    right: Generator,
    private readonly negate: boolean
  ) {
    super(left, right);
  }

  combine(lvs: unknown, rvs: unknown): unknown {
    if (Array.isArray(lvs) && Array.isArray(rvs)) {
      throw NOT_IMPLEMENTED_YET();
    } else if (isObj(lvs) && isObj(rvs)) {
      throw NOT_IMPLEMENTED_YET();
    } else {
      return this.negate ? lvs !== rvs : lvs === rvs;
    }
  }
}

class CmpBinaryOp extends BinaryOperator {
  constructor(
    left: Generator,
    right: Generator,
    private readonly cmp: (a: unknown, b: unknown) => boolean | any
  ) {
    super(left, right);
  }

  combine(lvs: unknown, rvs: unknown): unknown {
    return !!this.cmp(lvs, rvs);
  }
}

class AnyFilter extends BaseGenerator {
  *handleElement(e: unknown): Iterable<unknown> {
    yield Array.isArray(e) && e.some(a => !!a);
  }
}

class AllFilter extends BaseGenerator {
  *handleElement(e: unknown): Iterable<unknown> {
    yield Array.isArray(e) && e.every(a => !!a);
  }
}

type ArrayFn = (arr: [unknown, unknown][]) => [unknown, unknown][] | TaggedType<'single', unknown>;

const exactOne = (it: Iterable<unknown>) => {
  const arr = [...it];
  if (arr.length !== 1) throw new Error();
  return arr[0];
};

class ArrayFilter extends BaseGenerator {
  constructor(
    private readonly node: Generator,
    private readonly fn: ArrayFn
  ) {
    super();
  }

  *handleElement(el: unknown): Iterable<unknown> {
    if (Array.isArray(el)) {
      const res = this.fn(el.map(e => [e, exactOne(this.node.iterable([e]))]));
      if (isTaggedType(res, 'single')) yield res._val;
      else if (Array.isArray(res)) {
        return yield (this.fn(res) as [unknown, unknown][]).map(a => a[0]);
      } else yield res;
    } else {
      yield el;
    }
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

class StringFn extends BaseGenerator {
  constructor(
    private readonly node: Generator,
    private readonly fn: (a: string, b: string) => unknown
  ) {
    super();
  }

  *handleElement(el: unknown): Iterable<unknown> {
    const arg = exactOne(this.node.iterable([undefined]));
    if (Array.isArray(el)) {
      yield el.map(e => this.fn(e as string, arg as string));
    } else {
      yield this.fn(el as string, arg as string);
    }
  }
}

class JoinFn extends BaseGenerator {
  constructor(private readonly node: Generator) {
    super();
  }

  *handleElement(el: unknown): Iterable<unknown> {
    for (const r of this.node.iterable([el])) {
      if (Array.isArray(el)) yield el.join(r as string);
      else yield el;
    }
  }
}

class AbsFilter extends BaseGenerator {
  *handleElement(el: unknown): Iterable<unknown> {
    if (typeof el === 'number') yield Math.abs(el);
    else yield el;
  }
}

class KeysFilter extends BaseGenerator {
  *handleElement(el: unknown): Iterable<unknown> {
    if (el && typeof el === 'object') yield Object.keys(el).sort();
    else yield el;
  }
}

class MapValuesFn extends BaseGenerator {
  constructor(public readonly node: Generator) {
    super();
  }

  *handleElement(el: unknown): Iterable<unknown> {
    if (isObj(el)) {
      yield Object.fromEntries(
        Object.entries(el).map(([k, v]) => [k, exactOne(this.node.iterable([v]))])
      );
    } else {
      yield el;
    }
  }
}

// for each e
class ContainsFn extends BaseGenerator {
  constructor(public readonly node: Generator) {
    super();
  }

  *handleElement(el: unknown): Iterable<unknown> {
    const cv = this.node.iterable([undefined]);

    for (const a of cv) {
      if (typeof a === 'string') {
        yield typeof el === 'string' ? el.includes(a) : false;
      } else if (Array.isArray(a)) {
        yield Array.isArray(el) ? a.every(e => el.some(v => v.includes(e))) : false;
      } else {
        yield false;
      }
    }
  }
}

const parsePathExpression = (tokenizer: Tokenizer): Generator => {
  let left: Generator = new PropertyLookupOp('');

  tokenizer.accept('.');

  let token = tokenizer.peek();

  let i = 0;
  while (i++ < MAX_LOOP) {
    if (token.type === 'identifier') {
      tokenizer.next();
      const strict = !tokenizer.accept('?');
      left = new PathExpression(left, new PropertyLookupOp(token.s, strict));
    } else if (token.type === 'operator' && token.s === '[') {
      tokenizer.next();
      const nextToken = tokenizer.next();
      if (nextToken.s === ']') {
        left = new PathExpression(left, new ArrayGenerator());
      } else if (nextToken.type === 'number') {
        const nextNextToken = tokenizer.next();
        if (nextNextToken.s === ':') {
          left = new PathExpression(
            left,
            new ArraySliceOp(parseInt(nextToken.s), parseInt(tokenizer.next().s))
          );
          tokenizer.expect(']');
        } else if (nextNextToken.s === ']') {
          left = new PathExpression(left, new ArrayIndexOp(parseInt(nextToken.s)));
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

  return left;
};

const parseOperand = (tokenizer: Tokenizer): Generator => {
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

const parseExpression = (tokenizer: Tokenizer, lastOp: string | undefined): Generator => {
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

export const parse = (query: string): Generator => {
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
  for (const i of node.iterable(input)) {
    dest.push(i);
  }
  return dest;
};

export const queryOne = (q: string, input: any) => {
  const res = query(q, [input]);
  if (res.length > 1) throw new Error();
  return res[0];
};
