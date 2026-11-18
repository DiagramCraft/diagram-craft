import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { getEditStart, isCellEditable, navToDirection, validateValue } from './useCellEditing';

const key = (
  k: string,
  mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}
) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods
});

describe('getEditStart', () => {
  test('Enter and F2 start editing without a seed', () => {
    expect(getEditStart(key('Enter'))).toEqual({});
    expect(getEditStart(key('F2'))).toEqual({});
  });

  test('printable characters seed the edit', () => {
    expect(getEditStart(key('a'))).toEqual({ seed: 'a' });
  });

  test('shortcuts and navigation keys do not start editing', () => {
    expect(getEditStart(key('c', { ctrlKey: true }))).toBeNull();
    expect(getEditStart(key('c', { metaKey: true }))).toBeNull();
    expect(getEditStart(key('ArrowDown'))).toBeNull();
    expect(getEditStart(key('Tab'))).toBeNull();
  });
});

describe('navToDirection', () => {
  test('maps moving navs and ignores none/blur', () => {
    expect(navToDirection('down')).toBe('down');
    expect(navToDirection('left')).toBe('left');
    expect(navToDirection('none')).toBeNull();
    expect(navToDirection('blur')).toBeNull();
  });
});

describe('isCellEditable', () => {
  test('requires an editor', () => {
    expect(isCellEditable(undefined, {})).toBe(false);
    expect(isCellEditable({}, {})).toBe(false);
    expect(isCellEditable({ editor: 'text' }, {})).toBe(true);
  });

  test('respects editable flag and predicate', () => {
    expect(isCellEditable({ editor: 'text', editable: false }, {})).toBe(false);
    const meta = { editor: 'text', editable: (r: { locked: boolean }) => !r.locked };
    expect(isCellEditable(meta, { locked: false })).toBe(true);
    expect(isCellEditable(meta, { locked: true })).toBe(false);
  });
});

describe('validateValue', () => {
  test('passes without a validator', () => {
    expect(validateValue(undefined, 'x')).toBeNull();
  });

  test('uses function validators', () => {
    const validate = (v: unknown) => (v === '' ? 'Required' : null);
    expect(validateValue(validate, '')).toBe('Required');
    expect(validateValue(validate, 'a')).toBeNull();
  });

  test('uses zod schemas', () => {
    const schema = z.number().int().min(0, 'Must be positive');
    expect(validateValue(schema, 3)).toBeNull();
    expect(validateValue(schema, -1)).toBe('Must be positive');
  });
});
