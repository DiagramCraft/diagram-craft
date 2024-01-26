/* eslint-disable @typescript-eslint/no-explicit-any */
import { isObj } from './object.ts';
import { assert, NOT_IMPLEMENTED_YET } from './assert.ts';

const safeParseInt = (s: string) => {
  const n = Number(s);
  return isNaN(n) ? 0 : n;
};

type ResultSet = {
  _type: 'resultSet';
  _values: unknown[];
};

export const ResultSet = {
  of: (o: unknown): ResultSet => ({
    _type: 'resultSet',
    _values: [o]
  }),
  ofList: (...o: unknown[]): ResultSet => ({
    _type: 'resultSet',
    _values: o
  })
};

const isResultSet = (o: unknown): o is ResultSet => (o as any)?._type === 'resultSet';

interface Operator {
  evaluate(input: unknown): unknown;
}

interface Generator extends Operator {
  evaluate(input: unknown): ResultSet;
}

export class PropertyLookupOp implements Operator {
  constructor(public readonly identifier: string) {}

  evaluate(input: unknown): unknown {
    if (this.identifier === '') return input;
    // TODO: Maye we should remove this and rely of .a?
    if (input === undefined) return undefined;
    assert.false(this.identifier === 'prototype' || this.identifier === 'constructor');
    return (input as any)[this.identifier];
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

export class ArrayOp implements Generator {
  constructor() {}

  evaluate(i: unknown): ResultSet {
    assert.true(Array.isArray(i));
    return ResultSet.ofList(...(i as unknown[]));
  }
}

export class Concatenation implements Generator {
  constructor(public readonly nodes: Operator[]) {}

  evaluate(input: unknown): ResultSet {
    const dest: unknown[] = [];
    for (const n of this.nodes) {
      const r = n.evaluate(input);
      if (isResultSet(r)) {
        dest.push(...r._values);
      } else {
        dest.push(r);
      }
    }
    return ResultSet.ofList(...dest);
  }
}

export class FilterSequence implements Generator {
  constructor(public readonly nodes: Operator[]) {}

  evaluate(input: unknown): ResultSet {
    let v = [input];
    for (const node of this.nodes) {
      const dest: unknown[] = [];
      for (const e of v) {
        const res = node.evaluate(e);
        if (isResultSet(res)) {
          dest.push(...res._values);
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
      return [...v._values];
    } else {
      return [v];
    }
  }
}

//export class ObjectConstructor implements Operator {}

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
      // @ts-ignore
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
      // @ts-ignore
      return safeParseInt(lvs) - safeParseInt(rvs);
    }
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
      // @ts-ignore
      return this.negate ? lvs !== rvs : lvs === rvs;
    }
  }
}

class CmpBinaryOp implements Operator {
  constructor(
    private readonly left: Operator,
    private readonly right: Operator,
    private readonly cmp: (a: unknown, b: unknown) => boolean
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

class UniqueFilter implements Operator {
  evaluate(input: unknown): unknown {
    if (Array.isArray(input)) {
      return input.filter((a, i) => input.indexOf(a) === i);
    } else {
      return input;
    }
  }
}

class StringFn implements Operator {
  constructor(
    private readonly node: Operator,
    private readonly fn: (a: string, b: string) => boolean
  ) {}

  evaluate(input: unknown): unknown {
    const lvs = input;
    const rvs = this.node.evaluate(undefined);
    if (Array.isArray(lvs)) return lvs.map(a => this.fn(a as string, rvs as string));
    // @ts-ignore
    return this.fn(lvs as string, rvs as string);
  }
}

const getBetweenBrackets = (q: string, left: string, right: string) => {
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

const makeFN = <T>(
  fnName: string,
  q: string,
  arr: Operator[],
  ctr: new (n: Operator, arg?: T) => Operator,
  arg?: T
): [string, Operator, Operator[]] => {
  const { end, sub } = getBetweenBrackets(q.slice(fnName.length), '(', ')');
  return [q.slice(end + fnName.length + 1), new ctr(parse(sub), arg), arr];
};

const makeBinaryOp = <T>(
  op: string,
  q: string,
  arr: Operator[],
  ctr: new (l: Operator, r: Operator, arg?: T) => Operator,
  arg?: T
): [string, Operator | undefined, Operator[]] => {
  const [nextS, nextTok, nextArr] = nextToken(q.slice(op.length).trim(), arr);
  assert.present(nextTok);
  arr[arr.length - 1] = new ctr(arr.at(-1)!, nextTok, arg);
  return [nextS, undefined, nextArr];
};

const nextToken = (q: string, arr: Operator[]): [string, Operator | undefined, Operator[]] => {
  let m;
  if (q.startsWith('|')) {
    return [q.slice(1), undefined, arr];
  } else if (q.startsWith(',')) {
    const last = arr.at(-1)!;
    if (!(last instanceof Concatenation)) {
      const seq = new Concatenation([last]);
      arr[arr.length - 1] = seq;
      return [q.slice(1), undefined, seq.nodes];
    } else {
      return [q.slice(1), undefined, arr];
    }
  } else if (q.startsWith('..')) {
    return [q.slice(2), new RecursiveDescentGenerator(), arr];
  } else if (q.startsWith('+')) {
    return makeBinaryOp('+', q, arr, AdditionBinaryOp);
  } else if (q.startsWith('-')) {
    return makeBinaryOp('-', q, arr, SubtractionBinaryOp);
  } else if (q.startsWith('[')) {
    const { end, sub } = getBetweenBrackets(q, '[', ']');
    return [q.slice(end + 1), new ArrayConstructor(new FilterSequence([parse(sub.trim())])), arr];
  } else if ((m = q.match(/^\.([a-zA-Z_]?[a-zA-Z0-9_]*)\[([^\]]*)\]/))) {
    const s = q.slice(m[0].length);

    const [, identifier, arrayQuery] = m;

    if (arrayQuery === '') {
      return [s, new FilterSequence([new PropertyLookupOp(identifier), new ArrayOp()]), arr];
    } else if (arrayQuery.includes(':')) {
      const [from, to] = arrayQuery.split(':');

      return [
        s,
        new FilterSequence([
          new PropertyLookupOp(identifier),
          new ArraySliceOp(from === '' ? 0 : parseInt(from), to === '' ? Infinity : parseInt(to))
        ]),
        arr
      ];
    } else {
      return [
        s,
        new FilterSequence([
          new PropertyLookupOp(identifier),
          new ArrayIndexOp(parseInt(arrayQuery))
        ]),
        arr
      ];
    }
  } else if ((m = q.match(/^\.[a-zA-Z_]?[a-zA-Z0-9_]*/))) {
    return [q.slice(m[0].length), new PropertyLookupOp(m[0].slice(1)), arr];
  } else if ((m = q.match(/^[0-9]+/))) {
    return [q.slice(m[0].length), new Literal(m[0]), arr];
  } else if (q.startsWith('null')) {
    return [q.slice(4), new Literal(null), arr];
  } else if (q.startsWith('{')) {
    const { end, sub } = getBetweenBrackets(q, '{', '}');

    return [
      q.slice(end + 1),
      // TODO: Must remove eval here
      new Literal(eval('({' + sub + '})')),
      arr
    ];
  } else if (q.startsWith('"')) {
    let end = 1;
    for (; end < q.length; end++) {
      if (q[end] === '"') break;
    }

    return [q.slice(end + 1), new Literal(q.slice(1, end)), arr];
  } else if (q.startsWith('length')) {
    return [q.slice(6), new LengthFilter(), arr];
  } else if (q.startsWith('has(')) {
    return makeFN('has', q, arr, HasFn);
  } else if (q.startsWith('in(')) {
    return makeFN('in', q, arr, InFn);
  } else if (q.startsWith('map(')) {
    const { end, sub } = getBetweenBrackets(q.slice(3), '(', ')');
    return [
      q.slice(3 + end + 1),
      new ArrayConstructor(new FilterSequence([new ArrayOp(), parse(sub)])),
      arr
    ];
  } else if (q.startsWith('map_values(')) {
    throw NOT_IMPLEMENTED_YET();
  } else if (q.startsWith('select(')) {
    return makeFN('select', q, arr, SelectFn);
  } else if (q.startsWith('==')) {
    // @ts-ignore
    return makeBinaryOp('==', q, arr, EqualsBinaryOp, false);
  } else if (q.startsWith('!=')) {
    // @ts-ignore
    return makeBinaryOp('!=', q, arr, EqualsBinaryOp, true);
  } else if (q.startsWith('>=')) {
    // @ts-ignore
    return makeBinaryOp('>=', q, arr, CmpBinaryOp, (a, b) => a >= b);
  } else if (q.startsWith('>')) {
    // @ts-ignore
    return makeBinaryOp('>', q, arr, CmpBinaryOp, (a, b) => a > b);
  } else if (q.startsWith('<=')) {
    // @ts-ignore
    return makeBinaryOp('<=', q, arr, CmpBinaryOp, (a, b) => a <= b);
  } else if (q.startsWith('<')) {
    // @ts-ignore
    return makeBinaryOp('<', q, arr, CmpBinaryOp, (a, b) => a < b);
  } else if (q.startsWith('any')) {
    // TODO: Handle function
    return [q.slice(3), new AnyFilter(), arr];
  } else if (q.startsWith('all')) {
    // TODO: Handle function
    return [q.slice(3), new AllFilter(), arr];
  } else if (q.startsWith('and')) {
    // @ts-ignore
    return makeBinaryOp('and', q, arr, CmpBinaryOp, (a, b) => a && b);
  } else if (q.startsWith('or')) {
    // @ts-ignore
    return makeBinaryOp('or', q, arr, CmpBinaryOp, (a, b) => a || b);
  } else if (q.startsWith('not')) {
    arr[arr.length - 1] = new EqualsBinaryOp(arr.at(-1)!, new Literal(true), true);
    return [q.slice(3), undefined, arr];
  } else if (q.startsWith('false')) {
    return [q.slice(5), new Literal(false), arr];
  } else if (q.startsWith('true')) {
    return [q.slice(4), new Literal(true), arr];
  } else if (q.startsWith('unique_by(')) {
    throw NOT_IMPLEMENTED_YET();
  } else if (q.startsWith('unique')) {
    return [q.slice(6), new UniqueFilter(), arr];
  } else if (q.startsWith('startswith(')) {
    // @ts-ignore
    return makeFN('startswith', q, arr, StringFn, (a, b) => a.startsWith(b));
  } else if (q.startsWith('endswith(')) {
    // @ts-ignore
    return makeFN('endswith', q, arr, StringFn, (a, b) => a.endswith(b));
  }

  throw new Error(`Cannot parse: ${q}`);
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

  return dest.length === 1 ? dest[0] : new FilterSequence(dest);
};

export const query = (query: string, input: unknown[]) => {
  const node = parse(query);

  const dest: unknown[] = [];
  for (const i of input) {
    let v = i;
    v = node.evaluate(v);
    if (isResultSet(v)) {
      dest.push(...v._values);
    } else {
      dest.push(v);
    }
  }
  return dest;
};

export const queryOne = (q: string, input: any) => {
  const res = query(q, [input]);
  if (res === undefined || res.length === 1 || res.length === 0) return res[0];
  else {
    throw new Error('Expected one result, got ' + res.length);
  }
};
