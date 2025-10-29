import { describe, test, expect } from 'vitest';
import { ARROW_SHAPES } from '../arrowShapes';
import { _test } from './sketch';

describe('parseArrowSvgPath', () => {
  test('can parse ARROW_SHAPES', () => {
    Object.values(ARROW_SHAPES).forEach(shape => {
      expect(_test.parseArrowSvgPath(shape!(10, 1).path)).toBeTruthy();
    });
  });
});
