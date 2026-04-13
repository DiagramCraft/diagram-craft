import { describe, expect, it } from 'vitest';
import { buildBezierEdgePath } from './edgePathBuilder.bezier';
import { FreeEndpoint } from './endpoint';
import { TestModel } from './test-support/testModel';
import { UnitOfWork } from './unitOfWork';

describe('buildBezierEdgePath', () => {
  it('falls back to a straight line when the edge has no waypoints', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const edge = layer.addEdge();

    UnitOfWork.execute(diagram, uow => {
      edge.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow);
      edge.setEnd(new FreeEndpoint({ x: 100, y: 50 }), uow);
    });

    const path = buildBezierEdgePath(edge);

    expect(path.start).toEqual({ x: 0, y: 0 });
    expect(path.end).toEqual({ x: 100, y: 50 });
    expect(path.raw).toEqual([['L', 100, 50]]);
  });

  it('builds quadratic segments for a single waypoint with explicit control points', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const edge = layer.addEdge();

    UnitOfWork.execute(diagram, uow => {
      edge.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow);
      edge.setEnd(new FreeEndpoint({ x: 100, y: 0 }), uow);
      edge.addWaypoint(
        {
          point: { x: 50, y: 50 },
          controlPoints: {
            cp1: { x: -10, y: 0 },
            cp2: { x: 10, y: 0 }
          }
        },
        uow
      );
    });

    const path = buildBezierEdgePath(edge);

    expect(path.raw).toEqual([
      ['Q', 40, 50, 50, 50],
      ['Q', 60, 50, 100, 0]
    ]);
  });

  it('infers missing control points from adjacent points for multi-waypoint bezier edges', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const edge = layer.addEdge();

    UnitOfWork.execute(diagram, uow => {
      edge.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow);
      edge.setEnd(new FreeEndpoint({ x: 100, y: 0 }), uow);
      edge.addWaypoint({ point: { x: 25, y: 25 } }, uow);
      edge.addWaypoint({ point: { x: 75, y: 25 } }, uow);
    });

    const path = buildBezierEdgePath(edge);

    expect(path.raw).toEqual([
      ['Q', 10, 20, 25, 25],
      ['C', 40, 30, 60, 30, 75, 25],
      ['Q', 90, 20, 100, 0]
    ]);
  });
});
