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

const the = (r: ResultSet) => {
  assert.true(r._values.length === 1);
  return r._values[0];
};

const removeUndefined = (input: ResultSet) => {
  return ResultSet.ofList(...input._values.filter(a => a !== undefined && a !== null));
};

const map = (input: ResultSet, fn: (v: unknown) => unknown) => {
  return ResultSet.ofList(...input._values.map(fn));
};

const flatMap = (input: ResultSet, fn: (v: unknown) => unknown) => {
  return ResultSet.ofList(...input._values.flatMap(fn));
};

const isResultSet = (o: unknown): o is ResultSet => (o as any)?._type === 'resultSet';

const flatten = (arr: unknown[]) => {
  const dest: unknown[] = [];
  for (const e of arr) {
    if (isResultSet(e)) {
      dest.push(...e._values);
    } else {
      dest.push(e);
    }
  }
  return dest;
};

interface ASTNode {
  evaluate(input: ResultSet): ResultSet;
}

export class PropertyLookupOp implements ASTNode {
  constructor(public readonly identifier: string) {}

  evaluate(input: ResultSet): ResultSet {
    if (this.identifier === '') return input;
    assert.false(this.identifier === 'prototype' || this.identifier === 'constructor');
    return map(input, i => (i === undefined ? undefined : (i as any)[this.identifier]));
  }
}

export class ArrayIndexOp implements ASTNode {
  constructor(private readonly index: number) {}

  evaluate(input: ResultSet): ResultSet {
    return map(input, i => {
      if (i === undefined || !Array.isArray(i)) return undefined;
      return i[this.index];
    });
  }
}

export class ArraySliceOp implements ASTNode {
  constructor(
    private readonly from: number,
    private readonly to: number
  ) {}

  evaluate(input: ResultSet): ResultSet {
    return map(input, i => {
      if (i === undefined || !Array.isArray(i)) return undefined;
      return i.slice(this.from, Math.min(this.to, i.length));
    });
  }
}

export class ArrayOp implements ASTNode {
  constructor() {}

  evaluate(input: ResultSet): ResultSet {
    return flatMap(input, i => {
      assert.true(Array.isArray(i) || isObj(i));
      return i;
    });
  }
}

export class Concatenation implements ASTNode {
  constructor(public readonly nodes: ASTNode[]) {}

  evaluate(input: ResultSet): ResultSet {
    const dest: ResultSet[] = [];
    input._values.forEach(i => {
      for (const node of this.nodes) {
        dest.push(node.evaluate(ResultSet.of(i)));
      }
    });

    return ResultSet.ofList(...flatten(dest));
  }
}

export class FilterSequence implements ASTNode {
  constructor(public readonly nodes: ASTNode[]) {}

  evaluate(input: ResultSet): ResultSet {
    let v = input;
    for (const node of this.nodes) {
      v = node.evaluate(v);
    }
    return v;
  }
}

export class ArrayConstructor implements ASTNode {
  constructor(public readonly node: ASTNode) {}

  evaluate(input: ResultSet): ResultSet {
    return ResultSet.ofList(...input._values.map(i => this.node.evaluate(ResultSet.of(i))._values));
  }
}

//export class ObjectConstructor implements ASTNode {}

export class RecursiveDescentOp implements ASTNode {
  constructor() {}

  evaluate(input: ResultSet): ResultSet {
    const dest: unknown[] = [];
    input._values.forEach(e => this.recurse(e, dest));
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

export class AdditionBinaryOp implements ASTNode {
  constructor(
    public readonly left: ASTNode,
    public readonly right: ASTNode
  ) {}

  evaluate(input: ResultSet): ResultSet {
    return map(input, v => {
      const lvs = the(this.left.evaluate(ResultSet.of(v)));
      const rvs = the(this.right.evaluate(ResultSet.of(v)));

      if (Array.isArray(lvs) && Array.isArray(rvs)) {
        return [...lvs, ...rvs];
      } else if (isObj(lvs) && isObj(rvs)) {
        return { ...lvs, ...rvs };
      } else {
        // @ts-ignore
        return safeParseInt(lvs) + safeParseInt(rvs);
      }
    });
  }
}

export class SubtractionBinaryOp implements ASTNode {
  constructor(
    public readonly left: ASTNode,
    public readonly right: ASTNode
  ) {}

  evaluate(input: ResultSet): ResultSet {
    return map(input, v => {
      const lvs = the(this.left.evaluate(ResultSet.of(v)));
      const rvs = the(this.right.evaluate(ResultSet.of(v)));

      if (Array.isArray(lvs) && Array.isArray(rvs)) {
        return lvs.filter(e => !rvs.includes(e));
      } else if (isObj(lvs) && isObj(rvs)) {
        return Object.fromEntries(
          Object.entries(lvs).filter(([k]) => !Object.keys(rvs).includes(k))
        );
      } else {
        // @ts-ignore
        return safeParseInt(lvs) - safeParseInt(rvs);
      }
    });
  }
}

class Literal implements ASTNode {
  constructor(public readonly value: unknown) {}

  evaluate(_input: ResultSet): ResultSet {
    return ResultSet.of(this.value);
  }
}

class LengthFilter implements ASTNode {
  constructor() {}

  evaluate(input: ResultSet): ResultSet {
    return map(input, v => {
      if (v === undefined || v === null) {
        return 0;
      } else if (Array.isArray(v) || typeof v === 'string') {
        return v.length;
      } else if (!isNaN(Number(v))) {
        return Math.abs(Number(v));
      } else if (isObj(v)) {
        return Object.keys(v).length;
      } else {
        return undefined;
      }
    });
  }
}

class HasFn implements ASTNode {
  constructor(public readonly node: ASTNode) {}

  evaluate(input: ResultSet): ResultSet {
    assert.present(this.node);
    return map(input, v => {
      const res = this.node.evaluate(ResultSet.of(undefined));
      return (the(res) as string | number) in (v as any);
    });
  }
}

class InFn implements ASTNode {
  constructor(public readonly node: ASTNode) {}

  evaluate(input: ResultSet): ResultSet {
    assert.present(this.node);
    return map(input, v => {
      const res = this.node.evaluate(ResultSet.of(undefined));
      return (v as any) in (the(res) as any);
    });
  }
}

class SelectFn implements ASTNode {
  constructor(public readonly node: ASTNode) {}

  evaluate(input: ResultSet): ResultSet {
    assert.present(this.node);
    return removeUndefined(
      map(input, v => {
        if (the(this.node.evaluate(ResultSet.of(v))) === true) return v;
      })
    );
  }
}

class EqualsBinaryOp implements ASTNode {
  constructor(
    private readonly left: ASTNode,
    private readonly right: ASTNode,
    private readonly negate: boolean
  ) {}

  evaluate(input: ResultSet): ResultSet {
    return map(input, v => {
      const lvs = the(this.left.evaluate(ResultSet.of(v)));
      const rvs = the(this.right.evaluate(ResultSet.of(v)));

      if (Array.isArray(lvs) && Array.isArray(rvs)) {
        throw NOT_IMPLEMENTED_YET();
      } else if (isObj(lvs) && isObj(rvs)) {
        throw NOT_IMPLEMENTED_YET();
      } else {
        // @ts-ignore
        return lvs === rvs && !this.negate;
      }
    });
  }
}

class CmpBinaryOp implements ASTNode {
  constructor(
    private readonly left: ASTNode,
    private readonly right: ASTNode,
    private readonly cmp: (a: unknown, b: unknown) => boolean
  ) {}

  evaluate(input: ResultSet): ResultSet {
    return map(input, v => {
      const lvs = the(this.left.evaluate(ResultSet.of(v)));
      const rvs = the(this.right.evaluate(ResultSet.of(v)));
      return !!this.cmp(lvs, rvs);
    });
  }
}

class AnyFilter implements ASTNode {
  evaluate(input: ResultSet): ResultSet {
    return map(input, v => Array.isArray(v) && v.some(a => !!a));
  }
}

class AllFilter implements ASTNode {
  evaluate(input: ResultSet): ResultSet {
    return map(input, v => Array.isArray(v) && v.every(a => !!a));
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

const makeFN = (
  fnName: string,
  q: string,
  arr: ASTNode[],
  ctr: new (n: ASTNode) => ASTNode
): [string, ASTNode, ASTNode[]] => {
  const { end, sub } = getBetweenBrackets(q.slice(fnName.length), '(', ')');
  return [q.slice(end + fnName.length + 1), new ctr(parse(sub)[0]), arr];
};

const makeBinaryOp = <T>(
  op: string,
  q: string,
  arr: ASTNode[],
  ctr: new (l: ASTNode, r: ASTNode, arg?: T) => ASTNode,
  arg?: T
): [string, ASTNode | undefined, ASTNode[]] => {
  const [nextS, nextTok, nextArr] = nextToken(q.slice(op.length).trim(), arr);
  assert.present(nextTok);
  arr[arr.length - 1] = new ctr(arr.at(-1)!, nextTok, arg);
  return [nextS, undefined, nextArr];
};

const nextToken = (q: string, arr: ASTNode[]): [string, ASTNode | undefined, ASTNode[]] => {
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
    return [q.slice(2), new RecursiveDescentOp(), arr];
  } else if (q.startsWith('+')) {
    return makeBinaryOp('+', q, arr, AdditionBinaryOp);
  } else if (q.startsWith('-')) {
    return makeBinaryOp('-', q, arr, SubtractionBinaryOp);
  } else if (q.startsWith('[')) {
    const { end, sub } = getBetweenBrackets(q, '[', ']');
    return [q.slice(end + 1), new ArrayConstructor(new FilterSequence(parse(sub.trim()))), arr];
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
      new ArrayConstructor(new FilterSequence([new ArrayOp(), new Concatenation(parse(sub))])),
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
    return makeBinaryOp('or', q, arr, CmpBinaryOp, (a, b) => {
      console.log('||', a, b);
      return a || b;
    });
  } else if (q.startsWith('not')) {
    return [q.slice(3), new EqualsBinaryOp(new Literal(true), arr.at(-1)!, true), arr];
  } else if (q.startsWith('false')) {
    return [q.slice(5), new Literal(false), arr];
  } else if (q.startsWith('true')) {
    return [q.slice(4), new Literal(true), arr];
  }

  throw new Error(`Cannot parse: ${q}`);
};

const parse = (query: string) => {
  const dest: ASTNode[] = [];

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

  return dest;
};

export const query = (query: string, input: ResultSet) => {
  const ast = parse(query);

  let v = input;
  for (const node of ast) {
    v = node.evaluate(v);
  }
  return v._values;
};

export const queryOne = (q: string, input: any) => {
  const res = query(q, { _type: 'resultSet', _values: [input] });
  if (res === undefined || res.length === 1 || res.length === 0) return res?.[0];
  else {
    throw new Error('Expected one result, got ' + res.length);
  }
};
