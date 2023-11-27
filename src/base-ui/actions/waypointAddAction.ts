import { Action, ActionContext, ActionEvents } from '../keyMap.ts';
import { Diagram, Waypoint } from '../../model-viewer/diagram.ts';
import { EventEmitter } from '../../utils/event.ts';
import { precondition } from '../../utils/assert.ts';
import { buildEdgePath } from '../edgePathBuilder.ts';
import { Point } from '../../geometry/point.ts';

declare global {
  interface ActionMap {
    WAYPOINT_ADD: WaypointAddAction;
  }
}

const steps = 1000;

export class WaypointAddAction extends EventEmitter<ActionEvents> implements Action {
  enabled = true;

  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(context: ActionContext): void {
    const edge = this.diagram.edgeLookup[context.id!];
    precondition.is.present(edge);

    const path = buildEdgePath(edge);

    const totalLength = path.length();

    const waypointDistances = (edge.waypoints ?? []).map(() => ({ d: Number.MAX_VALUE, l: -1 }));

    let bestLength = 0;
    let bestDistance = Number.MAX_VALUE;
    for (let i = 0; i < steps; i++) {
      const at = path.pointAtLength((totalLength * i) / steps);

      const distanceToClick = Point.distance(at, context.point!);
      if (distanceToClick < bestDistance) {
        bestDistance = distanceToClick;
        bestLength = i / steps;
      }

      for (let j = 0; j < waypointDistances.length; j++) {
        const distanceToWaypoint = Point.distance(at, edge.waypoints![j]!.point);
        if (distanceToWaypoint < waypointDistances[j].d) {
          waypointDistances[j].d = distanceToWaypoint;
          waypointDistances[j].l = i / steps;
        }
      }
    }

    const newWaypoints: Waypoint[] = [];

    let inserted = false;
    for (let j = 0; j < waypointDistances.length; j++) {
      if (waypointDistances[j].l > bestLength) {
        newWaypoints.push({ point: context.point! });
        newWaypoints.push(...edge.waypoints!.slice(j));
        inserted = true;
        break;
      } else {
        newWaypoints.push(edge.waypoints![j]!);
      }
    }

    if (!inserted) {
      newWaypoints.push({ point: context.point! });
    }

    edge.waypoints = newWaypoints;
    this.diagram.updateElement(edge);
  }
}
