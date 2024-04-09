import { AbstractDrag } from './dragDropManager.ts';
import { Diagram } from '../../model/diagram.ts';
import { SelectionState } from '../../model/selectionState.ts';
import { precondition } from '@diagram-craft/utils';
import { DiagramElement } from '../../model/diagramElement.ts';
import { Box, Point } from '@diagram-craft/geometry';

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
