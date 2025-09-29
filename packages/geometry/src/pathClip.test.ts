import { describe, expect, it, test } from 'vitest';
import { _test, applyBooleanOperation } from './pathClip';
import { PathListBuilder } from './pathListBuilder';
import { EXTRA_TEST_CASES } from './pathClip.fixtures';
import { PathList } from './pathList';
import { _p } from './point';

const makePaths = (props: {
  p1: PathListBuilder | PathList;
  p2: PathListBuilder | PathList;
}): [PathList, PathList] => {
  const cp1 = props.p1 instanceof PathList ? props.p1 : props.p1.getPaths();
  const cp2 = props.p2 instanceof PathList ? props.p2 : props.p2.getPaths();

  return [cp1, cp2];
};

describe('pathClip', () => {
  describe('makeNeighbors', () => {
    test('makeNeighbors', () => {
      // Setup
      const v1 = _test.makeCrossingVertex({
        point: _p(10, 10),
        alpha: 0,
        label: 'a',
        segment: {} as any
      });
      const v2 = _test.makeCrossingVertex({
        point: _p(100, 100),
        alpha: 1,
        label: 'b',
        segment: {} as any
      });

      // Act
      _test.makeNeighbors(v1, v2);

      // Verify
      expect(v1.neighbor).toBe(v2);
      expect(v2.neighbor).toBe(v1);
    });
  });

  describe('epsilon', () => {
    test('epsilon is scale * base', () => {
      // Verify
      expect(_test.epsilon(100)).toBe(1);
      expect(_test.epsilon(100, 0.1)).toBe(10);
    });
  });

  describe('makeLinkedList', () => {
    test('links circularly for three vertices', () => {
      // Setup
      const v0: any = { type: 'simple', point: _p(0, 0), segment: {} as any, label: 'v0' };
      const v1: any = { type: 'simple', point: _p(1, 0), segment: {} as any, label: 'v1' };
      const v2: any = { type: 'simple', point: _p(2, 0), segment: {} as any, label: 'v2' };
      const vertexList: any = { path: {} as any, vertices: [v0, v1, v2], type: 'leaf' };

      // Act
      _test.makeLinkedList(vertexList);

      // Verify
      expect(v0.next).toBe(v1);
      expect(v1.next).toBe(v2);
      expect(v2.next).toBe(v0);

      expect(v0.prev).toBe(v2);
      expect(v1.prev).toBe(v0);
      expect(v2.prev).toBe(v1);

      // Mutual linkage
      expect(v0.prev.next).toBe(v0);
      expect(v1.prev.next).toBe(v1);
      expect(v2.prev.next).toBe(v2);

      expect(v0.next.prev).toBe(v0);
      expect(v1.next.prev).toBe(v1);
      expect(v2.next.prev).toBe(v2);
    });

    test('links circularly for two vertices', () => {
      // Setup
      const a: any = { type: 'simple', point: _p(0, 0), segment: {} as any, label: 'a' };
      const b: any = { type: 'simple', point: _p(1, 0), segment: {} as any, label: 'b' };
      const vertexList: any = { path: {} as any, vertices: [a, b], type: 'leaf' };

      // Act
      _test.makeLinkedList(vertexList);

      // Verify
      expect(a.next).toBe(b);
      expect(b.next).toBe(a);
      expect(a.prev).toBe(b);
      expect(b.prev).toBe(a);

      expect(a.prev.next).toBe(a);
      expect(b.prev.next).toBe(b);
      expect(a.next.prev).toBe(a);
      expect(b.next.prev).toBe(b);
    });

    test('single vertex points to itself', () => {
      // Setup
      const a: any = { type: 'simple', point: _p(0, 0), segment: {} as any, label: 'solo' };
      const vertexList: any = { path: {} as any, vertices: [a], type: 'leaf' };

      // Act
      _test.makeLinkedList(vertexList);

      // Verify
      expect(a.next).toBe(a);
      expect(a.prev).toBe(a);
      expect(a.prev.next).toBe(a);
      expect(a.next.prev).toBe(a);
    });

    test('empty vertex list is a no-op', () => {
      // Setup
      const vertexList: any = { path: {} as any, vertices: [], type: 'leaf' };

      // Act
      _test.makeLinkedList(vertexList);

      // Verify
      expect(vertexList.vertices.length).toBe(0);
    });
  });

  describe('integration tests', () => {
    describe('onEdge', () => {
      const [p1, p2] = makePaths(EXTRA_TEST_CASES.OnEdge());

      it('A union B', () => {
        expect(applyBooleanOperation(p1, p2, 'A union B').map(p => p.asSvgPath())).toStrictEqual([
          'M 50,0 L 100,0 L 100,100 L 0,100 L 0,80 L -30,10 L 20,-20 L 50,0'
        ]);
      });

      it('A not B', () => {
        expect(applyBooleanOperation(p1, p2, 'A not B').map(p => p.asSvgPath())).toStrictEqual([
          'M 50,0 L 100,0 L 100,100 L 0,100 L 0,80 L 80,20 L 50,0'
        ]);
      });

      it('B not A', () => {
        expect(applyBooleanOperation(p1, p2, 'B not A').map(p => p.asSvgPath())).toStrictEqual([
          'M -30,10 L 20,-20 L 50,0 L 0,0 L 0,80 L -30,10'
        ]);
      });

      it('A intersection B', () => {
        const result = applyBooleanOperation(p1, p2, 'A intersection B').map(p => p.asSvgPath());
        expect(result).toStrictEqual(['M 0,80 L 0,0 L 50,0 L 80,20 L 0,80']);
      });

      it('A xor B', () => {
        expect(applyBooleanOperation(p1, p2, 'A xor B').map(p => p.asSvgPath())).toStrictEqual([
          'M 50,0 L 100,0 L 100,100 L 0,100 L 0,80 L 80,20 L 50,0',
          'M -30,10 L 20,-20 L 50,0 L 0,0 L 0,80 L -30,10'
        ]);
      });

      it('A divide B', () => {
        const result = applyBooleanOperation(p1, p2, 'A divide B').map(p => p.asSvgPath());
        expect(result).toStrictEqual([
          'M 50,0 L 100,0 L 100,100 L 0,100 L 0,80 L 80,20 L 50,0',
          'M -30,10 L 20,-20 L 50,0 L 0,0 L 0,80 L -30,10',
          'M 0,80 L 0,0 L 50,0 L 80,20 L 0,80'
        ]);
      });
    });

    describe('onEdge2', () => {
      const [p1, p2] = makePaths(EXTRA_TEST_CASES.OnEdge2());

      it('A union B', () => {
        expect(applyBooleanOperation(p1, p2, 'A union B').map(p => p.asSvgPath())).toStrictEqual([
          'M 0,0 L 8.8889,0 L 10,-10 L 40,-20 L 60,0 L 100,0 L 100,100 L 0,100 L 0,80 L 0,0'
        ]);
      });

      it('A not B', () => {
        const result = applyBooleanOperation(p1, p2, 'A not B').map(p => p.asSvgPath());
        expect(result).toStrictEqual([
          'M 0,0 L 8.8889,0 L 0,80 L 80,20 L 60,0 L 100,0 L 100,100 L 0,100 L 0,80 L 0,0'
        ]);
      });

      it('B not A', () => {
        const result = applyBooleanOperation(p1, p2, 'B not A').map(p => p.asSvgPath());
        expect(result).toStrictEqual(['M 10,-10 L 40,-20 L 60,0 L 8.8889,0 L 10,-10']);
      });

      it('A intersection B', () => {
        const result = applyBooleanOperation(p1, p2, 'A intersection B').map(p => p.asSvgPath());
        expect(result).toStrictEqual(['M 8.8889,0 L 60,0 L 80,20 L 0,80 L 8.8889,0']);
      });

      it('A xor B', () => {
        const result = applyBooleanOperation(p1, p2, 'A xor B').map(p => p.asSvgPath());
        expect(result).toStrictEqual([
          'M 0,0 L 8.8889,0 L 0,80 L 80,20 L 60,0 L 100,0 L 100,100 L 0,100 L 0,80 L 0,0',
          'M 10,-10 L 40,-20 L 60,0 L 8.8889,0 L 10,-10'
        ]);
      });

      it('A divide B', () => {
        const result = applyBooleanOperation(p1, p2, 'A divide B').map(p => p.asSvgPath());
        expect(result).toStrictEqual([
          'M 0,0 L 8.8889,0 L 0,80 L 80,20 L 60,0 L 100,0 L 100,100 L 0,100 L 0,80 L 0,0',
          'M 10,-10 L 40,-20 L 60,0 L 8.8889,0 L 10,-10',
          'M 8.8889,0 L 60,0 L 80,20 L 0,80 L 8.8889,0'
        ]);
      });
    });

    describe('RightTriangleOverRectangle', () => {
      const [p1, p2] = makePaths(EXTRA_TEST_CASES.RightTriangleOverRectangle());

      it('A union B', () => {
        expect(applyBooleanOperation(p1, p2, 'A union B').map(p => p.asSvgPath())).toStrictEqual([
          'M 0,0 L 100,0 L 100,100 L 0,100 L 0,0'
        ]);
      });

      it('A not B', () => {
        expect(applyBooleanOperation(p1, p2, 'A not B').map(p => p.asSvgPath())).toStrictEqual([
          'M 0,0 L 100,0 L 0,100 L 0,0'
        ]);
      });

      it('B not A', () => {
        expect(applyBooleanOperation(p1, p2, 'B not A').map(p => p.asSvgPath())).toStrictEqual([]);
      });

      it('A intersection B', () => {
        const result = applyBooleanOperation(p1, p2, 'A intersection B').map(p => p.asSvgPath());
        expect(result).toStrictEqual(['M 100,0 L 100,100 L 0,100 L 100,0']);
      });

      it('A xor B', () => {
        expect(applyBooleanOperation(p1, p2, 'A xor B').map(p => p.asSvgPath())).toStrictEqual([
          'M 0,0 L 100,0 L 0,100 L 0,0'
        ]);
      });

      it('A divide B', () => {
        const result = applyBooleanOperation(p1, p2, 'A divide B').map(p => p.asSvgPath());
        expect(result).toStrictEqual([
          'M 0,0 L 100,0 L 0,100 L 0,0',
          'M 100,0 L 100,100 L 0,100 L 100,0'
        ]);
      });
    });

    describe('RightTriangleOverRectangle', () => {
      const [p1, p2] = makePaths(EXTRA_TEST_CASES.CircleInRectangleInverted());

      it('A union B', () => {
        expect(applyBooleanOperation(p1, p2, 'A union B').map(p => p.asSvgPath())).toStrictEqual([
          'M 50,50 L 400,50 L 400,350 L 50,350 L 50,50'
        ]);
      });

      it('A not B', () => {
        expect(applyBooleanOperation(p1, p2, 'A not B').map(p => p.asSvgPath())).toStrictEqual([
          'M 50,50 L 400,50 L 400,350 L 50,350 L 50,50 M 210,75 C 140.96,75,85,130.96,85,200 C 85,269.04,140.96,325,210,325 C 279.04,325,335,269.04,335,200 C 335,130.96,279.04,75,210,75'
        ]);
      });

      it('B not A', () => {
        expect(applyBooleanOperation(p1, p2, 'B not A').map(p => p.asSvgPath())).toStrictEqual([]);
      });

      it('A intersection B', () => {
        const result = applyBooleanOperation(p1, p2, 'A intersection B').map(p => p.asSvgPath());
        expect(result).toStrictEqual([
          'M 210,75 A 125,125,0,0,1,335,200 A 125,125,0,0,1,210,325 A 125,125,0,0,1,85,200 A 125,125,0,0,1,210,75'
        ]);
      });

      it('A xor B', () => {
        expect(applyBooleanOperation(p1, p2, 'A xor B').map(p => p.asSvgPath())).toStrictEqual([
          'M 50,50 L 400,50 L 400,350 L 50,350 L 50,50 M 210,75 C 140.96,75,85,130.96,85,200 C 85,269.04,140.96,325,210,325 C 279.04,325,335,269.04,335,200 C 335,130.96,279.04,75,210,75'
        ]);
      });

      it('A divide B', () => {
        const result = applyBooleanOperation(p1, p2, 'A divide B').map(p => p.asSvgPath());
        expect(result).toStrictEqual([
          'M 50,50 L 400,50 L 400,350 L 50,350 L 50,50 M 210,75 C 140.96,75,85,130.96,85,200 C 85,269.04,140.96,325,210,325 C 279.04,325,335,269.04,335,200 C 335,130.96,279.04,75,210,75',
          'M 210,75 A 125,125,0,0,1,335,200 A 125,125,0,0,1,210,325 A 125,125,0,0,1,85,200 A 125,125,0,0,1,210,75'
        ]);
      });
    });
  });
});
