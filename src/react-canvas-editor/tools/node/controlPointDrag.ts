import { AbstractDrag, Modifiers } from '../../../base-ui/drag/dragDropManager.ts';
import { EditablePath } from './editablePath.ts';
import { Point } from '../../../geometry/point.ts';

export class ControlPointDrag extends AbstractDrag {
  constructor(
    private readonly editablePath: EditablePath,
    private readonly waypointIdx: number,
    private readonly controlPoint: 'p1' | 'p2'
  ) {
    super();
  }

  onDrag(coord: Point, modifiers: Modifiers) {
    this.editablePath.updateControlPoint(
      this.waypointIdx,
      this.controlPoint,
      this.editablePath.toLocalCoordinate(coord),
      modifiers.metaKey ? 'symmetric' : modifiers.altKey ? 'corner' : undefined
    );
    this.editablePath.commit();
  }

  onDragEnd(): void {
    this.editablePath.commit();
  }
}
