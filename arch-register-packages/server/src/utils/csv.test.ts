import { describe, expect, it } from 'vitest';
import { escapeCsvValue, formatArrayForCsv, generateCsv } from './csv';

describe('escapeCsvValue', () => {
  it('returns empty string for null', () => {
    expect(escapeCsvValue(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeCsvValue(undefined)).toBe('');
  });

  it('returns plain string unchanged when no special chars', () => {
    expect(escapeCsvValue('hello')).toBe('hello');
  });

  it('wraps in quotes when value contains the delimiter', () => {
    expect(escapeCsvValue('a;b')).toBe('"a;b"');
  });

  it('wraps in quotes and doubles internal quotes', () => {
    expect(escapeCsvValue('say "hello"')).toBe('"say ""hello"""');
  });

  it('wraps in quotes when value contains a newline', () => {
    expect(escapeCsvValue('line1\nline2')).toBe('"line1\nline2"');
  });

  it('wraps in quotes when value contains carriage return', () => {
    expect(escapeCsvValue('line1\rline2')).toBe('"line1\rline2"');
  });

  it('uses custom delimiter', () => {
    expect(escapeCsvValue('a,b', ',')).toBe('"a,b"');
    expect(escapeCsvValue('a;b', ',')).toBe('a;b');
  });

  it('converts numbers to strings', () => {
    expect(escapeCsvValue(42)).toBe('42');
  });

  it('converts booleans to strings', () => {
    expect(escapeCsvValue(true)).toBe('true');
  });
});

describe('generateCsv', () => {
  it('produces a header row and a data row', () => {
    const result = generateCsv([{ name: 'Alice', age: 30 }], ['name', 'age']);
    expect(result).toBe('name;age\nAlice;30');
  });

  it('produces only a header row when data is empty', () => {
    expect(generateCsv([], ['name', 'age'])).toBe('name;age');
  });

  it('uses missing column values as empty strings', () => {
    const result = generateCsv([{ name: 'Bob' }], ['name', 'age']);
    expect(result).toBe('name;age\nBob;');
  });

  it('uses custom delimiter', () => {
    const result = generateCsv([{ a: '1', b: '2' }], ['a', 'b'], ',');
    expect(result).toBe('a,b\n1,2');
  });

  it('escapes values containing the delimiter', () => {
    const result = generateCsv([{ desc: 'a;b' }], ['desc']);
    expect(result).toBe('desc\n"a;b"');
  });

  it('handles multiple rows', () => {
    const data = [{ n: 'X' }, { n: 'Y' }];
    expect(generateCsv(data, ['n'])).toBe('n\nX\nY');
  });
});

describe('formatArrayForCsv', () => {
  it('returns empty string for empty array', () => {
    expect(formatArrayForCsv([])).toBe('');
  });

  it('returns empty string for non-array input', () => {
    expect(formatArrayForCsv('not-array' as unknown as unknown[])).toBe('');
  });

  it('returns single element without separator', () => {
    expect(formatArrayForCsv(['only'])).toBe('only');
  });

  it('joins multiple elements with comma and space', () => {
    expect(formatArrayForCsv(['a', 'b', 'c'])).toBe('a, b, c');
  });

  it('converts non-string elements to strings', () => {
    expect(formatArrayForCsv([1, 2, 3])).toBe('1, 2, 3');
  });
});
