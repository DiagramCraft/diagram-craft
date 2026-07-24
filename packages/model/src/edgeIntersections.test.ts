import { describe, expect, it } from 'vitest';
import { UnitOfWork } from './unitOfWork';
import { FreeEndpoint } from './endpoint';
import { TestModel } from './test-support/testModel';
import { intersectionListIsSame, recalculateIntersections } from './edgeIntersections';

describe('recalculateIntersections', () => {
  it('returns no intersections when there is only one visible edge', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const edge = layer.addEdge();
    UnitOfWork.execute(diagram, uow => {
      edge.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow);
      edge.setEnd(new FreeEndpoint({ x: 100, y: 0 }), uow);
    });

    expect(recalculateIntersections(edge, diagram)).toEqual([]);
  });

  it('finds the crossing point between two crossing edges', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();

    const edgeA = layer.addEdge();
    UnitOfWork.execute(diagram, uow => {
      edgeA.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow);
      edgeA.setEnd(new FreeEndpoint({ x: 100, y: 100 }), uow);
    });

    const edgeB = layer.addEdge();
    UnitOfWork.execute(diagram, uow => {
      edgeB.setStart(new FreeEndpoint({ x: 0, y: 100 }), uow);
      edgeB.setEnd(new FreeEndpoint({ x: 100, y: 0 }), uow);
    });

    const intersections = recalculateIntersections(edgeA, diagram);
    expect(intersections).toHaveLength(1);
    expect(intersections[0]!.point).toStrictEqual({ x: 50, y: 50 });
  });

  it('marks edges encountered before the current edge as above, and after as below', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();

    const edgeA = layer.addEdge();
    UnitOfWork.execute(diagram, uow => {
      edgeA.setStart(new FreeEndpoint({ x: 0, y: 50 }), uow);
      edgeA.setEnd(new FreeEndpoint({ x: 100, y: 50 }), uow);
    });

    const edgeB = layer.addEdge();
    UnitOfWork.execute(diagram, uow => {
      edgeB.setStart(new FreeEndpoint({ x: 30, y: 0 }), uow);
      edgeB.setEnd(new FreeEndpoint({ x: 30, y: 100 }), uow);
    });

    const edgeC = layer.addEdge();
    UnitOfWork.execute(diagram, uow => {
      edgeC.setStart(new FreeEndpoint({ x: 70, y: 0 }), uow);
      edgeC.setEnd(new FreeEndpoint({ x: 70, y: 100 }), uow);
    });

    // edgeA was added before edgeB and edgeC, so both its intersections are 'below'
    const intersections = recalculateIntersections(edgeA, diagram);
    expect(intersections).toHaveLength(2);
    expect(intersections.every(i => i.type === 'below')).toBe(true);

    // edgeC was added after edgeA and edgeB, so its intersection with edgeA is 'above'
    const intersectionsForC = recalculateIntersections(edgeC, diagram);
    expect(intersectionsForC).toHaveLength(1);
    expect(intersectionsForC[0]!.type).toBe('above');
  });
});

describe('intersectionListIsSame', () => {
  it('returns true for two empty lists', () => {
    expect(intersectionListIsSame([], [])).toBe(true);
  });

  it('returns false when lengths differ', () => {
    expect(intersectionListIsSame([], [{ point: { x: 0, y: 0 }, type: 'above' }])).toBe(false);
  });

  it('returns false when points differ', () => {
    expect(
      intersectionListIsSame(
        [{ point: { x: 0, y: 0 }, type: 'above' }],
        [{ point: { x: 1, y: 0 }, type: 'above' }]
      )
    ).toBe(false);
  });

  it('returns false when types differ', () => {
    expect(
      intersectionListIsSame(
        [{ point: { x: 0, y: 0 }, type: 'above' }],
        [{ point: { x: 0, y: 0 }, type: 'below' }]
      )
    ).toBe(false);
  });

  it('returns true for equal lists', () => {
    const a = [
      { point: { x: 0, y: 0 }, type: 'above' as const },
      { point: { x: 1, y: 1 }, type: 'below' as const }
    ];
    const b = [
      { point: { x: 0, y: 0 }, type: 'above' as const },
      { point: { x: 1, y: 1 }, type: 'below' as const }
    ];
    expect(intersectionListIsSame(a, b)).toBe(true);
  });
});
