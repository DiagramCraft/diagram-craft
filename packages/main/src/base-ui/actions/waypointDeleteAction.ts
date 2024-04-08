import { ActionMapFactory, State } from '../keyMap.ts';
import { Diagram } from '../../model/diagram.ts';
import { precondition } from '@diagram-craft/utils';
import { PointOnPath } from '../../geometry/pathPosition.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { commitWithUndo } from '../../model/diagramUndoActions.ts';
import { AbstractAction, ActionContext } from '../action.ts';
import { smallest } from '@diagram-craft/utils';

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
