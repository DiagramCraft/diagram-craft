import { ActionMapFactory, State } from '../keyMap.ts';
import { Diagram } from '@diagram-craft/model';
import { UnitOfWork } from '@diagram-craft/model';
import { commitWithUndo } from '@diagram-craft/model';
import { AbstractAction, Action, ActionContext } from '../action.ts';

declare global {
  interface ActionMap {
    WAYPOINT_ADD: WaypointAddAction;
  }
}

export const waypointAddActions: ActionMapFactory = (state: State) => ({
  WAYPOINT_ADD: new WaypointAddAction(state.diagram)
});

export class WaypointAddAction extends AbstractAction implements Action {
  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(context: ActionContext): void {
    const edge = this.diagram.edgeLookup.get(context.id!);

    const uow = new UnitOfWork(this.diagram, true);
    edge!.addWaypoint({ point: context.point! }, uow);

    commitWithUndo(uow, 'Add waypoint');
  }
}
