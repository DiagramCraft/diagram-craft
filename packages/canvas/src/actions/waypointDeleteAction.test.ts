import { describe, expect, test } from 'vitest';
import { WaypointDeleteAction } from './waypointDeleteAction';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import type { ActionContext } from '../action';
import type { Diagram } from '@diagram-craft/model/diagram';

const mkContext = (diagram: Diagram) =>
  ({
    model: {
      activeDiagram: diagram,
      // biome-ignore lint/suspicious/noExplicitAny: false positive
      on: (_a: any, _b: any, _c: any) => {}
    }
  }) as ActionContext;

describe('WaypointDeleteAction', () => {
  test('should return early when the edge has no waypoints', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();
    const edge = layer.addEdge();

    const action = new WaypointDeleteAction(mkContext(diagram));

    expect(() => action.execute({ id: edge.id, point: { x: 50, y: 50 } })).not.toThrow();
    expect(edge.waypoints).toHaveLength(0);
  });

  test('should remove the closest waypoint to the clicked point', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();
    const edge = layer.addEdge();

    UnitOfWork.execute(diagram, uow => {
      edge.addWaypoint({ point: { x: 25, y: 25 } }, uow);
      edge.addWaypoint({ point: { x: 75, y: 75 } }, uow);
    });

    const action = new WaypointDeleteAction(mkContext(diagram));
    action.execute({ id: edge.id, point: { x: 20, y: 20 } });

    expect(edge.waypoints).toHaveLength(1);
    expect(edge.waypoints[0]!.point).toEqual({ x: 75, y: 75 });
  });
});
