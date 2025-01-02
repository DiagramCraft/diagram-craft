import { describe, expect, test } from 'vitest';
import { Defaults } from './diagramDefaults';

describe('Defaults', () => {
  describe('add', () => {
    test('can add simple defaults', () => {
      const d = new Defaults<{ test: { inner: string } }>();
      d.add('test.inner', 'lorem');
      expect(d.get('test.inner')).toBe('lorem');
      expect(d.merge({})).toStrictEqual({ test: { inner: 'lorem' } });
    });

    test('can add complex defaults', () => {
      const d = new Defaults<{ test: { inner1: string; inner2: number } }>();
      d.add('test', {
        inner1: 'lorem',
        inner2: 34
      });
      expect(d.get('test.inner1')).toBe('lorem');
      expect(d.get('test.inner2')).toBe(34);
      expect(d.merge({})).toStrictEqual({ test: { inner1: 'lorem', inner2: 34 } });
    });
  });

  describe('add pattern', () => {
    test.only('can add pattern defaults', () => {
      const d = new Defaults<{ test: Record<string, { inner1: string; inner2: number }> }>();
      d.addPattern('test.*', {
        inner1: 'lorem',
        inner2: 34
      });

      expect(d.get('test.lorem.inner1')).toBe('lorem');
      expect(d.get('test.lorem.inner2')).toBe(34);
    });
  });

  describe('merge', () => {
    test('simple merge', () => {
      const d = new Defaults<{ test: { inner1: string; inner2: number } }>();
      d.add('test', {
        inner1: 'lorem',
        inner2: 34
      });
      expect(d.merge({ test: { inner2: 35 } })).toStrictEqual({
        test: { inner1: 'lorem', inner2: 35 }
      });
    });

    test('merge with pattern', () => {
      const d = new Defaults<{ test: Record<string, { inner1: string; inner2: number }> }>();
      d.addPattern('test.*', {
        inner1: 'lorem',
        inner2: 34
      });
      expect(d.merge({ test: { abc: { inner1: 'ipsum' } } })).toStrictEqual({
        test: { abc: { inner1: 'ipsum', inner2: 35 } }
      });
    });
  });
});
