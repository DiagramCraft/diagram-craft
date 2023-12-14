import { precondition } from '../utils/assert.ts';
import { Box } from '../geometry/box.ts';
import { Drag } from '../base-ui/drag.ts';
import { Point } from '../geometry/point.ts';
import { SelectionState } from '../model-editor/selectionState.ts';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { Diagram } from '../model-viewer/diagram.ts';
import { DiagramNode } from '../model-viewer/diagramNode.ts';
import { DiagramEdge } from '../model-viewer/diagramEdge.ts';

export class MarqueeDrag implements Drag {
  constructor(
    private readonly diagram: EditableDiagram,
    private readonly offset: Point
  ) {}

  onDrag(coord: Point) {
    this.diagram.selectionState.marquee.bounds = Box.normalize({
      pos: this.offset,
      size: { w: coord.x - this.offset.x, h: coord.y - this.offset.y },
      rotation: 0
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

    const pending: (DiagramNode | DiagramEdge)[] = [];
    for (const e of diagram.visibleElements()) {
      if (Box.contains(selection.marquee.bounds, e.bounds)) {
        pending.push(e);
      }
    }
    selection.marquee.pendingElements = pending;
  }
}
