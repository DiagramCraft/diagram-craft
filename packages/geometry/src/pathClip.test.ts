import { describe, it, expect } from 'vitest';
import { applyBooleanOperation } from './pathClip';
import { PathBuilder } from './pathBuilder';
import { TEST_CASES } from './pathClip.testCases';
import { Scale, Translation } from './transform';

const makePath = (path: string, n: number) => {
  const p = PathBuilder.fromString(path);
  p.setTransform([new Translation({ x: n, y: n }), new Scale(100, 100)]);
  return p.getPaths();
};

describe('pathClip', () => {
  describe('integration tests', () => {
    describe('onEdge', () => {
      const p1 = makePath(TEST_CASES.OnEdge.p1, -0.3);
      const p2 = makePath(TEST_CASES.OnEdge.p2, -0.6);

      it('A union B', () => {
        expect(applyBooleanOperation(p1, p2, 'A union B').map(p => p.asSvgPath())).toStrictEqual([
          'M -30,40 L -30,70 L 70,70 L 70,-30 L 20,-30 L -10,-60 L -60,-10 L -30,40'
        ]);
      });

      it('A not B', () => {
        expect(applyBooleanOperation(p1, p2, 'A not B').map(p => p.asSvgPath())).toStrictEqual([
          'M -30,40 L -30,70 L 70,70 L 70,-30 L 20,-30 L 40,-10 L -30,40'
        ]);
      });

      it('B not A', () => {
        expect(applyBooleanOperation(p1, p2, 'B not A').map(p => p.asSvgPath())).toStrictEqual([
          'M -30,40 L -30,-30 L 20,-30 L -10,-60 L -60,-10 L -30,40'
        ]);
      });

      it('A intersection B', () => {
        expect(
          applyBooleanOperation(p1, p2, 'A intersection B').map(p => p.asSvgPath())
        ).toStrictEqual(['M -30,40 L -30,-30 L 20,-30 L 40,-10 L -30,40']);
      });

      it('A xor B', () => {
        expect(applyBooleanOperation(p1, p2, 'A xor B').map(p => p.asSvgPath())).toStrictEqual([
          'M -30,40 L -30,70 L 70,70 L 70,-30 L 20,-30 L 40,-10 L -30,40',
          'M -30,40 L -30,-30 L 20,-30 L -10,-60 L -60,-10 L -30,40'
        ]);
      });

      it('A divide B', () => {
        expect(applyBooleanOperation(p1, p2, 'A divide B').map(p => p.asSvgPath())).toStrictEqual([
          'M -30,40 L -30,70 L 70,70 L 70,-30 L 20,-30 L 40,-10 L -30,40',
          'M -30,40 L -30,-30 L 20,-30 L -10,-60 L -60,-10 L -30,40',
          'M -30,40 L -30,-30 L 20,-30 L 40,-10 L -30,40'
        ]);
      });
    });

    describe('onEdge2', () => {
      const p1 = makePath(TEST_CASES.OnEdge2.p1, -0.3);
      const p2 = makePath(TEST_CASES.OnEdge2.p2, -0.6);

      it('A union B', () => {
        expect(applyBooleanOperation(p1, p2, 'A union B').map(p => p.asSvgPath())).toStrictEqual([
          'M 32,-30 L 70,-30 L 70,70 L -30,70 L -30,40 L -30,-30 L -21.25,-30 L -20,-40 L 20,-60 L 32,-30'
        ]);
      });

      it('A not B', () => {
        expect(applyBooleanOperation(p1, p2, 'A not B').map(p => p.asSvgPath())).toStrictEqual([
          'M 32,-30 L 70,-30 L 70,70 L -30,70 L -30,40 L -30,-30 L -21.25,-30 L -30,40 L 40,-10 L 32,-30'
        ]);
      });

      it('B not A', () => {
        expect(applyBooleanOperation(p1, p2, 'B not A').map(p => p.asSvgPath())).toStrictEqual([
          'M 32,-30 L -21.25,-30 L -20,-40 L 20,-60 L 32,-30'
        ]);
      });

      it('A intersection B', () => {
        expect(
          applyBooleanOperation(p1, p2, 'A intersection B').map(p => p.asSvgPath())
        ).toStrictEqual(['M 32,-30 L -21.25,-30 L -30,40 L 40,-10 L 32,-30']);
      });

      it('A xor B', () => {
        expect(applyBooleanOperation(p1, p2, 'A xor B').map(p => p.asSvgPath())).toStrictEqual([
          'M 32,-30 L 70,-30 L 70,70 L -30,70 L -30,40 L -30,-30 L -21.25,-30 L -30,40 L 40,-10 L 32,-30',
          'M 32,-30 L -21.25,-30 L -20,-40 L 20,-60 L 32,-30'
        ]);
      });

      it('A divide B', () => {
        expect(applyBooleanOperation(p1, p2, 'A divide B').map(p => p.asSvgPath())).toStrictEqual([
          'M 32,-30 L 70,-30 L 70,70 L -30,70 L -30,40 L -30,-30 L -21.25,-30 L -30,40 L 40,-10 L 32,-30',
          'M 32,-30 L -21.25,-30 L -20,-40 L 20,-60 L 32,-30',
          'M 32,-30 L -21.25,-30 L -30,40 L 40,-10 L 32,-30'
        ]);
      });
    });

    describe('nonIntersecting', () => {
      const p1 = makePath(TEST_CASES.NonIntersecting.p1, TEST_CASES.NonIntersecting.p1Offset);
      const p2 = makePath(TEST_CASES.NonIntersecting.p2, TEST_CASES.NonIntersecting.p2Offset);

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
