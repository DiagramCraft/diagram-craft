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

const parse = (query: string) => {
  const dest: ASTNode[] = [];
  let arr = dest;

  let remaining = query;

  let i = 0;
  do {
    let m;
    if (remaining.startsWith('|')) {
      remaining = remaining.slice(1);
    } else if (remaining.startsWith(',')) {
      remaining = remaining.slice(1);

      const last = arr.at(-1)!;
      if (!(last instanceof Sequence)) {
        const seq = new Sequence([last]);
        arr[arr.length - 1] = seq;
        arr = seq.nodes;
      }
    } else if (remaining.startsWith('[')) {
      remaining = remaining.slice(1);

      // Find right ] (considering balanced brackets)
      let depth = 1;
      let end = 0;
      for (; end < remaining.length; end++) {
        if (remaining[end] === '[') depth++;
        else if (remaining[end] === ']') {
          depth--;
          if (depth === 0) break;
        }
      }

      if (depth !== 0) throw new Error('Unbalanced brackets');

      dest.push(new ArrayConstructor(new Group(parse(remaining.slice(0, end).trim()))));
      remaining = remaining.slice(end + 1);
    } else if ((m = remaining.match(/^\.([a-zA-Z_]?[a-zA-Z0-9_]*)\[([^\]]*)\]/))) {
      remaining = remaining.slice(m[0].length);

      const [, identifier, arrayQuery] = m;

      if (arrayQuery === '') {
        arr.push(new Group([new PropertyLookup(identifier), new ArrayOperator()]));
      } else if (arrayQuery.includes(':')) {
        arr.push(new Group([new PropertyLookup(identifier), new ArraySliceOperator(arrayQuery)]));
      } else {
        arr.push(new Group([new PropertyLookup(identifier), new ArrayIndexOperator(arrayQuery)]));
      }
    } else if ((m = remaining.match(/^\.[a-zA-Z_]?[a-zA-Z0-9_]*/))) {
      remaining = remaining.slice(m[0].length);

      arr.push(new PropertyLookup(m[0].slice(1)));
    }

    remaining = remaining.trim();
    if (i++ > 100) throw new Error('Infinite loop detected');
  } while (remaining.trim().length > 0);

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
    console.log(q, input, res);
    throw new Error('Expected one result, got ' + res.length);
  }
};
