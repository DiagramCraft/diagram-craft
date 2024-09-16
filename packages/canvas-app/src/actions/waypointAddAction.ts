import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { Point } from '@diagram-craft/geometry/point';

declare global {
  interface ActionMap extends ReturnType<typeof waypointAddActions> {}
}

export const waypointAddActions = (context: ActionContext) => ({
  WAYPOINT_ADD: new WaypointAddAction(context)
});

type WaypointAddActionArg = { id?: string; point?: Point };

export class WaypointAddAction extends AbstractAction<WaypointAddActionArg> {
  constructor(context: ActionContext) {
    super(context);
  }

  execute(context: WaypointAddActionArg): void {
    const edge = this.context.model.activeDiagram.edgeLookup.get(context.id!);

    const uow = new UnitOfWork(this.context.model.activeDiagram, true);
    edge!.addWaypoint({ point: context.point! }, uow);

    commitWithUndo(uow, 'Add waypoint');
  }
}
