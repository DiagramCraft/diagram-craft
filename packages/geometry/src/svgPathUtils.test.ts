import { describe, expect, test } from 'vitest';
import { parseSvgPath } from './svgPathUtils';

describe('svgPathUtils', () => {
  describe('parseSvgPath', () => {
    test('should parse a simple path with move and line commands', () => {
      const path = 'M 10,20 L 30,40';
      const result = parseSvgPath(path);

      expect(result).toEqual([
        ['M', '10', '20'],
        ['L', '30', '40']
      ]);
    });

    test('should parse a path with various command types', () => {
      const path = 'M 10,20 L 30,40 C 10,20,30,40,50,60 Z';
      const result = parseSvgPath(path);

      expect(result).toEqual([
        ['M', '10', '20'],
        ['L', '30', '40'],
        ['C', '10', '20', '30', '40', '50', '60'],
        ['Z']
      ]);
    });
  });
});
