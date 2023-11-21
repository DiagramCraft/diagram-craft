import { Diagram, DiagramNode } from '../model-viewer/diagram.ts';
import { precondition } from '../utils/assert.ts';
import { Box } from '../geometry/box.ts';
import { Drag } from './drag.ts';
import { Point } from '../geometry/point.ts';
import { SelectionState } from '../model-editor/selectionState.ts';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';

export class MarqueeDrag implements Drag {
  constructor(private readonly offset: Point) {}

  onDrag(coord: Point, diagram: EditableDiagram) {
    diagram.selectionState.marquee = Box.normalize({
      pos: this.offset,
      size: { w: coord.x - this.offset.x, h: coord.y - this.offset.y },
      rotation: 0
    });

    this.updatePendingElements(diagram.selectionState, diagram);
  }

  onDragEnd(_coord: Point, diagram: EditableDiagram): void {
    if (diagram.selectionState.pendingElements) {
      diagram.selectionState.convertMarqueeToSelection();
    }
  }

  private updatePendingElements(selection: SelectionState, diagram: Diagram) {
    precondition.is.present(selection.marquee);

    const pending: DiagramNode[] = [];
    for (const e of diagram.elements) {
      if (e.type !== 'node') continue;

      // if (Box.intersects(selection.marquee!, e)) {
      if (Box.contains(selection.marquee, e.bounds)) {
        pending.push(e);
      }
    }
    selection.setPendingElements(pending);
  }
}
