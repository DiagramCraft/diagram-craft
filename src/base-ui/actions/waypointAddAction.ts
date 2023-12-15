import { Action, ActionContext, ActionEvents } from '../keyMap.ts';
import { Diagram } from '../../model/diagram.ts';
import { EventEmitter } from '../../utils/event.ts';
import { precondition } from '../../utils/assert.ts';
import { buildEdgePath } from '../edgePathBuilder.ts';
import { PointOnPath } from '../../geometry/pathPosition.ts';

declare global {
  interface ActionMap {
    WAYPOINT_ADD: WaypointAddAction;
  }
}

export class WaypointAddAction extends EventEmitter<ActionEvents> implements Action {
  enabled = true;

  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(context: ActionContext): void {
    precondition.is.present(context.point);

    const edge = this.diagram.edgeLookup[context.id!];
    precondition.is.present(edge);

    const path = buildEdgePath(edge);
    const projection = path.projectPoint(context.point);

    const wpDistances =
      edge.waypoints?.map(p => {
        return {
          pathD: PointOnPath.toTimeOffset({ point: p.point }, path).pathD,
          ...p
        };
      }) ?? [];

    edge.waypoints = [...wpDistances, { ...projection, pathD: projection.pathD }].sort(
      (a, b) => a.pathD - b.pathD
    );
    /*
    if (edge.props.type === 'bezier') {
      const [before, after] = path.split(projection);
      for (let i = 0; i < edge.waypoints.length; i++) {}
    }
    */

    this.diagram.updateElement(edge);
  }
}
