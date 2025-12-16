import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import { PointOnPath } from '@diagram-craft/geometry/pathPosition';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { precondition } from '@diagram-craft/utils/assert';
import { smallest } from '@diagram-craft/utils/array';
import { Point } from '@diagram-craft/geometry/point';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof waypointDeleteActions> {}
  }
}

export const waypointDeleteActions = (context: ActionContext) => ({
  WAYPOINT_DELETE: new WaypointDeleteAction(context)
});

type WaypointDeleteActionArg = {
  id?: string;
  point?: Point;
};

export class WaypointDeleteAction extends AbstractAction<WaypointDeleteActionArg> {
  name = 'Delete waypoint';

  execute(context: WaypointDeleteActionArg): void {
    precondition.is.present(context.point);

    const edge = this.context.model.activeDiagram.edgeLookup.get(context.id!);
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

    const uow = new UnitOfWork(this.context.model.activeDiagram, true);
    edge.removeWaypoint(edge.waypoints[closestWaypointIndex]!, uow);

    commitWithUndo(uow, 'Delete waypoint');
  }
}
