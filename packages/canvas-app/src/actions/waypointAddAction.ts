import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { AbstractAction } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { Point } from '@diagram-craft/geometry/point';

declare global {
  interface ActionMap extends ReturnType<typeof waypointAddActions> {}
}

export const waypointAddActions = (state: ActionConstructionParameters) => ({
  WAYPOINT_ADD: new WaypointAddAction(state.diagram)
});

type WaypointAddActionArg = { id?: string; point?: Point };

export class WaypointAddAction extends AbstractAction<WaypointAddActionArg> {
  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(context: WaypointAddActionArg): void {
    const edge = this.diagram.edgeLookup.get(context.id!);

    const uow = new UnitOfWork(this.diagram, true);
    edge!.addWaypoint({ point: context.point! }, uow);

    commitWithUndo(uow, 'Add waypoint');
  }
}
