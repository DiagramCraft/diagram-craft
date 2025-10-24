import { Drag, DragEvents } from '../dragDropManager';
import { precondition } from '@diagram-craft/utils/assert';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Context } from '../context';

export class MarqueeDrag extends Drag {
  constructor(
    private readonly diagram: Diagram,
    private readonly offset: Point,
    private readonly context: Context
  ) {
    super();
    this.context.help.push(
      'MarqueeDrag',
      'Select multiple elements by dragging a rectangle around them. Shift+drag - add.'
    );
  }

  onDrag({ offset }: DragEvents.DragStart) {
    this.context.marquee.bounds = Box.normalize({
      ...this.offset,
      w: offset.x - this.offset.x,
      h: offset.y - this.offset.y,
      r: 0
    });

    this.updatePendingElements(this.diagram);
  }

  onDragEnd(): void {
    if (this.context.marquee.pendingElements) {
      this.context.marquee.commitSelection(this.diagram.selection);
    }

    this.context.help.pop('MarqueeDrag');
  }

  private updatePendingElements(diagram: Diagram) {
    precondition.is.present(this.context.marquee);

    const pending: DiagramElement[] = [];
    for (const e of diagram.visibleElements()) {
      if (e.isLocked()) continue;
      if (Box.contains(this.context.marquee.bounds, e.bounds)) {
        pending.push(e);
      }
    }
    this.context.marquee.pendingElements = pending;
  }
}
