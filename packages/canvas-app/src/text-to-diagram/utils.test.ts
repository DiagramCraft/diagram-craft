import { describe, test, expect } from 'vitest';
import { collectElementIds, parseMetadataString, parsePropsString } from './utils';
import type { ParsedElement } from './types';

describe('utils', () => {
  describe('collectElementIds', () => {
    test('collects IDs from flat list', () => {
      const elements: ParsedElement[] = [
        { id: '1', type: 'node', shape: 'rect', line: 0 },
        { id: '2', type: 'node', shape: 'circle', line: 1 },
        { id: 'e1', type: 'edge', line: 2 }
      ];

      const result = collectElementIds(elements);

      expect(Array.from(result.keys()).length).toBe(3);
      expect(result.has('1')).toBe(true);
      expect(result.get('1')).toEqual([0]);
      expect(result.has('2')).toBe(true);
      expect(result.get('2')).toEqual([1]);
      expect(result.has('e1')).toBe(true);
      expect(result.get('e1')).toEqual([2]);
    });

    test('collects IDs from nested structure', () => {
      const elements: ParsedElement[] = [
        {
          id: 'parent',
          type: 'node',
          shape: 'group',
          line: 0,
          children: [
            { id: 'child1', type: 'node', shape: 'rect', line: 1 },
            { id: 'child2', type: 'node', shape: 'circle', line: 2 }
          ]
        }
      ];

      const result = collectElementIds(elements);

      expect(Array.from(result.keys()).length).toBe(3);
      expect(result.has('parent')).toBe(true);
      expect(result.get('parent')).toEqual([0]);
      expect(result.has('child1')).toBe(true);
      expect(result.get('child1')).toEqual([1]);
      expect(result.has('child2')).toBe(true);
      expect(result.get('child2')).toEqual([2]);
    });

    test('handles empty array', () => {
      const result = collectElementIds([]);

      expect(Array.from(result.keys()).length).toBe(0);
    });

    test('handles deeply nested structure', () => {
      const elements: ParsedElement[] = [
        {
          id: 'level1',
          type: 'node',
          shape: 'group',
          line: 0,
          children: [
            {
              id: 'level2',
              type: 'node',
              shape: 'group',
              line: 1,
              children: [
                {
                  id: 'level3',
                  type: 'node',
                  shape: 'group',
                  line: 2,
                  children: [{ id: 'level4', type: 'node', shape: 'rect', line: 3 }]
                }
              ]
            }
          ]
        }
      ];

      const result = collectElementIds(elements);

      expect(Array.from(result.keys()).length).toBe(4);
      expect(result.get('level1')).toEqual([0]);
      expect(result.get('level2')).toEqual([1]);
      expect(result.get('level3')).toEqual([2]);
      expect(result.get('level4')).toEqual([3]);
    });

    test('handles mixed nested and flat elements', () => {
      const elements: ParsedElement[] = [
        { id: 'flat1', type: 'node', shape: 'rect', line: 0 },
        {
          id: 'parent1',
          type: 'node',
          shape: 'group',
          line: 1,
          children: [{ id: 'child1', type: 'node', shape: 'rect', line: 2 }]
        },
        { id: 'flat2', type: 'node', shape: 'circle', line: 3 },
        {
          id: 'parent2',
          type: 'node',
          shape: 'group',
          line: 4,
          children: [
            { id: 'child2', type: 'node', shape: 'rect', line: 5 },
            { id: 'child3', type: 'node', shape: 'rect', line: 6 }
          ]
        }
      ];

      const result = collectElementIds(elements);

      expect(Array.from(result.keys()).length).toBe(7);
      expect(result.get('flat1')).toEqual([0]);
      expect(result.get('parent1')).toEqual([1]);
      expect(result.get('child1')).toEqual([2]);
      expect(result.get('flat2')).toEqual([3]);
      expect(result.get('parent2')).toEqual([4]);
      expect(result.get('child2')).toEqual([5]);
      expect(result.get('child3')).toEqual([6]);
    });

    test('tracks duplicate IDs with different line numbers', () => {
      const elements: ParsedElement[] = [
        { id: 'duplicate', type: 'node', shape: 'rect', line: 0 },
        { id: 'unique', type: 'node', shape: 'circle', line: 1 },
        { id: 'duplicate', type: 'node', shape: 'rect', line: 2 }
      ];

      const result = collectElementIds(elements);

      expect(Array.from(result.keys()).length).toBe(2);
      expect(result.get('duplicate')).toEqual([0, 2]);
      expect(result.get('unique')).toEqual([1]);
    });

    test('tracks duplicate IDs across nested structures', () => {
      const elements: ParsedElement[] = [
        { id: 'dup', type: 'node', shape: 'rect', line: 0 },
        {
          id: 'parent',
          type: 'node',
          shape: 'group',
          line: 1,
          children: [{ id: 'dup', type: 'node', shape: 'rect', line: 2 }]
        }
      ];

      const result = collectElementIds(elements);

      expect(Array.from(result.keys()).length).toBe(2);
      expect(result.get('dup')).toEqual([0, 2]);
      expect(result.get('parent')).toEqual([1]);
    });
  });

  describe('parsePropsString', () => {
    test('parses simple key-value pair', () => {
      const result = parsePropsString('color=red');
      expect(result).toEqual({ color: 'red' });
    });

    test('parses nested properties', () => {
      const result = parsePropsString('fill.color=#ff0000');
      expect(result).toEqual({ fill: { color: '#ff0000' } });
    });

    test('parses multiple properties', () => {
      const result = parsePropsString('fill.color=#ff0000;stroke.width=2');
      expect(result).toEqual({
        fill: { color: '#ff0000' },
        stroke: { width: 2 }
      });
    });

    test('parses boolean values', () => {
      const result = parsePropsString('enabled=true;disabled=false');
      expect(result).toEqual({ enabled: true, disabled: false });
    });

    test('parses numeric values', () => {
      const result = parsePropsString('width=100;height=200.5');
      expect(result).toEqual({ width: 100, height: 200.5 });
    });

    test('parses deeply nested properties', () => {
      const result = parsePropsString('arrow.start.type=SQUARE_ARROW_OUTLINE');
      expect(result).toEqual({
        arrow: { start: { type: 'SQUARE_ARROW_OUTLINE' } }
      });
    });
  });

  describe('parseMetadataString', () => {
    test('parses name metadata', () => {
      const result = parseMetadataString('name=TestNode');
      expect(result).toEqual({ name: 'TestNode' });
    });

    test('ignores unknown metadata keys', () => {
      const result = parseMetadataString('name=Test;unknown=value');
      expect(result).toEqual({ name: 'Test' });
    });
  });
});
