import { AbstractTool, BACKGROUND } from '../tool';
import { ApplicationTriggers } from '../ApplicationTriggers';
import { DragDopManager, Modifiers } from '../dragDropManager';
import { MarqueeDrag } from '../drag/marqueeDrag';
import { MoveDrag } from '../drag/moveDrag';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { Diagram } from '@diagram-craft/model/diagram';
import { getDiagramElementPath } from '@diagram-craft/model/diagramElement';
import { assert } from '@diagram-craft/utils/assert';

type DeferredMouseAction = {
  callback: () => void;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Extensions {
    interface Tools {
      move: MoveTool;
    }
  }
}

export class MoveTool extends AbstractTool {
  private deferredMouseAction: DeferredMouseAction | undefined;

  constructor(
    protected readonly diagram: Diagram,
    protected readonly drag: DragDopManager,
    protected readonly svg: SVGSVGElement | null,
    protected readonly applicationTriggers: ApplicationTriggers,
    protected readonly resetTool: () => void
  ) {
    super('move', diagram, drag, svg, applicationTriggers, resetTool);
    if (this.svg) this.svg.style.cursor = 'default';

    applicationTriggers.setHelp?.('Select elements. Shift+click - add');
  }

  onMouseOver(id: string, _point: Point) {
    this.drag.current()?.onDragEnter?.(id);
  }

  onMouseOut(id: string, _point: Point) {
    this.drag.current()?.onDragLeave?.(id);
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
            if (parent.getDefinition().supports('select')) {
              if (selection.nodes.includes(parent)) {
                break;
              } else {
                element = parent;
              }
            }
          }
        }
      }

      this.deferredMouseAction = {
        callback: () => {
          if (!modifiers.shiftKey) selection.clear();
          if (!isClickOnBackground && element) {
            selection.toggle(element);
          }
        }
      };
    } else if (isClickOnBackground) {
      if (!modifiers.shiftKey) selection.clear();
      this.drag.initiate(
        new MarqueeDrag(
          this.diagram,
          this.diagram.viewBox.toDiagramPoint(point),
          this.applicationTriggers
        )
      );
      return;
    } else {
      if (!modifiers.shiftKey) selection.clear();

      let element = this.diagram.lookup(id)!;
      assert.present(element);

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
          if (parent.getDefinition().supports('select')) {
            if (selection.nodes.includes(parent)) {
              selection.toggle(parent);
              break;
            } else {
              element = parent;
            }
          }
        }
      }

      selection.toggle(element);
    }

    const isMoveable = selection.nodes.every(p => p.renderProps.capabilities.movable !== false);
    if (!selection.isEmpty() && isMoveable) {
      this.drag.initiate(
        new MoveDrag(
          this.diagram,
          Point.subtract(this.diagram.viewBox.toDiagramPoint(point), selection.bounds),
          modifiers,
          this.applicationTriggers
        )
      );
    }
  }

  onMouseUp(_point: Point) {
    const current = this.drag.current();
    try {
      current?.onDragEnd();
      this.deferredMouseAction?.callback();
    } finally {
      this.drag.clear();
      this.deferredMouseAction = undefined;
    }
  }

  onMouseMove(point: Point, modifiers: Modifiers) {
    const current = this.drag.current();
    try {
      current?.onDrag(this.diagram.viewBox.toDiagramPoint(point), modifiers);
    } finally {
      this.deferredMouseAction = undefined;
    }
  }

  onKeyDown(e: KeyboardEvent) {
    const current = this.drag.current();
    if (current) {
      current.onKeyDown?.(e);
    } else if (e.key === 'Escape') {
      this.diagram.selectionState.clear();
    } else if (
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      this.diagram.selectionState.isNodesOnly() &&
      this.diagram.selectionState.nodes.length === 1 &&
      e.target === document.body &&
      e.key !== 'Shift'
    ) {
      const node = this.diagram.selectionState.nodes[0];
      node.getDefinition().requestFocus(node, false);
    }
  }

  onKeyUp(e: KeyboardEvent) {
    const current = this.drag.current();
    if (current) current.onKeyUp?.(e);
  }
}
