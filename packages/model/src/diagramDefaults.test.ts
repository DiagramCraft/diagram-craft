import { describe, expect, test } from 'vitest';
import { Defaults, DiagramDefaultsPrivate } from './diagramDefaults';

describe('Defaults', () => {
  describe('add', () => {
    test('can add simple defaults', () => {
      const d = new Defaults<{ test: { inner: string } }>();
      d.add('test.inner', 'lorem');
      expect(d.get('test.inner')).toBe('lorem');
      expect(d.applyDefaults({})).toStrictEqual({ test: { inner: 'lorem' } });
    });

    test('can add complex defaults', () => {
      const d = new Defaults<{ test: { inner1: string; inner2: number } }>();
      d.add('test', {
        inner1: 'lorem',
        inner2: 34
      });
      expect(d.get('test.inner1')).toBe('lorem');
      expect(d.get('test.inner2')).toBe(34);
      expect(d.applyDefaults({})).toStrictEqual({ test: { inner1: 'lorem', inner2: 34 } });
    });
  });

  describe('add pattern', () => {
    test('can add pattern defaults', () => {
      const d = new Defaults<{ test: Record<string, { inner1: string; inner2: number }> }>();
      d.addPattern('test.*', {
        inner1: 'lorem',
        inner2: 34
      });

      expect(d.get('test.lorem.inner1')).toBe('lorem');
      expect(d.get('test.lorem.inner2')).toBe(34);
    });
  });

  describe('applyDefaults', () => {
    test('simple applyDefaults', () => {
      const d = new Defaults<{ test: Record<string, { name: string }> }>();
      d.add('test', {
        inner1: { name: 'lorem' },
        inner2: { name: '34' }
      });
      expect(d.applyDefaults({ test: { inner2: { name: '35' } } })).toStrictEqual({
        test: { inner1: { name: 'lorem' }, inner2: { name: '35' } }
      });
    });

    test('applyDefaults with pattern', () => {
      const d = new Defaults<{ test: Record<string, { inner1: string; inner2: number }> }>();
      d.addPattern('test.*', {
        inner1: 'lorem',
        inner2: 34
      });
      expect(d.applyDefaults({ test: { abc: { inner1: 'ipsum' } } })).toStrictEqual({
        test: { abc: { inner1: 'ipsum', inner2: 34 } }
      });
    });
  });
});

describe('DiagramDefaultsPrivate', () => {
  describe('getSuffix', () => {
    test('returns the correct suffix when key and pattern match', () => {
      const key = 'a.b.c.d.e';
      const pattern = 'a.b';
      expect(DiagramDefaultsPrivate.getSuffix(key, pattern)).toBe('d.e');
    });

    test('returns an empty string if pattern fully matches key without additional parts', () => {
      const key = 'a.b';
      const pattern = 'a.b';
      expect(DiagramDefaultsPrivate.getSuffix(key, pattern)).toBe('');
    });

    test('handles cases where pattern is longer than key', () => {
      const key = 'a.b.c';
      const pattern = 'a.b.c.d';
      expect(DiagramDefaultsPrivate.getSuffix(key, pattern)).toBe('');
    });
  });

  describe('isSameAsDefaults', () => {
    test('returns true when object matches defaults exactly', () => {
      const d = new Defaults<{ test: { inner1: string; inner2: number } }>();
      d.add('test', {
        inner1: 'value1',
        inner2: 42
      });

      const result = d.isSameAsDefaults({ test: { inner1: 'value1', inner2: 42 } });
      expect(result).toBe(true);
    });

    test('returns true when object has missing properties compared to defaults', () => {
      const d = new Defaults<{ test: { inner1: string; inner2: number } }>();
      d.add('test', {
        inner1: 'value1',
        inner2: 42
      });

      const result = d.isSameAsDefaults({ test: { inner1: 'value1' } });
      expect(result).toBe(true);
    });

    test('returns false when object properties differ from defaults', () => {
      const d = new Defaults<{ test: { inner1: string; inner2: number } }>();
      d.add('test', {
        inner1: 'value1',
        inner2: 42
      });

      const result = d.isSameAsDefaults({ test: { inner1: 'different', inner2: 42 } });
      expect(result).toBe(false);
    });

    test('returns true when a nested path matches defaults', () => {
      const d = new Defaults<{ test: { inner: { deep: string } } }>();
      d.add('test.inner', { deep: 'value' });

      const result = d.isSameAsDefaults({ test: { inner: { deep: 'value' } } }, 'test.inner');
      expect(result).toBe(true);
    });

    test('returns true when a nested path matches defaults - no path provided', () => {
      const d = new Defaults<{ test: { inner: { deep: string } } }>();
      d.add('test.inner', { deep: 'value' });

      const result = d.isSameAsDefaults({ test: { inner: { deep: 'value' } } });
      expect(result).toBe(true);
    });

    test('returns false when a nested path does not match defaults', () => {
      const d = new Defaults<{ test: { inner: { deep: string } } }>();
      d.add('test.inner', { deep: 'value' });

      const result = d.isSameAsDefaults({ test: { inner: { deep: 'different' } } }, 'test.inner');
      expect(result).toBe(false);
    });

    test('returns false when a nested path does not match defaults - no path provided', () => {
      const d = new Defaults<{ test: { inner: { deep: string } } }>();
      d.add('test.inner', { deep: 'value' });

      const result = d.isSameAsDefaults({ test: { inner: { deep: 'different' } } });
      expect(result).toBe(false);
    });
  });
});
