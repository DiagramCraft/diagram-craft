import { describe, expect, test } from 'vitest';
import { applyLineBreaks, applyTemplate } from './template';

describe('applyTemplate', () => {
  test('replaces single and multiple variables', () => {
    expect(applyTemplate('Hello %name%!', { name: 'Alice' })).toBe('Hello Alice!');
    expect(applyTemplate('%name% likes %name%', { name: 'Bob' })).toBe('Bob likes Bob');
    expect(
      applyTemplate('User: %name%, Age: %age%', { name: 'Charlie', age: 30 })
    ).toBe('User: Charlie, Age: 30');
  });

  test('handles missing and falsy values', () => {
    expect(applyTemplate('Hello %name%!', {})).toBe('Hello !');
    expect(applyTemplate('%zero% %false%', { zero: 0, false: false })).toBe(' ');
    expect(applyTemplate('%value%', { value: '0' })).toBe('0');
  });

  test('handles edge cases', () => {
    expect(applyTemplate(undefined, { name: 'Dave' })).toBe('');
    expect(applyTemplate('', { name: 'Eve' })).toBe('');
    expect(applyTemplate('No variables', {})).toBe('No variables');
    expect(applyTemplate('Progress: %val%%', { val: 75 })).toBe('Progress: 75%');
  });

  test('applies line breaks when flag is set', () => {
    expect(applyTemplate('Line 1\nLine 2', {}, true)).toBe('Line 1<br>Line 2');
    expect(applyTemplate('Line 1\nLine 2', {}, false)).toBe('Line 1\nLine 2');
    expect(applyTemplate('Line 1\nLine 2', {})).toBe('Line 1\nLine 2');
  });
});

describe('applyLineBreaks', () => {
  test('converts newlines to br tags', () => {
    expect(applyLineBreaks('Line 1\nLine 2')).toBe('Line 1<br>Line 2');
    expect(applyLineBreaks('Line 1\n\nLine 2')).toBe('Line 1<br><br>Line 2');
    expect(applyLineBreaks('\nLine 1\n')).toBe('<br>Line 1<br>');
  });

  test('handles edge cases', () => {
    expect(applyLineBreaks(undefined)).toBe('');
    expect(applyLineBreaks('')).toBe('');
    expect(applyLineBreaks('No newlines')).toBe('No newlines');
  });
});
