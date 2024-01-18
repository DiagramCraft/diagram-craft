import { Action, ActionContext, ActionEvents, ActionMapFactory, State } from '../keyMap.ts';
import { Diagram } from '../../model/diagram.ts';
import { EventEmitter } from '../../utils/event.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { SnapshotUndoableAction } from '../../model/diagramUndoActions.ts';

declare global {
  interface ActionMap {
    WAYPOINT_ADD: WaypointAddAction;
  }
}

export const waypointAddActions: ActionMapFactory = (state: State) => ({
  WAYPOINT_ADD: new WaypointAddAction(state.diagram)
});

export class WaypointAddAction extends EventEmitter<ActionEvents> implements Action {
  enabled = true;

  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(context: ActionContext): void {
    const edge = this.diagram.edgeLookup.get(context.id!);

    const uow = new UnitOfWork(this.diagram, true);
    edge!.addWaypoint({ point: context.point! }, uow);

    const snapshots = uow.commit();
    this.diagram.undoManager.add(
      new SnapshotUndoableAction('Add waypoint', this.diagram, snapshots)
    );
  }
}
