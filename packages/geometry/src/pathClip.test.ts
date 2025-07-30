import { describe, expect, it } from 'vitest';
import { _test, applyBooleanOperation, type Vertex } from './pathClip';
import { PathListBuilder } from './pathListBuilder';
import { TEST_CASES } from './pathClip.fixtures';
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
  describe('integration tests', () => {
    describe('onEdge', () => {
      const [p1, p2] = makePaths(TEST_CASES._OnEdge());

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
          'M 50,0 L 0,0 L 0,80 L -30,10 L 20,-20 L 50,0'
        ]);
      });

      it('A intersection B', () => {
        const result = applyBooleanOperation(p1, p2, 'A intersection B').map(p => p.asSvgPath());
        expect(result).toStrictEqual(['M 50,0 L 80,20 L 0,80 L 0,0 L 50,0']);
      });

      it('A xor B', () => {
        expect(applyBooleanOperation(p1, p2, 'A xor B').map(p => p.asSvgPath())).toStrictEqual([
          'M 50,0 L 100,0 L 100,100 L 0,100 L 0,80 L 80,20 L 50,0',
          'M 50,0 L 0,0 L 0,80 L -30,10 L 20,-20 L 50,0'
        ]);
      });

      it('A divide B', () => {
        const result = applyBooleanOperation(p1, p2, 'A divide B').map(p => p.asSvgPath());
        expect(result).toStrictEqual([
          'M 50,0 L 100,0 L 100,100 L 0,100 L 0,80 L 80,20 L 50,0',
          'M 50,0 L 0,0 L 0,80 L -30,10 L 20,-20 L 50,0',
          'M 50,0 L 80,20 L 0,80 L 0,0 L 50,0'
        ]);
      });
    });

    describe('onEdge2', () => {
      const [p1, p2] = makePaths(TEST_CASES._OnEdge2());

      it('A union B', () => {
        expect(applyBooleanOperation(p1, p2, 'A union B').map(p => p.asSvgPath())).toStrictEqual([
          'M 8.8889,0 L 10,-10 L 40,-20 L 60,0 L 100,0 L 100,100 L 0,100 L 0,80 L 0,0 L 8.8889,0'
        ]);
      });

      it('A not B', () => {
        const result = applyBooleanOperation(p1, p2, 'A not B').map(p => p.asSvgPath());
        expect(result).toStrictEqual([
          'M 8.8889,0 L 0,80 L 80,20 L 60,0 L 100,0 L 100,100 L 0,100 L 0,80 L 0,0 L 8.8889,0'
        ]);
      });

      it('B not A', () => {
        const result = applyBooleanOperation(p1, p2, 'B not A').map(p => p.asSvgPath());
        expect(result).toStrictEqual(['M 8.8889,0 L 10,-10 L 40,-20 L 60,0 L 8.8889,0']);
      });

      it('A intersection B', () => {
        const result = applyBooleanOperation(p1, p2, 'A intersection B').map(p => p.asSvgPath());
        expect(result).toStrictEqual(['M 8.8889,0 L 60,0 L 80,20 L 0,80 L 8.8889,0']);
      });

      it('A xor B', () => {
        const result = applyBooleanOperation(p1, p2, 'A xor B').map(p => p.asSvgPath());
        expect(result).toStrictEqual([
          'M 8.8889,0 L 0,80 L 80,20 L 60,0 L 100,0 L 100,100 L 0,100 L 0,80 L 0,0 L 8.8889,0',
          'M 8.8889,0 L 10,-10 L 40,-20 L 60,0 L 8.8889,0'
        ]);
      });

      it('A divide B', () => {
        const result = applyBooleanOperation(p1, p2, 'A divide B').map(p => p.asSvgPath());
        expect(result).toStrictEqual([
          'M 8.8889,0 L 0,80 L 80,20 L 60,0 L 100,0 L 100,100 L 0,100 L 0,80 L 0,0 L 8.8889,0',
          'M 8.8889,0 L 10,-10 L 40,-20 L 60,0 L 8.8889,0',
          'M 8.8889,0 L 60,0 L 80,20 L 0,80 L 8.8889,0'
        ]);
      });
    });

    describe('nonIntersecting', () => {
      const [p1, p2] = makePaths(TEST_CASES._NonIntersecting());

      it('A union B', () => {
        expect(applyBooleanOperation(p1, p2, 'A union B').map(p => p.asSvgPath())).toStrictEqual([
          'M 20,20 L 50,20 L 50,50 L 20,50 L 20,20',
          'M 70,70 L 110,70 L 110,110 L 70,110 L 70,70'
        ]);
      });

      it('A not B', () => {
        expect(applyBooleanOperation(p1, p2, 'A not B').map(p => p.asSvgPath())).toStrictEqual([
          'M 20,20 L 50,20 L 50,50 L 20,50 L 20,20'
        ]);
      });

      it('B not A', () => {
        expect(applyBooleanOperation(p1, p2, 'B not A').map(p => p.asSvgPath())).toStrictEqual([
          'M 70,70 L 110,70 L 110,110 L 70,110 L 70,70'
        ]);
      });

      it('A intersection B', () => {
        expect(
          applyBooleanOperation(p1, p2, 'A intersection B').map(p => p.asSvgPath())
        ).toStrictEqual([]);
      });

      it('A xor B', () => {
        expect(applyBooleanOperation(p1, p2, 'A xor B').map(p => p.asSvgPath())).toStrictEqual([
          'M 20,20 L 50,20 L 50,50 L 20,50 L 20,20',
          'M 70,70 L 110,70 L 110,110 L 70,110 L 70,70'
        ]);
      });

      it('A divide B', () => {
        expect(applyBooleanOperation(p1, p2, 'A divide B').map(p => p.asSvgPath())).toStrictEqual([
          'M 20,20 L 50,20 L 50,50 L 20,50 L 20,20',
          'M 70,70 L 110,70 L 110,110 L 70,110 L 70,70'
        ]);
      });
    });

    describe('CircleInRectangle', () => {
      const [p1, p2] = makePaths(TEST_CASES.CircleInRectangle());

      it('A union B', () => {
        expect(applyBooleanOperation(p1, p2, 'A union B').map(p => p.asSvgPath())).toStrictEqual([
          'M 50,50 L 400,50 L 400,350 L 50,350 L 50,50'
        ]);
      });

      it('A not B', () => {
        expect(applyBooleanOperation(p1, p2, 'A not B').map(p => p.asSvgPath())).toStrictEqual([]);
      });

      it('B not A', () => {
        expect(applyBooleanOperation(p1, p2, 'B not A').map(p => p.asSvgPath())).toStrictEqual([
          'M 50,50 L 400,50 L 400,350 L 50,350 L 50,50 M 210,75 C 140.96,75,85,130.96,85,200 C 85,269.04,140.96,325,210,325 C 279.04,325,335,269.04,335,200 C 335,130.96,279.04,75,210,75'
        ]);
      });

      it('A intersection B', () => {
        expect(
          applyBooleanOperation(p1, p2, 'A intersection B').map(p => p.asSvgPath())
        ).toStrictEqual([
          'M 210,75 A 125,125,0,0,1,335,200 A 125,125,0,0,1,210,325 A 125,125,0,0,1,85,200 A 125,125,0,0,1,210,75'
        ]);
      });

      it('A xor B', () => {
        expect(applyBooleanOperation(p1, p2, 'A xor B').map(p => p.asSvgPath())).toStrictEqual([
          'M 50,50 L 400,50 L 400,350 L 50,350 L 50,50 M 210,75 C 140.96,75,85,130.96,85,200 C 85,269.04,140.96,325,210,325 C 279.04,325,335,269.04,335,200 C 335,130.96,279.04,75,210,75'
        ]);
      });

      it('A divide B', () => {
        expect(applyBooleanOperation(p1, p2, 'A divide B').map(p => p.asSvgPath())).toStrictEqual([
          'M 50,50 L 400,50 L 400,350 L 50,350 L 50,50 M 210,75 C 140.96,75,85,130.96,85,200 C 85,269.04,140.96,325,210,325 C 279.04,325,335,269.04,335,200 C 335,130.96,279.04,75,210,75',
          'M 210,75 A 125,125,0,0,1,335,200 A 125,125,0,0,1,210,325 A 125,125,0,0,1,85,200 A 125,125,0,0,1,210,75'
        ]);
      });
    });
  });

  describe('CircleInRectangleInverted', () => {
    const [p1, p2] = makePaths(TEST_CASES._CircleInRectangleInverted());

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
      expect(
        applyBooleanOperation(p1, p2, 'A intersection B').map(p => p.asSvgPath())
      ).toStrictEqual([
        'M 210,75 A 125,125,0,0,1,335,200 A 125,125,0,0,1,210,325 A 125,125,0,0,1,85,200 A 125,125,0,0,1,210,75'
      ]);
    });

    it('A xor B', () => {
      expect(applyBooleanOperation(p1, p2, 'A xor B').map(p => p.asSvgPath())).toStrictEqual([
        'M 50,50 L 400,50 L 400,350 L 50,350 L 50,50 M 210,75 C 140.96,75,85,130.96,85,200 C 85,269.04,140.96,325,210,325 C 279.04,325,335,269.04,335,200 C 335,130.96,279.04,75,210,75'
      ]);
    });

    it('A divide B', () => {
      expect(applyBooleanOperation(p1, p2, 'A divide B').map(p => p.asSvgPath())).toStrictEqual([
        'M 50,50 L 400,50 L 400,350 L 50,350 L 50,50 M 210,75 C 140.96,75,85,130.96,85,200 C 85,269.04,140.96,325,210,325 C 279.04,325,335,269.04,335,200 C 335,130.96,279.04,75,210,75',
        'M 210,75 A 125,125,0,0,1,335,200 A 125,125,0,0,1,210,325 A 125,125,0,0,1,85,200 A 125,125,0,0,1,210,75'
      ]);
    });
  });
});

describe('removeDuplicatePoints', () => {
  it('should remove duplicate points', () => {
    // Setup
    const vertices: Vertex[] = [
      { label: 'a', intersect: true, alpha: 0.5, point: _p(10, 10) } as Vertex,
      { label: 'b', intersect: true, alpha: 0.5, point: _p(10, 10) } as Vertex,
      { label: 'c', intersect: true, alpha: 0.5, point: _p(20, 20) } as Vertex
    ];

    // Act
    _test.removeDuplicatePoints(vertices);

    // Verify
    expect(vertices).toHaveLength(2);
    expect(vertices[0].label).toBe('a');
    expect(vertices[1].label).toBe('c');
  });

  it('should keep intersection points', () => {
    // Setup
    const vertices: Vertex[] = [
      { label: 'a', alpha: 0.5, point: _p(10, 10) } as Vertex,
      { label: 'b', intersect: true, alpha: 0.5, point: _p(10, 10) } as Vertex,
      { label: 'c', intersect: true, alpha: 0.5, point: _p(20, 20) } as Vertex
    ];

    // Act
    _test.removeDuplicatePoints(vertices);

    // Verify
    expect(vertices).toHaveLength(2);
    expect(vertices[0].label).toBe('b');
    expect(vertices[1].label).toBe('c');
  });

  it('should keep overlap points over intersection points', () => {
    // Setup
    const vertices: Vertex[] = [
      {
        label: 'a',
        intersect: true,
        intersectionType: 'intersection',
        alpha: 0.5,
        point: _p(10, 10)
      } as Vertex,
      {
        label: 'b',
        intersect: true,
        intersectionType: 'overlap',
        alpha: 0.5,
        point: _p(10, 10)
      } as Vertex,
      { label: 'c', intersect: true, alpha: 0.5, point: _p(20, 20) } as Vertex
    ];

    // Act
    _test.removeDuplicatePoints(vertices);

    // Verify
    expect(vertices).toHaveLength(2);
    expect(vertices[0].label).toBe('b');
    expect(vertices[1].label).toBe('c');
  });

  it('test', () => {
    //const vertices: Vertex[] =
  });
});
