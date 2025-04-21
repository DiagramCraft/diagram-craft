import { describe, expect, it } from 'vitest';
import { applyBooleanOperation } from './pathClip';
import { CompoundPath, PathBuilder } from './pathBuilder';
import { TEST_CASES } from './pathClip.testCases';
import { TransformFactory } from './transform';
import { Box } from './box';

const makePaths = (sp1: string, sp2: string): [CompoundPath, CompoundPath] => {
  const p1 = PathBuilder.fromString(sp1);
  const p2 = PathBuilder.fromString(sp2);

  const bounds = Box.boundingBox([p1.getPaths().bounds(), p2.getPaths().bounds()]);

  p1.setTransform(TransformFactory.fromTo(bounds, { x: -50, y: -50, w: 100, h: 100, r: 0 }));
  p2.setTransform(TransformFactory.fromTo(bounds, { x: -50, y: -50, w: 100, h: 100, r: 0 }));

  const cp1 = p1.getPaths();
  const cp2 = p2.getPaths();

  return [cp1, cp2];
};

describe('pathClip', () => {
  describe('integration tests', () => {
    describe('onEdge', () => {
      const [p1, p2] = makePaths(TEST_CASES.OnEdge.p1, TEST_CASES.OnEdge.p2);

      it('A union B', () => {
        expect(applyBooleanOperation(p1, p2, 'A union B').map(p => p.asSvgPath())).toStrictEqual([
          'M -26.9231,26.9231 L -26.9231,50 L 50,50 L 50,-26.9231 L 11.5385,-26.9231 L -11.5385,-50 L -50,-11.5385 L -26.9231,26.9231'
        ]);
      });

      it('A not B', () => {
        expect(applyBooleanOperation(p1, p2, 'A not B').map(p => p.asSvgPath())).toStrictEqual([
          'M -26.9231,26.9231 L -26.9231,50 L 50,50 L 50,-26.9231 L 11.5385,-26.9231 L 26.9231,-11.5385 L -26.9231,26.9231'
        ]);
      });

      it('B not A', () => {
        expect(applyBooleanOperation(p1, p2, 'B not A').map(p => p.asSvgPath())).toStrictEqual([
          'M -26.9231,26.9231 L -26.9231,-26.9231 L 11.5385,-26.9231 L -11.5385,-50 L -50,-11.5385 L -26.9231,26.9231'
        ]);
      });

      it('A intersection B', () => {
        expect(
          applyBooleanOperation(p1, p2, 'A intersection B').map(p => p.asSvgPath())
        ).toStrictEqual([
          'M -26.9231,26.9231 L -26.9231,-26.9231 L 11.5385,-26.9231 L 26.9231,-11.5385 L -26.9231,26.9231'
        ]);
      });

      it('A xor B', () => {
        expect(applyBooleanOperation(p1, p2, 'A xor B').map(p => p.asSvgPath())).toStrictEqual([
          'M -26.9231,26.9231 L -26.9231,50 L 50,50 L 50,-26.9231 L 11.5385,-26.9231 L 26.9231,-11.5385 L -26.9231,26.9231',
          'M -26.9231,26.9231 L -26.9231,-26.9231 L 11.5385,-26.9231 L -11.5385,-50 L -50,-11.5385 L -26.9231,26.9231'
        ]);
      });

      it('A divide B', () => {
        expect(applyBooleanOperation(p1, p2, 'A divide B').map(p => p.asSvgPath())).toStrictEqual([
          'M -26.9231,26.9231 L -26.9231,50 L 50,50 L 50,-26.9231 L 11.5385,-26.9231 L 26.9231,-11.5385 L -26.9231,26.9231',
          'M -26.9231,26.9231 L -26.9231,-26.9231 L 11.5385,-26.9231 L -11.5385,-50 L -50,-11.5385 L -26.9231,26.9231',
          'M -26.9231,26.9231 L -26.9231,-26.9231 L 11.5385,-26.9231 L 26.9231,-11.5385 L -26.9231,26.9231'
        ]);
      });
    });

    describe('onEdge2', () => {
      const [p1, p2] = makePaths(TEST_CASES.OnEdge2.p1, TEST_CASES.OnEdge2.p2);

      it('A union B', () => {
        expect(applyBooleanOperation(p1, p2, 'A union B').map(p => p.asSvgPath())).toStrictEqual([
          'M 12,-26.9231 L 50,-26.9231 L 50,50 L -50,50 L -50,26.9231 L -50,-26.9231 L -41.25,-26.9231 L -40,-34.6154 L 0,-50 L 12,-26.9231'
        ]);
      });

      it('A not B', () => {
        expect(applyBooleanOperation(p1, p2, 'A not B').map(p => p.asSvgPath())).toStrictEqual([
          'M 12,-26.9231 L 50,-26.9231 L 50,50 L -50,50 L -50,26.9231 L -50,-26.9231 L -41.25,-26.9231 L -50,26.9231 L 20,-11.5385 L 12,-26.9231'
        ]);
      });

      it('B not A', () => {
        expect(applyBooleanOperation(p1, p2, 'B not A').map(p => p.asSvgPath())).toStrictEqual([
          'M 12,-26.9231 L -41.25,-26.9231 L -40,-34.6154 L 0,-50 L 12,-26.9231'
        ]);
      });

      it('A intersection B', () => {
        expect(
          applyBooleanOperation(p1, p2, 'A intersection B').map(p => p.asSvgPath())
        ).toStrictEqual([
          'M 12,-26.9231 L -41.25,-26.9231 L -50,26.9231 L 20,-11.5385 L 12,-26.9231'
        ]);
      });

      it('A xor B', () => {
        expect(applyBooleanOperation(p1, p2, 'A xor B').map(p => p.asSvgPath())).toStrictEqual([
          'M 12,-26.9231 L 50,-26.9231 L 50,50 L -50,50 L -50,26.9231 L -50,-26.9231 L -41.25,-26.9231 L -50,26.9231 L 20,-11.5385 L 12,-26.9231',
          'M 12,-26.9231 L -41.25,-26.9231 L -40,-34.6154 L 0,-50 L 12,-26.9231'
        ]);
      });

      it('A divide B', () => {
        expect(applyBooleanOperation(p1, p2, 'A divide B').map(p => p.asSvgPath())).toStrictEqual([
          'M 12,-26.9231 L 50,-26.9231 L 50,50 L -50,50 L -50,26.9231 L -50,-26.9231 L -41.25,-26.9231 L -50,26.9231 L 20,-11.5385 L 12,-26.9231',
          'M 12,-26.9231 L -41.25,-26.9231 L -40,-34.6154 L 0,-50 L 12,-26.9231',
          'M 12,-26.9231 L -41.25,-26.9231 L -50,26.9231 L 20,-11.5385 L 12,-26.9231'
        ]);
      });
    });

    describe('nonIntersecting', () => {
      const [p1, p2] = makePaths(TEST_CASES.NonIntersecting.p1, TEST_CASES.NonIntersecting.p2);

      it('A union B', () => {
        expect(applyBooleanOperation(p1, p2, 'A union B').map(p => p.asSvgPath())).toStrictEqual([
          'M -50,-50 L -50,0 L 0,0 L 0,-50 L -50,-50',
          'M 10,10 L 10,50 L 50,50 L 50,10 L 10,10'
        ]);
      });

      it('A not B', () => {
        expect(applyBooleanOperation(p1, p2, 'A not B').map(p => p.asSvgPath())).toStrictEqual([
          'M -50,-50 L -50,0 L 0,0 L 0,-50 L -50,-50'
        ]);
      });

      it('B not A', () => {
        expect(applyBooleanOperation(p1, p2, 'B not A').map(p => p.asSvgPath())).toStrictEqual([
          'M 10,10 L 10,50 L 50,50 L 50,10 L 10,10'
        ]);
      });

      it('A intersection B', () => {
        expect(
          applyBooleanOperation(p1, p2, 'A intersection B').map(p => p.asSvgPath())
        ).toStrictEqual([]);
      });

      it('A xor B', () => {
        expect(applyBooleanOperation(p1, p2, 'A xor B').map(p => p.asSvgPath())).toStrictEqual([
          'M -50,-50 L -50,0 L 0,0 L 0,-50 L -50,-50',
          'M 10,10 L 10,50 L 50,50 L 50,10 L 10,10'
        ]);
      });

      it('A divide B', () => {
        expect(applyBooleanOperation(p1, p2, 'A divide B').map(p => p.asSvgPath())).toStrictEqual([
          'M -50,-50 L -50,0 L 0,0 L 0,-50 L -50,-50',
          'M 10,10 L 10,50 L 50,50 L 50,10 L 10,10'
        ]);
      });
    });
  });
});
