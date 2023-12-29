import { MutableRefObject, RefObject } from 'react';
import { Point } from '../../geometry/point.ts';
import { Box } from '../../geometry/box.ts';
import { DragDopManager, Modifiers } from '../../base-ui/drag/dragDropManager.ts';
import { MoveDrag } from '../../base-ui/drag/moveDrag.ts';
import { BACKGROUND, DeferedMouseAction, ObjectId } from './types.ts';
import { AbstractTool } from './abstractTool.ts';
import { Diagram } from '../../model/diagram.ts';
import { MarqueeDrag } from '../../base-ui/drag/marqueeDrag.ts';
import { getDiagramElementPath } from '../../model/diagramElement.ts';

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
        let element = this.diagram.lookup(id)!;

        // If we click on an element that is part of a group, select the group instead
        // ... except, when the group is already selected, in which case we allow for "drill-down"
        if (element) {
          const path = getDiagramElementPath(element);
          if (path.length > 0) {
            for (let i = 0; i < path.length; i++) {
              const parent = path[i];
              if (selection.nodes.includes(parent)) {
                break;
              } else {
                element = parent;
              }
            }
          }
        }

        this.deferedMouseAction.current = {
          callback: () => {
            if (!modifiers.shiftKey) selection.clear();
            if (!isClickOnBackground) {
              selection.toggle(element);
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

        let element = this.diagram.lookup(id)!;

        // Ensure you cannot select an additional node if you already have a group selected
        const parents = selection.nodes.map(n => n.parent);
        if (parents.length > 0 && parents[0] !== element.parent) {
          selection.clear();
        }

        // If we click on an element that is part of a group, select the group instead
        // ... except, when the group is already selected, in which case we allow for "drill-down"
        const path = getDiagramElementPath(element);
        if (path.length > 0) {
          for (let i = 0; i < path.length; i++) {
            const parent = path[i];
            if (selection.nodes.includes(parent)) {
              selection.toggle(parent);
              break;
            } else {
              element = parent;
            }
          }
        }

        selection.toggle(element);
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
