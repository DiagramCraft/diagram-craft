import { describe, expect, test } from 'vitest';
import { StyleManager } from './styleManager';

describe('StyleManager', () => {
  describe('constructor and parsing', () => {
    test('parses simple key-value pairs', () => {
      const sm = new StyleManager('fillColor=red;strokeColor=blue');
      expect(sm.str('fillColor')).toBe('red');
      expect(sm.str('strokeColor')).toBe('blue');
    });

    test('parses style name from key without value', () => {
      const sm = new StyleManager('text;fillColor=red');
      expect(sm.styleName).toBe('text');
    });

    test('handles empty style string', () => {
      const sm = new StyleManager('');
      expect(sm.styleName).toBe('default');
    });

    test('extracts shape from styles', () => {
      const sm = new StyleManager('shape=ellipse;fillColor=red');
      expect(sm.shape).toBe('ellipse');
    });

    test('uses group styleKey when isGroup is true', () => {
      const sm = new StyleManager('fillColor=red', true);
      expect(sm.str('verticalAlign')).toBe('top');
    });

    test('uses default styleKey when isGroup is false', () => {
      const sm = new StyleManager('fillColor=red', false);
      expect(sm.str('align')).toBe('center');
    });
  });

  describe('get method', () => {
    test('returns value from styles when present', () => {
      const sm = new StyleManager('fillColor=red');
      expect(sm.get('fillColor')).toBe('red');
    });

    test('returns value from style-specific defaults', () => {
      const sm = new StyleManager('text');
      expect(sm.get('align')).toBe('left');
    });

    test('falls back to default defaults', () => {
      const sm = new StyleManager('text');
      expect(sm.get('spacing')).toBe('2');
    });

    test('returns undefined for non-existent key', () => {
      const sm = new StyleManager('');
      expect(sm.get('nonExistent')).toBeUndefined();
    });
  });

  describe('str method', () => {
    test('returns string value when present', () => {
      const sm = new StyleManager('fontFamily=Arial');
      expect(sm.str('fontFamily')).toBe('Arial');
    });

    test('returns provided default when key is missing', () => {
      const sm = new StyleManager('');
      expect(sm.str('fontFamily', 'Helvetica')).toBe('Helvetica');
    });

    test('returns undefined when no default provided and key is missing', () => {
      const sm = new StyleManager('');
      expect(sm.str('fontFamily')).toBeUndefined();
    });

    test('returns style value over provided default', () => {
      const sm = new StyleManager('fontFamily=Arial');
      expect(sm.str('fontFamily', 'Helvetica')).toBe('Arial');
    });
  });

  describe('num method', () => {
    test('parses numeric value', () => {
      const sm = new StyleManager('fontSize=14');
      expect(sm.num('fontSize')).toBe(14);
    });

    test('returns default when key is missing', () => {
      const sm = new StyleManager('');
      expect(sm.num('fontSize', 12)).toBe(12);
    });

    test('returns 0 when no default provided and key is missing', () => {
      const sm = new StyleManager('');
      expect(sm.num('fontSize')).toBe(0);
    });

    test('parses decimal values', () => {
      const sm = new StyleManager('opacity=0.5');
      expect(sm.num('opacity')).toBe(0.5);
    });

    test('parses negative values', () => {
      const sm = new StyleManager('dx=-10');
      expect(sm.num('dx')).toBe(-10);
    });
  });

  describe('is method', () => {
    test('returns true when value is 1', () => {
      const sm = new StyleManager('rounded=1');
      expect(sm.is('rounded')).toBe(true);
    });

    test('returns false when value is 0', () => {
      const sm = new StyleManager('rounded=0');
      expect(sm.is('rounded')).toBe(false);
    });

    test('returns default when key is missing', () => {
      const sm = new StyleManager('');
      expect(sm.is('rounded', true)).toBe(true);
      expect(sm.is('rounded', false)).toBe(false);
    });

    test('returns false by default when key is missing and no default provided', () => {
      const sm = new StyleManager('');
      expect(sm.is('rounded')).toBe(false);
    });

    test('returns false for non-1 values', () => {
      const sm = new StyleManager('rounded=yes');
      expect(sm.is('rounded')).toBe(false);
    });
  });

  describe('has method', () => {
    test('returns true when key exists in styles', () => {
      const sm = new StyleManager('fillColor=red');
      expect(sm.has('fillColor')).toBe(true);
    });

    test('returns false when key does not exist in styles', () => {
      const sm = new StyleManager('fillColor=red');
      expect(sm.has('strokeColor')).toBe(false);
    });

    test('returns false even if key exists in defaults', () => {
      const sm = new StyleManager('');
      expect(sm.has('align')).toBe(false);
    });
  });

  describe('set method', () => {
    test('sets a new value', () => {
      const sm = new StyleManager('');
      sm.set('fillColor', 'blue');
      expect(sm.get('fillColor')).toBe('blue');
    });

    test('overrides existing value', () => {
      const sm = new StyleManager('fillColor=red');
      sm.set('fillColor', 'blue');
      expect(sm.get('fillColor')).toBe('blue');
    });
  });

  describe('getOverride method', () => {
    test('returns value from styles when present', () => {
      const sm = new StyleManager('fillColor=red');
      expect(sm.getOverride('fillColor')).toBe('red');
    });

    test('returns undefined when value only in defaults', () => {
      const sm = new StyleManager('');
      expect(sm.getOverride('align')).toBeUndefined();
    });
  });

  describe('style-specific defaults', () => {
    test('text style uses left alignment', () => {
      const sm = new StyleManager('text');
      expect(sm.str('align')).toBe('left');
      expect(sm.str('verticalAlign')).toBe('top');
    });

    test('image style uses different vertical alignment', () => {
      const sm = new StyleManager('image');
      expect(sm.str('verticalAlign')).toBe('top');
      expect(sm.str('verticalLabelPosition')).toBe('bottom');
    });

    test('label style has specific image dimensions', () => {
      const sm = new StyleManager('label');
      expect(sm.str('imageWidth')).toBe('42');
      expect(sm.str('imageHeight')).toBe('42');
    });

    test('icon style centers image', () => {
      const sm = new StyleManager('icon');
      expect(sm.str('imageAlign')).toBe('center');
      expect(sm.num('spacing')).toBe(0);
    });
  });
});
