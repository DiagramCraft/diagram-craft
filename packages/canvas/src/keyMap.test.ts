import { describe, expect, it } from 'vitest';
import { findKeyBindingsForAction, formatKeyBinding } from './keyMap';

describe('formatKeyBinding', () => {
  it('returns empty string for undefined input', () => {
    const result = formatKeyBinding(undefined, 'Windows');
    expect(result).toBe('');
  });

  it('formats key binding for Windows platform', () => {
    const result = formatKeyBinding('C-S-KeyA', 'Windows');
    expect(result).toBe('Ctrl+Shift+A');
  });

  it('formats key binding for Mac platform', () => {
    const result = formatKeyBinding('C-S-KeyA', 'Mac');
    expect(result).toBe('⌃⇧A');
  });

  it('formats key binding for Linux platform', () => {
    const result = formatKeyBinding('C-S-KeyA', 'Linux');
    expect(result).toBe('Ctrl+Shift+A');
  });

  it('formats key binding without modifiers', () => {
    const result = formatKeyBinding('KeyA', 'Windows');
    expect(result).toBe('A');
  });

  it('formats key binding with digit key', () => {
    const result = formatKeyBinding('Digit1', 'Windows');
    expect(result).toBe('1');
  });

  it('formats key binding with all modifiers', () => {
    const result = formatKeyBinding('A-C-M-S-KeyA', 'Mac');
    expect(result).toBe('⌥⌃⌘⇧A');
  });
});

describe('findKeyBindingsForAction', () => {
  it('returns an empty array when no key bindings match the action', () => {
    const keyMap = { 'C-S-KeyA': 'someAction' };
    const result = findKeyBindingsForAction('anotherAction', keyMap);
    expect(result).toEqual([]);
  });

  it('returns the correct key binding for a single match', () => {
    const keyMap = { 'C-S-KeyA': 'someAction' };
    const result = findKeyBindingsForAction('someAction', keyMap);
    expect(result).toEqual(['C-S-KeyA']);
  });

  it('returns all key bindings that match the action', () => {
    const keyMap = { 'C-S-KeyA': 'someAction', 'A-C-KeyB': 'someAction' };
    const result = findKeyBindingsForAction('someAction', keyMap);
    expect(result).toEqual(['C-S-KeyA', 'A-C-KeyB']);
  });

  it('handles an empty key map', () => {
    const keyMap = {};
    const result = findKeyBindingsForAction('someAction', keyMap);
    expect(result).toEqual([]);
  });

  it('returns an empty array when action is not in key map', () => {
    const keyMap = { 'C-S-KeyA': 'someAction' };
    const result = findKeyBindingsForAction('nonExistentAction', keyMap);
    expect(result).toEqual([]);
  });
});
