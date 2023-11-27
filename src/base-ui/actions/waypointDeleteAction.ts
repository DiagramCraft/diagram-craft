import { Action, ActionContext, ActionEvents } from '../keyMap.ts';
import { Diagram } from '../../model-viewer/diagram.ts';
import { EventEmitter } from '../../utils/event.ts';
import { precondition } from '../../utils/assert.ts';
import { buildEdgePath } from '../edgePathBuilder.ts';
import { Point } from '../../geometry/point.ts';

declare global {
  interface ActionMap {
    WAYPOINT_DELETE: WaypointDeleteAction;
  }
}

const steps = 1000;

export class WaypointDeleteAction extends EventEmitter<ActionEvents> implements Action {
  enabled = true;

  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(context: ActionContext): void {
    const edge = this.diagram.edgeLookup[context.id!];
    precondition.is.present(edge);

    const path = buildEdgePath(edge);

    const totalLength = path.length();

    const waypointDistances = (edge.waypoints ?? []).map((_, idx) => ({
      d: Number.MAX_VALUE,
      l: -1,
      idx
    }));

    // TODO: We can probably extract this to a waypointHelper object
    for (let i = 0; i < steps; i++) {
      const at = path.pointAtLength((totalLength * i) / steps);

      for (let j = 0; j < waypointDistances.length; j++) {
        const distanceToWaypoint = Point.distance(at, edge.waypoints![j]!.point);
        if (distanceToWaypoint < waypointDistances[j].d) {
          waypointDistances[j].d = distanceToWaypoint;
          waypointDistances[j].l = i / steps;
        }
      }
    }

    waypointDistances.sort((a, b) => a.d - b.d);

    edge.waypoints = edge.waypoints!.filter((_, idx) => idx !== waypointDistances[0].idx);
    this.diagram.updateElement(edge);
  }
}
