import { AbstractTool } from '../tool';
import { Context } from '../context';
import { DragDopManager, DragEvents, Modifiers } from '../dragDropManager';
import { MarqueeDrag } from '../drag/marqueeDrag';
import { MoveDrag } from '../drag/moveDrag';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { Diagram } from '@diagram-craft/model/diagram';
import { getAncestors, isNode } from '@diagram-craft/model/diagramElement';
import { assert, mustExist } from '@diagram-craft/utils/assert';
import { LayerCapabilities } from '@diagram-craft/model/diagramLayerManager';

type DeferredMouseAction = {
  callback: () => void;
};

export class MoveTool extends AbstractTool {
  private deferredMouseAction: DeferredMouseAction | undefined;

  constructor(
    diagram: Diagram,
    drag: DragDopManager,
    svg: SVGSVGElement | null,
    context: Context,
    resetTool: () => void
  ) {
    super('move', diagram, drag, svg, context, resetTool);
    if (this.svg) this.svg.style.cursor = 'default';

    context.help.set('Select elements. Shift+click - add');
  }

  onMouseOver(id: string, point: Point, target: EventTarget) {
    super.onMouseOver(id, point, target);
    this.drag.current()?.onDragEnter?.(new DragEvents.DragEnter(point, target, id));
  }

  onMouseOut(id: string, _point: Point, target: EventTarget) {
    super.onMouseOut(id, _point, target);
    this.drag.current()?.onDragLeave?.(new DragEvents.DragLeave(target, id));
  }

  onMouseDown(id: string, point: Point, modifiers: Modifiers) {
    const selection = this.diagram.selection;

    const isClickOnBackground = id === AbstractTool.BACKGROUND;

    const isClickOnSelection = Box.contains(
      selection.bounds,
      this.diagram.viewBox.toDiagramPoint(point)
    );

    if (isClickOnSelection && !isClickOnBackground) {
      let element = mustExist(this.diagram.lookup(id));

      // If we click on an element that is part of a group, select the group instead
      // ... except, when the group is already selected, in which case we allow for "drill-down"
      const path = getAncestors(element);
      for (let i = 0; i < path.length; i++) {
        const parent = path[i]!;

        // While children.select-parent select parent
        if (isNode(parent) && parent.getDefinition().getFlag('children.select-parent')) {
          // If a parent is already selected, we select the immediate children
          if (selection.nodes.includes(parent)) {
            break;
          }

          element = parent;
        } else {
          break;
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
        new MarqueeDrag(this.diagram, this.diagram.viewBox.toDiagramPoint(point), this.context)
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
      const path = getAncestors(element);
      for (let i = 0; i < path.length; i++) {
        const parent = path[i]!;

        // While children.select-parent select parent
        if (isNode(parent) && parent.getDefinition().getFlag('children.select-parent')) {
          // If a parent is already selected, we select the immediate children
          if (selection.nodes.includes(parent)) {
            break;
          }

          element = parent;
        } else {
          break;
        }
      }

      selection.toggle(element);
    }

    const isMoveable = selection.nodes.every(p => p.renderProps.capabilities.movable !== false);
    if (!selection.isEmpty() && isMoveable && LayerCapabilities.canMove(this.diagram.activeLayer)) {
      this.drag.initiate(
        new MoveDrag(
          this.diagram,
          Point.subtract(this.diagram.viewBox.toDiagramPoint(point), selection.bounds),
          modifiers,
          this.context
        )
      );
    }
  }

  onMouseUp(_point: Point, _modifiers: Modifiers, target: EventTarget) {
    const current = this.drag.current();
    try {
      current?.onDragEnd(new DragEvents.DragEnd(target));
      this.deferredMouseAction?.callback();
    } finally {
      this.drag.clear();
      this.deferredMouseAction = undefined;
    }
  }

  onMouseMove(point: Point, modifiers: Modifiers, target: EventTarget) {
    const current = this.drag.current();
    try {
      current?.onDrag(
        new DragEvents.DragStart(this.diagram.viewBox.toDiagramPoint(point), modifiers, target)
      );
    } finally {
      this.deferredMouseAction = undefined;
    }
  }

  onKeyDown(e: KeyboardEvent) {
    const current = this.drag.current();
    if (current) {
      current.onKeyDown?.(e);
    } else if (e.key === 'Escape') {
      this.diagram.selection.clear();
    } else if (
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      this.diagram.selection.isNodesOnly() &&
      this.diagram.selection.nodes.length === 1 &&
      e.target === document.body &&
      e.key !== 'Shift'
    ) {
      const node = this.diagram.selection.nodes[0]!;
      node.getDefinition().requestFocus(node, false);
    }
  }

  onKeyUp(e: KeyboardEvent) {
    const current = this.drag.current();
    if (current) current.onKeyUp?.(e);
  }
}
