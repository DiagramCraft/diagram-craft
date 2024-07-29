import { describe, test, expect } from 'vitest';
import { ARROW_SHAPES } from '../arrowShapes';
import { parseArrowSvgPath } from './sketch';

describe('parseArrowSvgPath', () => {
  test('can parse ARROW_SHAPES', () => {
    Object.values(ARROW_SHAPES).forEach(shape => {
      expect(parseArrowSvgPath(shape!(10).path)).toBeTruthy();
    });
  });
});
