import { MutableRefObject, RefObject } from 'react';
import { Point } from '../../geometry/point.ts';
import { Box } from '../../geometry/box.ts';
import { DragDopManager, Modifiers } from '../../base-ui/drag/dragDropManager.ts';
import { MarqueeDrag } from '../SelectionMarquee.logic.tsx';
import { MoveDrag } from '../../base-ui/drag/moveDrag.ts';
import { BACKGROUND, DeferedMouseAction, ObjectId } from './types.ts';
import { AbstractTool } from './abstractTool.ts';
import { Diagram } from '../../model/diagram.ts';

export class MoveTool extends AbstractTool {
  constructor(
    protected readonly diagram: Diagram,
    protected readonly drag: DragDopManager,
    protected readonly svgRef: RefObject<SVGSVGElement>,
    protected readonly deferedMouseAction: MutableRefObject<DeferedMouseAction | undefined>,
    protected readonly resetTool: () => void
  ) {
    super(diagram, drag, svgRef, deferedMouseAction, resetTool);
  }

  // TODO: Updating the cursor is not really working
  updateCursor(coord: Point) {
    const selection = this.diagram.selectionState;
    if (Box.contains(selection.bounds, coord)) {
      this.svgRef.current!.style.cursor = 'move';
    } else {
      this.svgRef.current!.style.cursor = 'default';
    }
  }

  onMouseDown(id: ObjectId, point: Point, modifiers: Modifiers) {
    const selection = this.diagram.selectionState;

    const isClickOnBackground = id === BACKGROUND;

    const isClickOnSelection = Box.contains(
      selection.bounds,
      this.diagram.viewBox.toDiagramPoint(point)
    );

    try {
      if (isClickOnSelection) {
        this.deferedMouseAction.current = {
          callback: () => {
            selection.clear();
            if (!isClickOnBackground) {
              selection.toggle(this.diagram.nodeLookup[id] ?? this.diagram.edgeLookup[id]);
            }
          }
        };
      } else if (isClickOnBackground) {
        if (!modifiers.shiftKey) {
          selection.clear();
        }
        this.drag.initiate(
          new MarqueeDrag(this.diagram, this.diagram.viewBox.toDiagramPoint(point))
        );
        return;
      } else {
        if (!modifiers.shiftKey) {
          selection.clear();
        }
        selection.toggle(this.diagram.nodeLookup[id] ?? this.diagram.edgeLookup[id]);
      }

      if (!selection.isEmpty()) {
        this.drag.initiate(
          new MoveDrag(
            this.diagram,
            Point.subtract(this.diagram.viewBox.toDiagramPoint(point), selection.bounds.pos)
          )
        );
      }
    } finally {
      this.updateCursor(this.diagram.viewBox.toDiagramPoint(point));
    }
  }

  onMouseUp(point: Point) {
    const current = this.drag.current();
    try {
      if (current) {
        current.onDragEnd();
      }

      if (this.deferedMouseAction.current) {
        this.deferedMouseAction.current?.callback();
      }
    } finally {
      this.drag.clear();
      this.deferedMouseAction.current = undefined;

      this.updateCursor(point);
    }
  }

  onMouseMove(point: Point, modifiers: Modifiers) {
    const current = this.drag.current();

    try {
      // Abort early in case there's no drag in progress
      if (!current) return;

      current.onDrag(this.diagram.viewBox.toDiagramPoint(point), modifiers);
    } finally {
      this.deferedMouseAction.current = undefined;
      this.updateCursor(this.diagram.viewBox.toDiagramPoint(point));
    }
  }
}
