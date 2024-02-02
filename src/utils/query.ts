/* eslint-disable @typescript-eslint/no-explicit-any */
import { isObj } from './object.ts';
import { isTaggedType, tag, TaggedType } from './types.ts';
import { newid } from './id.ts';

type FnRegistration =
  | { fn: () => Generator }
  | { args: '1'; fn: (arg: ArgList) => Generator }
  | { args: '0&1'; fn: (arg: ArgList | undefined) => Generator };
type BinaryOpRegistration = (l: Generator, r: Generator) => Generator;

const FN_REGISTRY: Record<string, FnRegistration> = {
  '..': { fn: () => new RecursiveDescentGenerator() },
  not: { fn: () => new NotFilter() },
  length: { fn: () => new LengthFilter() },
  has: { args: '1', fn: a => new HasFn(a) },
  in: { args: '1', fn: a => new InFn(a) },
  map: { args: '1', fn: a => new ArrayConstructor(new PipeGenerator(new ArrayGenerator(), a)) },
  map_values: { args: '1', fn: a => new MapValuesFn(a) },
  select: { args: '1', fn: a => new SelectFn(a) },
  any: { fn: () => new AnyFilter() },
  all: { fn: () => new AllFilter() },
  unique_by: { args: '1', fn: a => new ArrayFilter(a, ArrayFilterFns.UNIQUE) },
  unique: { fn: () => new ArrayFilter(new PropertyLookupOp(''), ArrayFilterFns.UNIQUE) },
  min_by: { args: '1', fn: a => new ArrayFilter(a, ArrayFilterFns.MIN) },
  min: { fn: () => new ArrayFilter(new PropertyLookupOp(''), ArrayFilterFns.MIN) },
  max_by: { args: '1', fn: a => new ArrayFilter(a, ArrayFilterFns.MAX) },
  max: { fn: () => new ArrayFilter(new PropertyLookupOp(''), ArrayFilterFns.MAX) },
  group_by: { args: '1', fn: a => new ArrayFilter(a, ArrayFilterFns.GROUP_BY) },
  startswith: { args: '1', fn: a => new StringFn(a, (a, b) => a.startsWith(b)) },
  endswith: { args: '1', fn: a => new StringFn(a, (a, b) => a.endsWith(b)) },
  abs: { fn: () => new AbsFilter() },
  keys: { fn: () => new KeysFilter() },
  split: { args: '1', fn: a => new StringFn(a, (a, b) => a.split(b)) },
  join: { args: '1', fn: a => new JoinFn(a) },
  contains: { args: '1', fn: a => new ContainsFn(a) },
  flatten: { fn: () => new ArrayFilter(new Literal(1), ArrayFilterFns.FLATTEN) },
  range: { args: '1', fn: a => new RangeGenerator(a) },
  limit: { args: '1', fn: a => new LimitGenerator(a) },
  first: {
    args: '0&1',
    fn: a => new NthFilter(a ? (a.args.unshift(new Literal(0)), a) : new ArgList([new Literal(0)]))
  },
  last: {
    args: '0&1',
    fn: a =>
      new NthFilter(a ? (a.args.unshift(new Literal(-1)), a) : new ArgList([new Literal(-1)]))
  },
  nth: { args: '1', fn: a => new NthFilter(a) },
  floor: { fn: () => new MathFilter(Math.floor) },
  sqrt: { fn: () => new MathFilter(Math.sqrt) },
  add: { fn: () => new ArrayFilter(new PropertyLookupOp(''), ArrayFilterFns.ADD) }
};

const BINOP_REGISTRY: Record<string, BinaryOpRegistration> = {
  '+': (l, r) => new AdditionBinaryOp(l, r),
  '-': (l, r) => new SubtractionBinaryOp(l, r),
  '%': (l, r) => new SimpleBinaryOp(l, r, (a, b) => safeNum(a) % safeNum(b)),
  '*': (l, r) => new SimpleBinaryOp(l, r, (a, b) => safeNum(a) * safeNum(b)),
  '/': (l, r) => new SimpleBinaryOp(l, r, (a, b) => safeNum(a) / safeNum(b)),
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
  ',': (l, r) => new ConcatenationGenerator(l, r),
  ';': (l, r) => new ConsBinaryOp(l, r),
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

// To ensure no infinite loops
const boundLoop = <T>(fn: () => T) => {
  let i = 0;
  while (i++ < 1000) {
    const res = fn();
    if (res !== undefined) return res;
  }
  throw new Error();
};

const safeNum = (s: any) => (isNaN(Number(s)) ? 0 : Number(s));

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
    if ((m = this.head.match(/^-?[\d]+(\.[\d]+)?/))) {
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
    else throw new Error(`Expected: ${s}, found ${this.peek().s}`);
  }

  strip() {
    if (this.peek().type !== 'sep') return;
    this.head = this.head.slice(this.peek().s.length);
  }

  accept(s: string) {
    return this.peek().s === s && this.next();
  }
}

const isGenerator = (o: unknown): o is Generator => 'iterable' in (o as any);

interface Generator {
  iterable(input: Iterable<unknown>, bindings: Record<string, unknown>): Iterable<unknown>;
}

abstract class BaseGenerator implements Generator {
  *iterable(input: Iterable<unknown>, bindings: Record<string, unknown>): Iterable<unknown> {
    for (const e of input) {
      yield* this.handle(e, bindings);
    }
  }

  abstract handle(e: unknown, bindings: Record<string, unknown>): Iterable<unknown>;
}

type OObjects = OObject | OLiteral | OArray | Generator;

export const OObjects = {
  parseString(s: string): OObjects & { val(): unknown } {
    return OObjects.parse(new Tokenizer(s));
  },

  parse(tok: Tokenizer): OObjects & { val(): unknown } {
    return OObjects.parseNext(tok) as OObjects & { val(): unknown };
  },

  parseNext(tokenizer: Tokenizer): OObjects {
    const tok = tokenizer.next();

    if (tok.type === 'str') {
      return new OLiteral(tok.s.slice(1, -1));
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
    } else if (tok.type === 'num') {
      return new OLiteral(Number(tok.s));
    } else if (tok.s === 'true' || tok.s === 'false') {
      return new OLiteral(tok.s === 'true');
    }

    throw new Error(`Cannot parse: ${tokenizer.head}`);
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
      s.strip();

      if (s.peek().type === 'id') {
        currentKey = new OLiteral(s.next().s);

        // shorthand notation
        if (!s.accept(':')) {
          obj.entries.push([
            currentKey,
            parsePathExpression(new Tokenizer('.' + currentKey.val()))
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

    s.strip();
    s.expect('}');

    return obj;
  }

  val() {
    const generators = new Map<string, Generator>();

    const dest: any = {};
    for (const [k, v] of this.entries) {
      const key: string = isGenerator(k) ? '__' + newid() : k.val()!.toString();
      if (isGenerator(k)) generators.set(key, k);

      const val: any = isGenerator(v) ? '__' + newid() : v.val();
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
  constructor(public value: unknown) {}

  val() {
    return this.value;
  }
}

class OArray {
  value: OObjects[] = [];

  constructor(value?: OObjects[]) {
    this.value = value ?? [];
  }

  static parse(s: Tokenizer) {
    const arr = new OArray();

    while (s.peek().s !== ']') {
      s.strip();
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

class PipeGenerator implements Generator {
  constructor(
    private readonly left: Generator,
    private readonly right: Generator
  ) {}

  *iterable(input: Iterable<unknown>, bindings: Record<string, unknown>): Iterable<unknown> {
    yield* this.right.iterable(this.left.iterable(input, bindings), bindings);
  }
}

class PathExpression extends PipeGenerator {
  constructor(left: Generator, right: Generator) {
    super(left, right);
  }
}

class MathFilter extends BaseGenerator {
  constructor(private readonly fn: (a: number) => number) {
    super();
  }

  *handle(e: unknown): Iterable<unknown> {
    yield this.fn(safeNum(e));
  }
}

class PropertyLookupOp extends BaseGenerator {
  constructor(
    private readonly identifier: string,
    private readonly strict = true
  ) {
    super();
  }

  *handle(e: unknown): Iterable<unknown> {
    if (this.identifier === '') {
      yield e;
    } else {
      if (this.strict && !isObj(e) && e !== undefined) throw new Error();
      if (this.identifier === '__proto__' || this.identifier === 'constructor') throw new Error();
      if (!isObj(e) && e !== undefined) {
        return;
      }

      if (e === undefined) yield undefined;
      else if (e instanceof Map) {
        yield e.get(this.identifier);
      } else {
        yield (e as any)[this.identifier];
      }
    }
  }
}

class ArrayIndexOp extends BaseGenerator {
  constructor(private readonly index: number) {
    super();
  }

  *handle(e: unknown): Iterable<unknown> {
    if (e === undefined || !Array.isArray(e) || this.index >= e.length) return;
    yield e[this.index];
  }
}

class ArraySliceOp extends BaseGenerator {
  constructor(
    private readonly from: number,
    private readonly to: number
  ) {
    super();
  }

  *handle(e: unknown): Iterable<unknown> {
    if (e === undefined || !Array.isArray(e)) return;
    yield e.slice(this.from, Math.min(this.to, e.length));
  }
}

class ArrayGenerator extends BaseGenerator {
  *handle(e: unknown): Iterable<unknown> {
    if (!Array.isArray(e)) throw new Error('Not an array');
    yield* e;
  }
}

class ConcatenationGenerator extends BaseGenerator {
  constructor(
    private readonly left: Generator,
    private readonly right: Generator
  ) {
    super();
  }

  *handle(e: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    yield* this.left.iterable([e], bindings);
    yield* this.right.iterable([e], bindings);
  }
}

class ArrayConstructor implements Generator {
  constructor(private readonly node: Generator) {}

  *iterable(input: Iterable<unknown>, bindings: Record<string, unknown>): Iterable<unknown> {
    for (const e of input) {
      yield [...this.node.iterable([e], bindings)];
    }
  }
}

class RecursiveDescentGenerator extends BaseGenerator {
  *handle(e: unknown): Iterable<unknown> {
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

  *iterable(input: Iterable<unknown>, bindings: Record<string, unknown>): Iterable<unknown> {
    for (const e of input) {
      for (const r of this.right.iterable([e], bindings)) {
        for (const l of this.left.iterable([e], bindings)) {
          yield this.combine(l, r);
        }
      }
    }
  }
}

const add = (lvs: unknown, rvs: unknown) => {
  if (Array.isArray(lvs) && Array.isArray(rvs)) {
    return [...lvs, ...rvs];
  } else if (typeof lvs === 'string' && typeof rvs === 'string') {
    return lvs + rvs;
  } else if (isObj(lvs) && isObj(rvs)) {
    return { ...lvs, ...rvs };
  } else {
    return safeNum(lvs) + safeNum(rvs);
  }
};

class AdditionBinaryOp extends BinaryOperator {
  constructor(left: Generator, right: Generator) {
    super(left, right);
  }

  combine(lvs: unknown, rvs: unknown) {
    return add(lvs, rvs);
  }
}

class SubtractionBinaryOp extends BinaryOperator {
  constructor(left: Generator, right: Generator) {
    super(left, right);
  }

  combine(lvs: unknown, rvs: unknown) {
    if (Array.isArray(lvs) && Array.isArray(rvs)) {
      return lvs.filter(e => !rvs.includes(e));
    } else if (isObj(lvs) && isObj(rvs)) {
      return Object.fromEntries(Object.entries(lvs).filter(([k]) => !Object.keys(rvs).includes(k)));
    } else {
      return safeNum(lvs) - safeNum(rvs);
    }
  }
}

class SimpleBinaryOp extends BinaryOperator {
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
  *handle(e: unknown): Iterable<unknown> {
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

class NotFilter extends BaseGenerator {
  *handle(e: unknown): Iterable<unknown> {
    yield e === false || e === null || e === undefined;
  }
}

class HasFn extends BaseGenerator {
  constructor(private readonly node: Generator) {
    super();
  }

  *handle(e: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    yield (exactOne(this.node.iterable([undefined], bindings)) as string | number) in (e as any);
  }
}

class InFn extends BaseGenerator {
  constructor(private readonly node: Generator) {
    super();
  }

  *handle(e: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    yield (e as any) in (exactOne(this.node.iterable([undefined], bindings)) as any);
  }
}

class SelectFn extends BaseGenerator {
  constructor(private readonly node: Generator) {
    super();
  }

  *handle(e: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    for (const r of this.node.iterable([e], bindings)) {
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
    if ((Array.isArray(lvs) && Array.isArray(rvs)) || (isObj(lvs) && isObj(rvs))) {
      return this.negate
        ? JSON.stringify(lvs) !== JSON.stringify(rvs)
        : JSON.stringify(lvs) === JSON.stringify(rvs);
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

class VarBindingOp implements Generator {
  constructor(
    private readonly node: Generator,
    private readonly identifier: Generator
  ) {}

  *iterable(input: Iterable<unknown>, bindings: Record<string, unknown>): Iterable<unknown> {
    for (const e of input) {
      for (const v of this.node.iterable([e], bindings)) {
        bindings[(this.identifier as VariableExpansion).identifier] = v;
        yield e;
      }
    }
  }
}

class ConsBinaryOp implements Generator {
  constructor(
    private readonly left: Generator,
    private readonly right: Generator
  ) {}

  *iterable(input: Iterable<unknown>, bindings: Record<string, unknown>): Iterable<unknown> {
    yield* this.left.iterable(input, bindings);
    yield* this.right.iterable(input, bindings);
  }
}

class ArgList implements Generator {
  constructor(public readonly args: Generator[]) {}

  *iterable(input: Iterable<unknown>, bindings: Record<string, unknown>): Iterable<unknown> {
    if (this.args.length === 1) {
      yield* this.args[0].iterable(input, bindings);
    } else {
      yield* iterateAll(this.args, 0, input, [], bindings);
    }
  }
}

function* iterateAll(
  generators: Generator[],
  idx: number,
  input: Iterable<unknown>,
  arr: unknown[],
  bindings: Record<string, unknown>
): Iterable<unknown[]> {
  for (const a of generators[idx].iterable(input, bindings)) {
    const nc = [...arr, a];
    if (idx === generators.length - 1) {
      yield nc;
    } else {
      yield* iterateAll(generators, idx + 1, input, nc, bindings);
    }
  }
}

class AnyFilter extends BaseGenerator {
  *handle(e: unknown): Iterable<unknown> {
    yield Array.isArray(e) && e.some(a => !!a);
  }
}

class AllFilter extends BaseGenerator {
  *handle(e: unknown): Iterable<unknown> {
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

  *handle(el: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    if (Array.isArray(el)) {
      const res = this.fn(el.map(e => [e, exactOne(this.node.iterable([e], bindings))]));
      if (isTaggedType(res, 'single')) yield res._val;
      else if (Array.isArray(res)) {
        return yield (this.fn(res) as [unknown, unknown][]).map(a => a[0]);
      } else yield res;
    } else {
      yield el;
    }
  }
}

class NthFilter extends BaseGenerator {
  constructor(private readonly args: ArgList) {
    super();
  }

  *handle(el: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    for (const IDX of this.args.args[0].iterable([el], bindings)) {
      const idx = safeNum(IDX);
      if (this.args.args.length === 1 && Array.isArray(el)) {
        yield el.at(idx);
      } else if (this.args.args.length === 2) {
        const arr = [...this.args.args[1].iterable([el], bindings)];
        yield (arr as unknown[]).at(idx);
      }
    }
  }
}

const ArrayFilterFns: Record<string, ArrayFn> = {
  UNIQUE: arr =>
    arr
      .filter((e, i) => arr.findIndex(a => a[1] === e[1]) === i)
      .sort((a, b) => (a[1] as number) - (b[1] as number)),
  ADD: arr =>
    tag('single', arr.length === 0 ? undefined : arr.map(a => a[1]).reduce((a, b) => add(a, b))),
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

class ObjectTemplate extends BaseGenerator {
  constructor(private readonly template: any) {
    super();
  }

  *handle(el: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
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

class StringFn extends BaseGenerator {
  constructor(
    private readonly node: Generator,
    private readonly fn: (a: string, b: string) => unknown
  ) {
    super();
  }

  *handle(el: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    const arg = exactOne(this.node.iterable([undefined], bindings));
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

  *handle(el: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    for (const r of this.node.iterable([el], bindings)) {
      if (Array.isArray(el)) yield el.join(r as string);
      else yield el;
    }
  }
}

class AbsFilter extends BaseGenerator {
  *handle(el: unknown): Iterable<unknown> {
    if (typeof el === 'number') yield Math.abs(el);
    else yield el;
  }
}

class KeysFilter extends BaseGenerator {
  *handle(el: unknown): Iterable<unknown> {
    if (el && typeof el === 'object') yield Object.keys(el).sort();
    else yield el;
  }
}

class MapValuesFn extends BaseGenerator {
  constructor(public readonly node: Generator) {
    super();
  }

  *handle(el: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    if (isObj(el)) {
      yield Object.fromEntries(
        Object.entries(el).map(([k, v]) => [k, exactOne(this.node.iterable([v], bindings))])
      );
    } else if (Array.isArray(el)) {
      yield el.map(e => exactOne(this.node.iterable([e], bindings)));
    } else {
      yield el;
    }
  }
}

class ContainsFn extends BaseGenerator {
  constructor(public readonly node: Generator) {
    super();
  }

  *handle(el: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    const cv = this.node.iterable([undefined], bindings);

    for (const a of cv) {
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

class VariableExpansion extends BaseGenerator {
  constructor(public readonly identifier: string) {
    super();
  }

  *handle(_el: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    yield bindings[this.identifier];
  }
}

type FnDef = {
  arg?: string[];
  body: Generator;
};

class FunctionCall extends BaseGenerator {
  constructor(
    public readonly identifier: string,
    public readonly arg?: ArgList
  ) {
    super();
  }

  *handle(input: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
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

class FunctionDef implements Generator {
  constructor(
    public readonly identifier: string,
    public readonly arg: string[],
    public readonly body: Generator
  ) {}

  // eslint-disable-next-line require-yield
  *iterable(_input: Iterable<unknown>, bindings: Record<string, unknown>): Iterable<unknown> {
    bindings[this.identifier] = {
      arg: this.arg,
      body: this.body
    };
  }
}

class RangeGenerator extends BaseGenerator {
  constructor(private readonly node: ArgList) {
    super();
  }

  *handle(el: unknown, bindings: Record<string, unknown>): Iterable<unknown> {
    for (const args of iterateAll(this.node.args, 0, [el], [], bindings)) {
      const from = (args.length === 1 ? 0 : args[0]) as number;
      const to = (args.length === 1 ? args[0] : args[1]) as number;
      const step = (args[2] ?? 1) as number;

      for (let i = from; step > 0 ? i < to : i > to; i += step) {
        yield i;
      }
    }
  }
}

class Noop implements Generator {
  *iterable(_input: Iterable<unknown>, _bindings: Record<string, unknown>): Iterable<unknown> {}
}

class LimitGenerator implements Generator {
  constructor(private readonly node: ArgList) {}

  *iterable(input: Iterable<unknown>, bindings: Record<string, unknown>): Iterable<unknown> {
    for (const M of this.node.args[0].iterable(input, bindings)) {
      let m = safeNum(M);
      for (const e of this.node.args[1].iterable(input, bindings)) {
        if (m === 0) break;
        yield e;
        m--;
      }
    }
  }
}

class ParenExpression implements Generator {
  constructor(private readonly node: Generator) {}

  *iterable(input: Iterable<unknown>, bindings: Record<string, unknown>): Iterable<unknown> {
    yield* this.node.iterable(input, { ...bindings });
  }
}

const parsePathExpression = (tokenizer: Tokenizer): Generator => {
  let left: Generator = new PropertyLookupOp('');

  tokenizer.accept('.');

  let token = tokenizer.peek();

  return boundLoop(() => {
    if (token.type === 'id' || token.type === 'str') {
      tokenizer.next();
      const s = token.type === 'str' ? token.s.slice(1, -1) : token.s;
      const strict = !tokenizer.accept('?');
      left = new PathExpression(left, new PropertyLookupOp(s, strict));
    } else if (token.s === '[') {
      tokenizer.next();
      const nextToken = tokenizer.next();
      if (nextToken.type === 'str') {
        left = new PathExpression(left, new PropertyLookupOp(nextToken.s.slice(1, -1)));
        tokenizer.expect(']');
      } else if (nextToken.s === ']') {
        left = new PathExpression(left, new ArrayGenerator());
      } else if (nextToken.type === 'num') {
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
      return left;
    }

    token = tokenizer.peek();
  });
};

const parseOperand = (tokenizer: Tokenizer, functions: Record<string, number>): Generator => {
  const tok = tokenizer.peek();
  if (tok.s === '[') {
    tokenizer.next();
    const inner =
      tokenizer.peek().s !== ']' ? parseExpression(tokenizer, undefined, functions) : new Noop();
    tokenizer.expect(']');

    return new ArrayConstructor(inner);
  } else if (tok.s === '(') {
    tokenizer.next();
    const inner = parseExpression(tokenizer, undefined, functions);
    tokenizer.expect(')');
    return new ParenExpression(inner);
  } else if (tok.s === '.') {
    return parsePathExpression(tokenizer);
  } else if (tok.s === '$') {
    tokenizer.next();
    return new VariableExpansion('$' + tokenizer.next().s);
  } else if (tok.s === 'def') {
    tokenizer.next();
    tokenizer.strip();

    const name = tokenizer.next();

    const args: string[] = [];
    if (tokenizer.peek().s === '(') {
      tokenizer.expect('(');
      boundLoop(() => {
        args.push(tokenizer.next().s);
        tokenizer.strip();
        if (!tokenizer.accept(';')) return true;
      });
      tokenizer.expect(')');
    }

    tokenizer.expect(':');

    const innerFunctions = { ...functions, [name.s]: args.length };
    args.forEach(e => (innerFunctions[e] = 0));
    const body = parseExpression(tokenizer, undefined, innerFunctions);

    functions[name.s] = args.length;

    tokenizer.accept(';');

    return new FunctionDef(name.s, args, body);

    /* LITERALS ************************************************************************** */
  } else if (tok.type === 'num') {
    return new Literal(Number(tokenizer.next().s));
  } else if (tok.s === '{') {
    const res = OObjects.parse(tokenizer);
    if (res.val().__generators) {
      return new ObjectTemplate(res.val());
    } else {
      return new Literal(res.val());
    }
  } else if (tok.type === 'str') {
    return new Literal(tokenizer.next().s.slice(1, -1));
  } else if (tok.s === 'null') {
    tokenizer.next();
    return new Literal(null);
  } else if (tok.s === 'false' || tok.s === 'true') {
    tokenizer.next();
    return new Literal(tok.s === 'true');

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

      tokenizer.expect('(');
      const inner = parseArgList(tokenizer, functions);
      tokenizer.expect(')');

      return reg.fn(inner);
    } else if (op in functions) {
      const argCount = functions[op];
      if (argCount === 0) {
        return new FunctionCall(op);
      } else {
        tokenizer.expect('(');
        const arg = parseArgList(tokenizer, functions);
        tokenizer.expect(')');

        return new FunctionCall(op, arg);
      }
    } else {
      throw new Error('Unknown function: ' + op);
    }
  }

  throw new Error('Parse operand: ' + tokenizer.head);
};

const parseExpression = (
  tokenizer: Tokenizer,
  lastOp: string | undefined,
  functions: Record<string, number>
): Generator => {
  tokenizer.strip();

  let left = parseOperand(tokenizer, functions);

  return boundLoop(() => {
    tokenizer.strip();

    const tok = tokenizer.peek().s;
    if (tok === ';') return left;

    if (!!BINOP_REGISTRY[tok] && (BINOP_ORDERING[tok] ?? 0) > (BINOP_ORDERING[lastOp ?? ''] ?? 0)) {
      const op = tokenizer.next().s;

      const right = parseExpression(tokenizer, op, functions);
      left = BINOP_REGISTRY[op](left, right);
    } else {
      return left;
    }
  });
};

const parseArgList = (tokenizer: Tokenizer, functions: Record<string, number>): ArgList => {
  const op = [];
  while (tokenizer.peek().s !== ')') {
    op.push(parseExpression(tokenizer, undefined, functions));
    tokenizer.strip();
    if (!tokenizer.accept(';')) break;
  }
  return new ArgList(op);
};

export const parse = (query: string): Generator => {
  const tokenizer = new Tokenizer(query);

  const functions = {};
  const op = [];
  while (tokenizer.peek().type !== 'end') {
    op.push(parseExpression(tokenizer, undefined, functions));
  }

  return op.reduceRight((a, b) => new ConsBinaryOp(b, a));
};

export const query = (query: string, input: unknown[], bindings?: Record<string, unknown>) => {
  return [...parse(query).iterable(input, bindings ?? {})];
};
