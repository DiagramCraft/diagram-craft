import { TextCompileError, type Token } from './entityQueryTextTypes';

const COMPARATORS = ['!=', '^=', '$=', '>=', '<=', ':', '=', '~', '>', '<'] as const;

const isIdentStart = (ch: string) => /[A-Za-z_]/.test(ch);
const isIdentChar = (ch: string) => /[A-Za-z0-9_]/.test(ch);

const readQuotedString = (input: string, start: number): { value: string; end: number } => {
  let out = '';
  let i = start + 1;
  while (i < input.length) {
    const ch = input[i];
    if (ch === '"') return { value: out, end: i + 1 };
    if (ch === '\\') {
      const next = input[i + 1];
      if (next === '"' || next === '\\') {
        out += next;
        i += 2;
        continue;
      }
      throw new TextCompileError(
        `Invalid escape sequence '\\${next ?? ''}' in quoted string — only \\" and \\\\ are valid`,
        i
      );
    }
    out += ch;
    i += 1;
  }
  throw new TextCompileError('Unterminated quoted string', start);
};

export const tokenize = (input: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    const offset = i;
    if (ch === '(') {
      tokens.push({ kind: 'LPAREN', text: '(', offset });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'RPAREN', text: ')', offset });
      i += 1;
      continue;
    }
    if (ch === '[') {
      tokens.push({ kind: 'LBRACKET', text: '[', offset });
      i += 1;
      continue;
    }
    if (ch === ']') {
      tokens.push({ kind: 'RBRACKET', text: ']', offset });
      i += 1;
      continue;
    }
    if (ch === '.') {
      tokens.push({ kind: 'DOT', text: '.', offset });
      i += 1;
      continue;
    }
    if (ch === '<' && input[i + 1] === '-') {
      tokens.push({ kind: 'ARROW', text: '<-', offset });
      i += 2;
      continue;
    }
    if (ch === '-' && input[i + 1] === '>') {
      tokens.push({ kind: 'ARROW', text: '->', offset });
      i += 2;
      continue;
    }
    if (ch === '"') {
      const { value, end } = readQuotedString(input, i);
      tokens.push({ kind: 'STRING', text: input.slice(i, end), value, offset });
      i = end;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(input[i + 1] ?? ''))) {
      let j = i + (ch === '-' ? 1 : 0);
      while (j < input.length && /[0-9]/.test(input[j]!)) j += 1;
      if (input[j] === '.' && /[0-9]/.test(input[j + 1] ?? '')) {
        j += 1;
        while (j < input.length && /[0-9]/.test(input[j]!)) j += 1;
      }
      const text = input.slice(i, j);
      tokens.push({ kind: 'NUMBER', text, value: Number(text), offset });
      i = j;
      continue;
    }
    const comparator = COMPARATORS.find(c => input.startsWith(c, i));
    if (comparator) {
      tokens.push({ kind: 'COMPARATOR', text: comparator, offset });
      i += comparator.length;
      continue;
    }
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < input.length && isIdentChar(input[j]!)) j += 1;
      let text = input.slice(i, j);
      if (text === '_assessment' && input[j] === ':' && isIdentStart(input[j + 1] ?? '')) {
        let k = j + 1;
        while (k < input.length && isIdentChar(input[k]!)) k += 1;
        text = input.slice(i, k);
        j = k;
      }
      const kind =
        text === 'AND' ? 'AND' : text === 'OR' ? 'OR' : text === 'NOT' ? 'NOT' : 'IDENT';
      tokens.push({ kind, text, offset });
      i = j;
      continue;
    }
    throw new TextCompileError(`Unexpected character '${ch}'`, offset);
  }
  tokens.push({ kind: 'EOF', text: '', offset: input.length });
  return tokens;
};
