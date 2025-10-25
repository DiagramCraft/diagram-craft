import { describe, expect, test } from 'vitest';
import { _test, toInlineCSS } from './vdom';

const { toKebabCase } = _test;

describe('toKebabCase', () => {
  test('converts simple camelCase to kebab-case', () => {
    expect(toKebabCase('backgroundColor')).toBe('background-color');
  });

  test('converts single word without changes', () => {
    expect(toKebabCase('color')).toBe('color');
  });

  test('converts multiple capital letters', () => {
    expect(toKebabCase('borderTopLeftRadius')).toBe('border-top-left-radius');
  });

  test('handles vendor prefixes', () => {
    expect(toKebabCase('WebkitTransform')).toBe('-webkit-transform');
    expect(toKebabCase('MozBorderRadius')).toBe('-moz-border-radius');
  });

  test('handles consecutive capital letters', () => {
    expect(toKebabCase('XMLHttpRequest')).toBe('-x-m-l-http-request');
  });

  test('handles already kebab-case strings', () => {
    expect(toKebabCase('background-color')).toBe('background-color');
  });

  test('caches results for performance', () => {
    const result1 = toKebabCase('backgroundColor');
    const result2 = toKebabCase('backgroundColor');

    expect(result1).toBe(result2);
    expect(result1).toBe('background-color');
  });

  test('handles empty string', () => {
    expect(toKebabCase('')).toBe('');
  });

  test('handles strings with numbers', () => {
    expect(toKebabCase('fontSize16')).toBe('font-size16');
  });
});

describe('toInlineCSS', () => {
  test('converts single CSS property to inline style', () => {
    const result = toInlineCSS({ color: 'red' });

    expect(result).toBe('color: red;');
  });

  test('converts multiple CSS properties to inline style', () => {
    const result = toInlineCSS({ color: 'red', fontSize: '16px', display: 'block' });

    expect(result).toBe('color: red;font-size: 16px;display: block;');
  });

  test('converts camelCase properties to kebab-case', () => {
    const result = toInlineCSS({
      backgroundColor: 'blue',
      borderTopWidth: '2px',
      marginLeft: '10px'
    });

    expect(result).toContain('background-color: blue;');
    expect(result).toContain('border-top-width: 2px;');
    expect(result).toContain('margin-left: 10px;');
  });

  test('skips undefined values', () => {
    const result = toInlineCSS({
      color: 'red',
      backgroundColor: undefined,
      fontSize: '16px'
    });

    expect(result).toBe('color: red;font-size: 16px;');
    expect(result).not.toContain('background-color');
  });

  test('skips null values', () => {
    const result = toInlineCSS({
      color: 'red',
      backgroundColor: null as unknown as string,
      fontSize: '16px'
    });

    expect(result).toBe('color: red;font-size: 16px;');
    expect(result).not.toContain('background-color');
  });

  test('skips empty string values', () => {
    const result = toInlineCSS({
      color: 'red',
      backgroundColor: '',
      fontSize: '16px'
    });

    expect(result).toBe('color: red;font-size: 16px;');
    expect(result).not.toContain('background-color');
  });

  test('handles empty object', () => {
    const result = toInlineCSS({});

    expect(result).toBe('');
  });

  test('handles numeric values', () => {
    const result = toInlineCSS({
      zIndex: '10' as unknown as string,
      opacity: '0.5' as unknown as string
    });

    expect(result).toContain('z-index: 10;');
    expect(result).toContain('opacity: 0.5;');
  });

  test('preserves CSS values with spaces', () => {
    const result = toInlineCSS({
      fontFamily: 'Arial, sans-serif',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)' as unknown as string
    });

    expect(result).toContain('font-family: Arial, sans-serif;');
    expect(result).toContain('box-shadow: 0 2px 4px rgba(0,0,0,0.1);');
  });
});
