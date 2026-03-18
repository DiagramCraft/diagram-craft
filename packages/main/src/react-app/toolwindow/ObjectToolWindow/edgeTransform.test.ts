import { describe, expect, test } from 'vitest';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { AnchorEndpoint, FreeEndpoint } from '@diagram-craft/model/endpoint';
import {
  applyEdgeTransform,
  canTransformEdge,
  getEdgeRotation,
  getEdgeTransformBounds
} from './edgeTransform';
import { Angle } from '@diagram-craft/geometry/angle';
import { Point } from '@diagram-craft/geometry/point';

describe('edgeTransform', () => {
  test('translates a free-free edge including waypoints', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const edge = layer.addEdge();

    UnitOfWork.execute(diagram, uow => {
      edge.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow);
      edge.setEnd(new FreeEndpoint({ x: 100, y: 100 }), uow);
      edge.addWaypoint({ point: { x: 25, y: 35 } }, uow);
    });

    UnitOfWork.execute(diagram, uow => {
      applyEdgeTransform(
        edge,
        { x: 0, y: 0, w: 100, h: 100, r: 0 },
        { x: 10, y: 20, w: 100, h: 100, r: 0 },
        uow
      );
    });

    expect(edge.start.position).toEqual({ x: 10, y: 20 });
    expect(edge.end.position).toEqual({ x: 110, y: 120 });
    expect(edge.waypoints[0]?.point).toEqual({ x: 35, y: 55 });
  });

  test('scales a free-free edge including control points', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const edge = layer.addEdge();

    UnitOfWork.execute(diagram, uow => {
      edge.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow);
      edge.setEnd(new FreeEndpoint({ x: 100, y: 100 }), uow);
      edge.addWaypoint(
        {
          point: { x: 25, y: 25 },
          controlPoints: {
            cp1: { x: -5, y: 5 },
            cp2: { x: 10, y: -10 }
          }
        },
        uow
      );
    });

    UnitOfWork.execute(diagram, uow => {
      applyEdgeTransform(
        edge,
        { x: 0, y: 0, w: 100, h: 100, r: 0 },
        { x: 0, y: 0, w: 200, h: 200, r: 0 },
        uow
      );
    });

    expect(edge.end.position).toEqual({ x: 200, y: 200 });
    expect(edge.waypoints[0]?.point).toEqual({ x: 50, y: 50 });
    expect(edge.waypoints[0]?.controlPoints).toEqual({
      cp1: { x: -10, y: 10 },
      cp2: { x: 20, y: -20 }
    });
  });

  test('rotates a free-free edge', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const edge = layer.addEdge();

    UnitOfWork.execute(diagram, uow => {
      edge.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow);
      edge.setEnd(new FreeEndpoint({ x: 100, y: 100 }), uow);
      edge.addWaypoint({ point: { x: 0, y: 100 } }, uow);
    });

    UnitOfWork.execute(diagram, uow => {
      applyEdgeTransform(
        edge,
        { x: 0, y: 0, w: 100, h: 100, r: 0 },
        { x: 0, y: 0, w: 100, h: 100, r: Math.PI / 2 },
        uow
      );
    });

    expect(edge.start.position.x).toBeCloseTo(100);
    expect(edge.start.position.y).toBeCloseTo(0);
    expect(edge.end.position.x).toBeCloseTo(0);
    expect(edge.end.position.y).toBeCloseTo(100);
    expect(edge.waypoints[0]?.point.x).toBeCloseTo(0);
    expect(edge.waypoints[0]?.point.y).toBeCloseTo(0);
  });

  test('keeps an attached endpoint fixed while transforming the free geometry', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ bounds: { x: 50, y: 50, w: 20, h: 20, r: 0 } });
    const edge = layer.addEdge();

    UnitOfWork.execute(diagram, uow => {
      edge.setStart(new AnchorEndpoint(node, 'c'), uow);
      edge.setEnd(new FreeEndpoint({ x: 150, y: 100 }), uow);
      edge.addWaypoint({ point: { x: 100, y: 80 } }, uow);
    });

    const fixedPosition = edge.start.position;
    const before = getEdgeTransformBounds(edge);
    expect(before).toBeDefined();

    UnitOfWork.execute(diagram, uow => {
      applyEdgeTransform(edge, before!, { ...before!, w: before!.w * 2, h: before!.h * 2 }, uow);
    });

    expect(edge.start.position).toEqual(fixedPosition);
    expect(edge.end.position).toEqual({ x: 240, y: 140 });
    expect(edge.waypoints[0]?.point).toEqual({ x: 140, y: 100 });
  });

  test('reports transformability only when at least one endpoint is free', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const start = layer.addNode({ id: 'start' });
    const end = layer.addNode({ id: 'end', bounds: { x: 100, y: 0, w: 10, h: 10, r: 0 } });
    const edge = layer.addEdge();

    UnitOfWork.execute(diagram, uow => {
      edge.setStart(new AnchorEndpoint(start, 'c'), uow);
      edge.setEnd(new AnchorEndpoint(end, 'c'), uow);
    });

    expect(canTransformEdge(edge)).toBe(false);
    expect(getEdgeTransformBounds(edge)).toBeUndefined();
  });

  test('supports undo and redo for free edge transforms', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const edge = layer.addEdge();

    UnitOfWork.execute(diagram, uow => {
      edge.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow);
      edge.setEnd(new FreeEndpoint({ x: 100, y: 100 }), uow);
    });

    UnitOfWork.executeWithUndo(diagram, 'Transform edge', uow => {
      applyEdgeTransform(
        edge,
        { x: 0, y: 0, w: 100, h: 100, r: 0 },
        { x: 10, y: 20, w: 100, h: 100, r: 0 },
        uow
      );
    });

    expect(edge.start.position).toEqual({ x: 10, y: 20 });
    diagram.undoManager.undo();
    expect(edge.start.position).toEqual({ x: 0, y: 0 });
    diagram.undoManager.redo();
    expect(edge.start.position).toEqual({ x: 10, y: 20 });
  });

  test('reapplying an absolute edge angle returns to the same geometry', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const edge = layer.addEdge();

    UnitOfWork.execute(diagram, uow => {
      edge.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow);
      edge.setEnd(new FreeEndpoint({ x: 100, y: 0 }), uow);
      edge.addWaypoint({ point: { x: 50, y: 20 } }, uow);
    });

    const rotateTo = (degrees: number) => {
      const bounds = getEdgeTransformBounds(edge)!;
      const before = { ...bounds, r: getEdgeRotation(edge) };
      const after = { ...bounds, r: Angle.toRad(degrees) };
      UnitOfWork.execute(diagram, uow => {
        applyEdgeTransform(edge, before, after, uow);
      });
    };

    rotateTo(10);
    const firstTen = {
      start: edge.start.position,
      end: edge.end.position,
      waypoint: edge.waypoints[0]!.point
    };

    rotateTo(20);
    rotateTo(10);

    expect(Point.isEqual(edge.start.position, firstTen.start)).toBe(true);
    expect(Point.isEqual(edge.end.position, firstTen.end)).toBe(true);
    expect(Point.isEqual(edge.waypoints[0]!.point, firstTen.waypoint)).toBe(true);
  });
});
