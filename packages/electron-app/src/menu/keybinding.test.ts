import { describe, test, expect } from 'vitest';
import { convertKeybindingToAccelerator } from './keybinding';

describe('keybinding utilities', () => {
  describe('convertKeybindingToAccelerator', () => {
    test('should convert M- to CommandOrControl+', () => {
      const result = convertKeybindingToAccelerator('M-s');
      expect(result).toBe('CommandOrControl+s');
    });

    test('should convert A- to Alt+', () => {
      const result = convertKeybindingToAccelerator('A-f');
      expect(result).toBe('Alt+f');
    });

    test('should convert S- to Shift+', () => {
      const result = convertKeybindingToAccelerator('S-Tab');
      expect(result).toBe('Shift+Tab');
    });

    test('should convert C- to Control+', () => {
      const result = convertKeybindingToAccelerator('C-c');
      expect(result).toBe('Control+c');
    });

    test('should remove Key prefix', () => {
      const result = convertKeybindingToAccelerator('KeyA');
      expect(result).toBe('A');
    });

    test('should handle multiple modifiers', () => {
      const result = convertKeybindingToAccelerator('M-S-a');
      expect(result).toBe('CommandOrControl+Shift+a');
    });

    test('should handle multiple modifiers with Key', () => {
      const result = convertKeybindingToAccelerator('M-A-KeyF1');
      expect(result).toBe('CommandOrControl+Alt+F1');
    });

    test('should handle complex keybinding combinations', () => {
      const result = convertKeybindingToAccelerator('C-A-S-KeyDelete');
      expect(result).toBe('Control+Alt+Shift+Delete');
    });

    test('should handle keybinding with no modifiers', () => {
      const result = convertKeybindingToAccelerator('Escape');
      expect(result).toBe('Escape');
    });

    test('should handle keybinding with only Key prefix', () => {
      const result = convertKeybindingToAccelerator('KeyEnter');
      expect(result).toBe('Enter');
    });

    test('should handle function keys with modifiers', () => {
      const result = convertKeybindingToAccelerator('M-KeyF12');
      expect(result).toBe('CommandOrControl+F12');
    });

    test('should handle arrow keys with modifiers', () => {
      const result = convertKeybindingToAccelerator('S-KeyArrowUp');
      expect(result).toBe('Shift+ArrowUp');
    });

    test('should handle numbers with modifiers', () => {
      const result = convertKeybindingToAccelerator('M-Key1');
      expect(result).toBe('CommandOrControl+1');
    });

    test('should handle empty string', () => {
      const result = convertKeybindingToAccelerator('');
      expect(result).toBe('');
    });

    test('should handle string without any replacements', () => {
      const result = convertKeybindingToAccelerator('Space');
      expect(result).toBe('Space');
    });
  });
});