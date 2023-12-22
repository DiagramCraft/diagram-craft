import { Action, ActionContext, ActionEvents, ActionMapFactory, State } from '../keyMap.ts';
import { Diagram } from '../../model/diagram.ts';
import { EventEmitter } from '../../utils/event.ts';
import { precondition } from '../../utils/assert.ts';
import { buildEdgePath } from '../../model/edgePathBuilder.ts';
import { PointOnPath } from '../../geometry/pathPosition.ts';
import { smallest } from '../../utils/array.ts';

declare global {
  interface ActionMap {
    WAYPOINT_DELETE: WaypointDeleteAction;
  }
}

export const waypointDeleteActions: ActionMapFactory = (state: State) => ({
  WAYPOINT_DELETE: new WaypointDeleteAction(state.diagram)
});

export class WaypointDeleteAction extends EventEmitter<ActionEvents> implements Action {
  enabled = true;

  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(context: ActionContext): void {
    precondition.is.present(context.point);

    const edge = this.diagram.edgeLookup[context.id!];
    precondition.is.present(edge);

    const path = buildEdgePath(edge, 0);

    const wpDistances =
      edge.waypoints?.map((p, idx) => {
        return {
          pathD: PointOnPath.toTimeOffset({ point: p.point }, path).pathD,
          idx
        };
      }) ?? [];

    const projection = path.projectPoint(context.point);

    const closestWaypointIndex = smallest(
      wpDistances.map(wp => ({ ...wp, d: Math.abs(projection.pathD - wp.pathD) })),
      (a, b) => a.d - b.d
    ).idx;

    edge.waypoints = edge.waypoints!.filter((_, idx) => idx !== closestWaypointIndex);
    this.diagram.updateElement(edge);
  }
}
