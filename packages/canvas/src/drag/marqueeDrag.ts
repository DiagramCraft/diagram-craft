import { AbstractDrag } from '../dragDropManager';
import { Diagram } from '@diagram-craft/model';
import { SelectionState } from '@diagram-craft/model';
import { precondition } from '@diagram-craft/utils';
import { DiagramElement } from '@diagram-craft/model';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';

export class MarqueeDrag extends AbstractDrag {
  constructor(
    private readonly diagram: Diagram,
    private readonly offset: Point
  ) {
    super();
  }

  onDrag(coord: Point) {
    this.diagram.selectionState.marquee.bounds = Box.normalize({
      ...this.offset,
      w: coord.x - this.offset.x,
      h: coord.y - this.offset.y,
      r: 0
    });

    this.updatePendingElements(this.diagram.selectionState, this.diagram);
  }

  onDragEnd(): void {
    if (this.diagram.selectionState.marquee.pendingElements) {
      this.diagram.selectionState.marquee.commitSelection();
    }
  }

  private updatePendingElements(selection: SelectionState, diagram: Diagram) {
    precondition.is.present(selection.marquee);

    const pending: DiagramElement[] = [];
    for (const e of diagram.visibleElements()) {
      if (e.isLocked()) continue;
      if (Box.contains(selection.marquee.bounds, e.bounds)) {
        pending.push(e);
      }
    }
    selection.marquee.pendingElements = pending;
  }
}
