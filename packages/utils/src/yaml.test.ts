import { describe, expect, test } from 'vitest';
import { toYAML } from './yaml';

describe('toYAML', () => {
  test('converts simple object', () => {
    expect(toYAML({ name: 'test', count: 42 })).toBe('name: test\ncount: 42');
  });

  test('handles primitives', () => {
    expect(toYAML(null)).toBe('null');
    expect(toYAML(undefined)).toBe('');
    expect(toYAML(42)).toBe('42');
    expect(toYAML(true)).toBe('true');
    expect(toYAML('hello')).toBe('hello');
  });

  test('quotes strings that need escaping', () => {
    expect(toYAML('true')).toBe('"true"');
    expect(toYAML('123')).toBe('"123"');
    expect(toYAML('hello: world')).toBe('"hello: world"');
    expect(toYAML('')).toBe('""');
  });

  test('handles arrays', () => {
    expect(toYAML([1, 2, 3])).toBe('- 1\n- 2\n- 3');
    expect(toYAML([])).toBe('[]');
  });

  test('handles nested objects', () => {
    const obj = {
      person: {
        name: 'John',
        age: 30
      }
    };
    expect(toYAML(obj)).toBe('person:\n  name: John\n  age: 30');
  });

  test('handles empty objects', () => {
    expect(toYAML({})).toBe('{}');
    expect(toYAML({ empty: {} })).toBe('empty: {}');
  });

  test('handles arrays of objects', () => {
    const obj = {
      items: [{ a: 1 }, { b: 2 }]
    };
    expect(toYAML(obj)).toBe('items:\n  - a: 1\n  - b: 2');
  });

  test('handles null values in objects', () => {
    expect(toYAML({ value: null })).toBe('value: null');
  });
});
