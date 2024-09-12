import { ActionMapFactory, ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import { PointOnPath } from '@diagram-craft/geometry/pathPosition';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { precondition } from '@diagram-craft/utils/assert';
import { smallest } from '@diagram-craft/utils/array';

declare global {
  interface ActionMap {
    WAYPOINT_DELETE: WaypointDeleteAction;
  }
}

export const waypointDeleteActions: ActionMapFactory = (state: ActionConstructionParameters) => ({
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

    // Find the waypoint that is closest to the point which was originally clicked
    const closestWaypointIndex = smallest(
      wpDistances.map(wp => ({ ...wp, d: Math.abs(projection.pathD - wp.pathD) })),
      (a, b) => a.d - b.d
    )!.idx;

    const uow = new UnitOfWork(this.diagram, true);
    edge.removeWaypoint(edge.waypoints[closestWaypointIndex], uow);

    commitWithUndo(uow, 'Delete waypoint');
  }
}
