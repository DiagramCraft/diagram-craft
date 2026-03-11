import { describe, expect, it } from 'vitest';
import { FreeEndpoint, PointInNodeEndpoint } from './endpoint';
import { buildAxisAlignedEdgePath } from './edgePathBuilder.axisAligned';
import { TestModel } from './test-support/testModel';
import { UnitOfWork } from './unitOfWork';

const expectStraightPath = (
  path: ReturnType<typeof buildAxisAlignedEdgePath>,
  start: { x: number; y: number },
  end: { x: number; y: number }
) => {
  expect(path.start).toEqual(start);
  expect(path.end).toEqual(end);
  expect(path.raw).toEqual([['L', end.x, end.y]]);
};

describe('buildAxisAlignedEdgePath', () => {
  it('snaps connected endpoints to a shared horizontal boundary line', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const startNode = layer.addNode({ bounds: { x: 0, y: 0, w: 10, h: 10, r: 0 } });
    const endNode = layer.addNode({ bounds: { x: 40, y: 0, w: 10, h: 10, r: 0 } });
    const edge = layer.addEdge();

    UnitOfWork.execute(diagram, uow => {
      edge.setStart(
        new PointInNodeEndpoint(startNode, undefined, { x: 9, y: 5 }, 'absolute'),
        uow
      );
      edge.setEnd(
        new PointInNodeEndpoint(endNode, undefined, { x: 1, y: 5 }, 'absolute'),
        uow
      );
    });

    const path = buildAxisAlignedEdgePath(edge);

    expectStraightPath(path, { x: 10, y: 5 }, { x: 40, y: 5 });
  });

  it('falls back to a shared vertical boundary line when horizontal overlap is unavailable', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const startNode = layer.addNode({ bounds: { x: 0, y: 0, w: 100, h: 10, r: 0 } });
    const endNode = layer.addNode({ bounds: { x: 50, y: 20, w: 100, h: 10, r: 0 } });
    const edge = layer.addEdge();

    UnitOfWork.execute(diagram, uow => {
      edge.setStart(
        new PointInNodeEndpoint(startNode, undefined, { x: 75, y: 9 }, 'absolute'),
        uow
      );
      edge.setEnd(
        new PointInNodeEndpoint(endNode, undefined, { x: 25, y: 1 }, 'absolute'),
        uow
      );
    });

    const path = buildAxisAlignedEdgePath(edge);

    expectStraightPath(path, { x: 75, y: 10 }, { x: 75, y: 20 });
  });

  it('snaps a single connected endpoint using the free endpoint alignment', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const startNode = layer.addNode({ bounds: { x: 0, y: 0, w: 10, h: 10, r: 0 } });
    const edge = layer.addEdge();

    UnitOfWork.execute(diagram, uow => {
      edge.setStart(
        new PointInNodeEndpoint(startNode, undefined, { x: 9, y: 5 }, 'absolute'),
        uow
      );
      edge.setEnd(new FreeEndpoint({ x: 30, y: 5 }), uow);
    });

    const path = buildAxisAlignedEdgePath(edge);

    expectStraightPath(path, { x: 10, y: 5 }, { x: 30, y: 5 });
  });

  it('uses a single waypoint as the midpoint hint for boundary selection', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const startNode = layer.addNode({ bounds: { x: 0, y: 0, w: 10, h: 20, r: 0 } });
    const endNode = layer.addNode({ bounds: { x: 40, y: 0, w: 10, h: 20, r: 0 } });
    const edge = layer.addEdge();

    UnitOfWork.execute(diagram, uow => {
      edge.setStart(
        new PointInNodeEndpoint(startNode, undefined, { x: 9, y: 15 }, 'absolute'),
        uow
      );
      edge.setEnd(
        new PointInNodeEndpoint(endNode, undefined, { x: 1, y: 15 }, 'absolute'),
        uow
      );
      edge.addWaypoint({ point: { x: 20, y: 15 } }, uow);
    });

    const path = buildAxisAlignedEdgePath(edge);

    expectStraightPath(path, { x: 10, y: 15 }, { x: 40, y: 15 });
  });
});
