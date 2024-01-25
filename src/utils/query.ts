/* eslint-disable @typescript-eslint/no-explicit-any */
import { isObj } from './object.ts';

type ResultSet = {
  _type: 'resultSet';
  _values: unknown[];
};

export const ResultSet = {
  of: (o: unknown): ResultSet => {
    return {
      _type: 'resultSet',
      _values: [o]
    };
  },
  ofList: (...o: unknown[]): ResultSet => {
    return {
      _type: 'resultSet',
      _values: o
    };
  }
};

const map = (input: ResultSet, fn: (v: unknown) => unknown) => {
  return {
    _type: 'resultSet',
    _values: input._values.map(fn)
  } satisfies ResultSet;
};

const flatMap = (input: ResultSet, fn: (v: unknown) => unknown) => {
  return {
    _type: 'resultSet',
    _values: input._values.flatMap(fn)
  } satisfies ResultSet;
};

const flatten = (arr: unknown[]) => {
  const dest: unknown[] = [];
  for (let i = 0; i < arr.length; i++) {
    if ((arr[i] as any)?._type === 'resultSet') {
      dest.push(...(arr[i] as ResultSet)._values);
    } else {
      dest.push(arr[i]);
    }
  }
  return dest;
};

interface ASTNode {
  evaluate(input: ResultSet): ResultSet;
}

export class PropertyLookup implements ASTNode {
  constructor(public readonly identifier: string) {}

  evaluate(input: ResultSet): ResultSet {
    if (this.identifier === '') return input;
    if (this.identifier === 'prototype' || this.identifier === 'constructor')
      return ResultSet.of(undefined);
    return map(input, i => (i === undefined ? undefined : (i as any)[this.identifier]));
  }
}

export class ArrayIndexOperator implements ASTNode {
  private readonly index: number;

  constructor(query: string) {
    this.index = parseInt(query);
  }

  evaluate(input: ResultSet): ResultSet {
    return map(input, i => {
      if (i === undefined) return undefined;
      if (Array.isArray(i)) {
        return i[this.index];
      } else {
        return undefined;
      }
    });
  }
}

export class ArraySliceOperator implements ASTNode {
  private readonly from: number;
  private readonly to: number;

  constructor(query: string) {
    const [from, to] = query.split(':');
    this.from = from === '' ? 0 : parseInt(from);
    this.to = to === '' ? Infinity : parseInt(to);
  }

  evaluate(input: ResultSet): ResultSet {
    return map(input, i => {
      if (i === undefined) return undefined;
      if (Array.isArray(i)) {
        return i.slice(this.from, Math.min(this.to, i.length));
      } else {
        return undefined;
      }
    });
  }
}

export class ArrayOperator implements ASTNode {
  constructor() {}

  evaluate(input: ResultSet): ResultSet {
    return flatMap(input, i => {
      if (Array.isArray(i) || isObj(i)) return i;
      else throw new Error();
    });
  }
}

export class Sequence implements ASTNode {
  constructor(public readonly nodes: ASTNode[]) {}

  evaluate(input: ResultSet): ResultSet {
    const dest: ResultSet[] = [];
    input._values.forEach(i => {
      const v = ResultSet.of(i);
      for (const node of this.nodes) {
        dest.push(node.evaluate(v));
      }
      return v;
    });

    return ResultSet.ofList(...flatten(dest));
  }
}

export class Group implements ASTNode {
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

export class RecursiveDescentOperator implements ASTNode {
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

const safeParseInt = (s: string) => {
  const n = Number(s);
  return isNaN(n) ? 0 : n;
};

export class AdditionOperator implements ASTNode {
  constructor(
    public readonly left: ASTNode,
    public readonly right: ASTNode
  ) {}

  evaluate(input: ResultSet): ResultSet {
    return map(input, v => {
      const lv = this.left.evaluate(ResultSet.of(v));
      const rv = this.right.evaluate(ResultSet.of(v));

      const lvs = lv._values?.[0];
      const rvs = rv._values?.[0];

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

export class SubtractionOperator implements ASTNode {
  constructor(
    public readonly left: ASTNode,
    public readonly right: ASTNode
  ) {}

  evaluate(input: ResultSet): ResultSet {
    return map(input, v => {
      const lv = this.left.evaluate(ResultSet.of(v));
      const rv = this.right.evaluate(ResultSet.of(v));

      const lvs = lv._values?.[0];
      const rvs = rv._values?.[0];

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

class LiteralOperator implements ASTNode {
  constructor(public readonly value: unknown) {}

  evaluate(_input: ResultSet): ResultSet {
    return ResultSet.of(this.value);
  }
}

class LengthOperator implements ASTNode {
  constructor() {}

  evaluate(input: ResultSet): ResultSet {
    return map(input, v => {
      if (v === undefined || v === null) {
        return 0;
      } else if (Array.isArray(v)) {
        return v.length;
      } else if (typeof v === 'string') {
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

const nextToken = (q: string, arr: ASTNode[]): [string, ASTNode | undefined, ASTNode[]] => {
  let m;
  if (q.startsWith('|')) {
    return [q.slice(1), undefined, arr];
  } else if (q.startsWith(',')) {
    const last = arr.at(-1)!;
    if (!(last instanceof Sequence)) {
      const seq = new Sequence([last]);
      arr[arr.length - 1] = seq;
      return [q.slice(1), undefined, seq.nodes];
    } else {
      return [q.slice(1), undefined, arr];
    }
  } else if (q.startsWith('..')) {
    return [q.slice(2), new RecursiveDescentOperator(), arr];
  } else if (q.startsWith('+')) {
    const [nextS, nextTok, nextArr] = nextToken(q.slice(1).trim(), arr);
    if (!nextTok) throw new Error();
    arr[arr.length - 1] = new AdditionOperator(arr.at(-1)!, nextTok);
    return [nextS, undefined, nextArr];
  } else if (q.startsWith('-')) {
    const [nextS, nextTok, nextArr] = nextToken(q.slice(1).trim(), arr);
    if (!nextTok) throw new Error();
    arr[arr.length - 1] = new SubtractionOperator(arr.at(-1)!, nextTok);
    return [nextS, undefined, nextArr];
  } else if (q.startsWith('[')) {
    q = q.slice(1);

    // Find right ] (considering balanced brackets)
    let depth = 1;
    let end = 0;
    for (; end < q.length; end++) {
      if (q[end] === '[') depth++;
      else if (q[end] === ']') {
        depth--;
        if (depth === 0) break;
      }
    }

    if (depth !== 0) throw new Error('Unbalanced brackets');

    return [q.slice(end + 1), new ArrayConstructor(new Group(parse(q.slice(0, end).trim()))), arr];
  } else if ((m = q.match(/^\.([a-zA-Z_]?[a-zA-Z0-9_]*)\[([^\]]*)\]/))) {
    const s = q.slice(m[0].length);

    const [, identifier, arrayQuery] = m;

    if (arrayQuery === '') {
      return [s, new Group([new PropertyLookup(identifier), new ArrayOperator()]), arr];
    } else if (arrayQuery.includes(':')) {
      return [
        s,
        new Group([new PropertyLookup(identifier), new ArraySliceOperator(arrayQuery)]),
        arr
      ];
    } else {
      return [
        s,
        new Group([new PropertyLookup(identifier), new ArrayIndexOperator(arrayQuery)]),
        arr
      ];
    }
  } else if ((m = q.match(/^\.[a-zA-Z_]?[a-zA-Z0-9_]*/))) {
    return [q.slice(m[0].length), new PropertyLookup(m[0].slice(1)), arr];
  } else if ((m = q.match(/^[0-9]+/))) {
    return [q.slice(m[0].length), new LiteralOperator(m[0]), arr];
  } else if (q.startsWith('null')) {
    return [q.slice(4), new LiteralOperator(null), arr];
  } else if (q.startsWith('{')) {
    // Find right } (considering balanced brackets)
    let depth = 0;
    let end = 0;
    for (; end < q.length; end++) {
      if (q[end] === '{') depth++;
      else if (q[end] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }

    if (depth !== 0) throw new Error('Unbalanced brackets');

    // TODO: Must remove eval here
    return [
      q.slice(end + 1),
      new LiteralOperator(eval('(' + q.slice(0, end + 1).trim() + ')')),
      arr
    ];
  } else if (q.startsWith('"')) {
    // Find right " (considering balanced brackets)
    let end = 1;
    for (; end < q.length; end++) {
      if (q[end] === '"') break;
    }

    return [q.slice(end + 1), new LiteralOperator(q.slice(1, end)), arr];
  } else if (q.startsWith('length')) {
    return [q.slice(6), new LengthOperator(), arr];
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

    q = s.trim(); // q.slice(s.length).trim();
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
