import { AbstractDrag, Modifiers } from '../../../base-ui/drag/dragDropManager.ts';
import { Point } from '../../../geometry/point.ts';
import { EditablePath } from './editablePath.ts';

export class NodeDrag extends AbstractDrag {
  private startTime: number;
  private lastPoint: Point | undefined;

  constructor(
    private readonly editablePath: EditablePath,
    private readonly waypointIdx: number,
    private readonly startPoint: Point
  ) {
    super();
    this.startTime = new Date().getTime();
  }

  onDrag(coord: Point, _modifiers: Modifiers) {
    this.lastPoint = coord;
    this.editablePath.updateWaypoint(this.waypointIdx, {
      point: this.editablePath.toLocalCoordinate(coord)
    });
    this.editablePath.commit();
  }

  onDragEnd(): void {
    // Abort drag if too short and if the drag was too small
    if (
      this.lastPoint === undefined ||
      (new Date().getTime() - this.startTime < 200 &&
        Point.distance(this.lastPoint, this.startPoint) < 5)
    ) {
      return;
    }

    this.editablePath.commit();
  }
}
