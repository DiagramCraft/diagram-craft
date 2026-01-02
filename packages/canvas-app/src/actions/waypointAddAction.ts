import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Point } from '@diagram-craft/geometry/point';
import { $tStr } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof waypointAddActions> {}
  }
}

export const waypointAddActions = (context: ActionContext) => ({
  WAYPOINT_ADD: new WaypointAddAction(context)
});

type WaypointAddActionArg = { id?: string; point?: Point };

export class WaypointAddAction extends AbstractAction<WaypointAddActionArg> {
  name = $tStr('action.WAYPOINT_ADD.name', 'Add waypoint');

  execute(context: WaypointAddActionArg): void {
    const edge = this.context.model.activeDiagram.edgeLookup.get(context.id!);

    UnitOfWork.executeWithUndo(this.context.model.activeDiagram, 'Add waypoint', uow =>
      edge!.addWaypoint({ point: context.point! }, uow)
    );
  }
}
