import { ActionMapFactory, State } from '../keyMap.ts';
import { Diagram } from '@diagram-craft/model';
import { precondition } from '@diagram-craft/utils';
import { UnitOfWork } from '@diagram-craft/model';
import { commitWithUndo } from '@diagram-craft/model';
import { AbstractAction, ActionContext } from '../action.ts';
import { smallest } from '@diagram-craft/utils';
import { PointOnPath } from '@diagram-craft/geometry';

declare global {
  interface ActionMap {
    WAYPOINT_DELETE: WaypointDeleteAction;
  }
}

export const waypointDeleteActions: ActionMapFactory = (state: State) => ({
  WAYPOINT_DELETE: new WaypointDeleteAction(state.diagram)
});

export class WaypointDeleteAction extends AbstractAction {
  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(context: ActionContext): void {
    precondition.is.present(context.point);

    const edge = this.diagram.edgeLookup.get(context.id!);
    precondition.is.present(edge);

    const path = edge.path();

    const wpDistances = edge.waypoints.map((p, idx) => {
      return {
        pathD: PointOnPath.toTimeOffset({ point: p.point }, path).pathD,
        idx
      };
    });

    const projection = path.projectPoint(context.point);

    const closestWaypointIndex = smallest(
      wpDistances.map(wp => ({ ...wp, d: Math.abs(projection.pathD - wp.pathD) })),
      (a, b) => a.d - b.d
    )!.idx;

    const uow = new UnitOfWork(this.diagram, true);
    edge.removeWaypoint(edge.waypoints[closestWaypointIndex], uow);

    commitWithUndo(uow, 'Delete waypoint');
  }
}
