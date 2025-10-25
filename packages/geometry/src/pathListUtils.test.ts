import { describe, expect, test } from 'vitest';
import { transformPathList } from './pathListUtils';
import { PathListBuilder } from './pathListBuilder';
import { PathList } from './pathList';
import { Scale, Translation } from './transform';

describe('pathListUtils', () => {
  describe('transformPathList', () => {
    test('transforms single path with translation', () => {
      const pathList = new PathListBuilder()
        .moveTo({ x: 0, y: 0 })
        .lineTo({ x: 10, y: 0 })
        .lineTo({ x: 10, y: 10 })
        .close()
        .getPaths();

      const transformed = transformPathList(pathList, [new Translation({ x: 5, y: 5 })]);

      const firstPath = transformed.all()[0];
      expect(firstPath?.start).toEqual({ x: 5, y: 5 });
    });

    test('transforms multiple paths', () => {
      const pathList = new PathListBuilder()
        .moveTo({ x: 0, y: 0 })
        .lineTo({ x: 10, y: 0 })
        .close()
        .moveTo({ x: 20, y: 20 })
        .lineTo({ x: 30, y: 20 })
        .close()
        .getPaths();

      const transformed = transformPathList(pathList, [new Translation({ x: 10, y: 10 })]);

      expect(transformed.all()).toHaveLength(2);
      expect(transformed.all()[0]?.start).toEqual({ x: 10, y: 10 });
      expect(transformed.all()[1]?.start).toEqual({ x: 30, y: 30 });
    });

    test('applies multiple transforms in sequence', () => {
      const pathList = new PathListBuilder()
        .moveTo({ x: 10, y: 10 })
        .lineTo({ x: 20, y: 10 })
        .close()
        .getPaths();

      const transformed = transformPathList(pathList, [
        new Translation({ x: -10, y: -10 }),
        new Scale(2, 2),
        new Translation({ x: 10, y: 10 })
      ]);

      const firstPath = transformed.all()[0];
      expect(firstPath?.start).toEqual({ x: 10, y: 10 });
    });

    test('applies scale transform', () => {
      const pathList = new PathListBuilder()
        .moveTo({ x: 10, y: 10 })
        .lineTo({ x: 20, y: 10 })
        .close()
        .getPaths();

      const transformed = transformPathList(pathList, [new Scale(2, 3)]);

      const firstPath = transformed.all()[0];
      expect(firstPath?.start).toEqual({ x: 20, y: 30 });
    });

    test('handles empty path list', () => {
      const pathList = new PathList([]);
      const transformed = transformPathList(pathList, [new Translation({ x: 5, y: 5 })]);

      expect(transformed.all()).toHaveLength(0);
    });
  });
});
