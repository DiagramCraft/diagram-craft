/* eslint-disable @typescript-eslint/no-explicit-any */
import { isObj } from './object.ts';

/*
type ResultSet = {
  _type: 'resultSet';
  _values: unknown[];
};
 */

interface ASTNode {
  evaluate(input: unknown[]): unknown[];
}

class PropertyLookup implements ASTNode {
  constructor(public readonly identifier: string) {}

  evaluate(input: unknown[]): unknown[] {
    if (
      this.identifier === '' ||
      this.identifier === 'prototype' ||
      this.identifier === 'constructor'
    )
      return input;
    return input.map(i => (i === undefined ? undefined : (i as any)[this.identifier]));
  }
}

class ArrayIndexOperator implements ASTNode {
  private readonly index: number;

  constructor(query: string) {
    this.index = parseInt(query);
  }

  evaluate(input: unknown[]): unknown[] {
    return input.map(i => {
      if (i === undefined) return undefined;
      if (Array.isArray(i)) {
        return i[this.index];
      } else {
        return undefined;
      }
    });
  }
}

class ArraySliceOperator implements ASTNode {
  private readonly from: number;
  private readonly to: number;

  constructor(query: string) {
    const [from, to] = query.split(':');
    this.from = from === '' ? 0 : parseInt(from);
    this.to = to === '' ? Infinity : parseInt(to);
  }

  evaluate(input: unknown[]): unknown[] {
    return input.map(i => {
      if (i === undefined) return undefined;
      if (Array.isArray(i)) {
        return i.slice(this.from, Math.min(this.to, i.length));
      } else {
        return undefined;
      }
    });
  }
}

class ArrayOperator implements ASTNode {
  constructor() {}

  evaluate(input: unknown[]): unknown[] {
    return input.flatMap(i => (Array.isArray(i) || isObj(i) ? i : undefined));
  }
}

class Sequence implements ASTNode {
  constructor(public readonly nodes: ASTNode[]) {}

  evaluate(input: unknown[]): unknown[] {
    return this.nodes.map(n => {
      const res = n.evaluate(input);
      if (res === undefined || res.length === 1 || res.length === 0) return res?.[0];
      return res;
    });
  }
}

class Group implements ASTNode {
  constructor(public readonly nodes: ASTNode[]) {}

  evaluate(input: unknown[]): unknown[] {
    let v = input;
    for (const node of this.nodes) {
      v = node.evaluate(v);
    }
    return v;
  }
}

class ArrayConstructor implements ASTNode {
  constructor(public readonly nodes: ASTNode[]) {}

  evaluate(input: unknown[]): unknown[] {
    return [this.nodes.flatMap(n => n.evaluate(input))];
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

      dest.push(new ArrayConstructor(parse(remaining.slice(0, end).trim())));
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

export const query = (query: string, input: any[]) => {
  const ast = parse(query);

  let v = input;
  for (const node of ast) {
    v = node.evaluate(v);
  }
  return v;
};

export const queryOne = (q: string, input: any) => {
  const res = query(q, [input]);
  if (res === undefined || res.length === 1 || res.length === 0) return res?.[0];
  else {
    console.log(q, input, res);
    throw new Error('Expected one result, got ' + res.length);
  }
};
