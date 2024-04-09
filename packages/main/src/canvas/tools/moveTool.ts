import { MutableRefObject, RefObject } from 'react';
import { DragDopManager, Modifiers } from '../../base-ui/drag/dragDropManager.ts';
import { MoveDrag } from '../../base-ui/drag/moveDrag.ts';
import { BACKGROUND, DeferedMouseAction } from './types.ts';
import { AbstractTool } from './abstractTool.ts';
import { Diagram } from '@diagram-craft/model';
import { MarqueeDrag } from '../../base-ui/drag/marqueeDrag.ts';
import { getDiagramElementPath } from '@diagram-craft/model';
import { ApplicationTriggers } from '../EditableCanvas.ts';
import { Box, Point } from '@diagram-craft/geometry';

export class MoveTool extends AbstractTool {
  constructor(
    protected readonly diagram: Diagram,
    protected readonly drag: DragDopManager,
    protected readonly svgRef: RefObject<SVGSVGElement>,
    protected readonly deferedMouseAction: MutableRefObject<DeferedMouseAction | undefined>,
    protected readonly applicationTriggers: ApplicationTriggers,
    protected readonly resetTool: () => void
  ) {
    super('move', diagram, drag, svgRef, deferedMouseAction, applicationTriggers, resetTool);
    if (this.svgRef.current) this.svgRef.current!.style.cursor = 'default';
  }

  onMouseOver(id: string, _point: Point) {
    this.drag.current()?.onDragEnter?.(id);
  }

  onMouseOut(_id: string, _point: Point) {
    this.drag.current()?.onDragLeave?.();
  }

  onMouseDown(id: string, point: Point, modifiers: Modifiers) {
    const selection = this.diagram.selectionState;

    const isClickOnBackground = id === BACKGROUND;

    const isClickOnSelection = Box.contains(
      selection.bounds,
      this.diagram.viewBox.toDiagramPoint(point)
    );

    if (isClickOnSelection) {
      let element = this.diagram.lookup(id);

      // If we click on an element that is part of a group, select the group instead
      // ... except, when the group is already selected, in which case we allow for "drill-down"
      // TODO: Is this if-statement really needed - it seems it is better to check isClickOnBackground
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
          if (!isClickOnBackground && element) {
            selection.toggle(element);
          }
        }
      };
    } else if (isClickOnBackground) {
      if (!modifiers.shiftKey) selection.clear();
      this.drag.initiate(new MarqueeDrag(this.diagram, this.diagram.viewBox.toDiagramPoint(point)));
      return;
    } else {
      if (!modifiers.shiftKey) selection.clear();

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
          Point.subtract(this.diagram.viewBox.toDiagramPoint(point), selection.bounds),
          modifiers
        )
      );
    }
  }

  onMouseUp(_point: Point) {
    const current = this.drag.current();
    try {
      current?.onDragEnd();
      this.deferedMouseAction.current?.callback();
    } finally {
      this.drag.clear();
      this.deferedMouseAction.current = undefined;
    }
  }

  onMouseMove(point: Point, modifiers: Modifiers) {
    const current = this.drag.current();
    try {
      current?.onDrag(this.diagram.viewBox.toDiagramPoint(point), modifiers);
    } finally {
      this.deferedMouseAction.current = undefined;
    }
  }

  onKeyDown(e: KeyboardEvent) {
    const current = this.drag.current();
    current?.onKeyDown?.(e);
  }

  onKeyUp(e: KeyboardEvent) {
    const current = this.drag.current();
    current?.onKeyUp?.(e);
  }
}
