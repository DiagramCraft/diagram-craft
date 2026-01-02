import { AbstractSelectionAction } from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { Point } from '@diagram-craft/geometry/point';
import { Translation } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ActionContext } from '@diagram-craft/canvas/action';
import { isNode, transformElements } from '@diagram-craft/model/diagramElement';
import { $tStr } from '@diagram-craft/utils/localize';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import type { Axis } from '@diagram-craft/canvas/layout/layoutTree';
import { mustExist } from '@diagram-craft/utils/assert';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof selectionMoveActions> {}
  }
}

export const selectionMoveActions = (context: ActionContext) => {
  const $d = context.model.activeDiagram;
  const grid = () => $d.props.grid?.size ?? 10;
  return {
    SELECTION_MOVE_UP: new SelectionMoveAction(context, () => ({ x: 0, y: -1 })),
    SELECTION_MOVE_DOWN: new SelectionMoveAction(context, () => ({ x: 0, y: 1 })),
    SELECTION_MOVE_LEFT: new SelectionMoveAction(context, () => ({ x: -1, y: 0 })),
    SELECTION_MOVE_RIGHT: new SelectionMoveAction(context, () => ({ x: 1, y: 0 })),
    SELECTION_MOVE_GRID_UP: new SelectionMoveAction(context, () => ({ x: 0, y: -grid() })),
    SELECTION_MOVE_GRID_DOWN: new SelectionMoveAction(context, () => ({ x: 0, y: grid() })),
    SELECTION_MOVE_GRID_LEFT: new SelectionMoveAction(context, () => ({ x: -grid(), y: 0 })),
    SELECTION_MOVE_GRID_RIGHT: new SelectionMoveAction(context, () => ({ x: grid(), y: 0 }))
  };
};

/**
 * Action to move the current selection using arrow keys.
 *
 * Behavior depends on the context:
 * - **Container layout reordering**: When a single non-absolute node is selected within a parent
 *   that has an active container layout, and movement is along the primary axis (horizontal for
 *   horizontal layouts, vertical for vertical layouts), the node will swap positions with the
 *   adjacent sibling in that direction.
 * - **Regular movement**: In all other cases, the selection is translated by the offset amount.
 */
export class SelectionMoveAction extends AbstractSelectionAction {
  name = $tStr('action.SELECTION_MOVE.name', 'Move Selection');
  availableInCommandPalette = false;

  constructor(
    context: ActionContext,
    protected readonly offset: () => Point
  ) {
    super(context, 'both');
  }

  execute(): void {
    if (this.context.model.activeDiagram.selection.isEmpty()) return;

    const selection = this.context.model.activeDiagram.selection;
    const offset = this.offset();

    // Check if we should attempt sibling swapping in a container layout
    if (this.shouldAttemptSiblingSwap(selection.nodes, offset)) {
      const node = selection.elements[0] as DiagramNode;
      if (this.trySwapWithSibling(node, offset)) {
        this.emit('actionTriggered', {});
        return;
      }
    }

    // Fall back to regular movement
    UnitOfWork.executeWithUndo(this.context.model.activeDiagram, 'Move', uow => {
      transformElements(selection.elements, [new Translation(offset)], uow);
    });

    this.emit('actionTriggered', {});
  }

  /**
   * Determines if we should attempt to swap siblings in a container layout
   */
  private shouldAttemptSiblingSwap(nodes: ReadonlyArray<DiagramNode>, offset: Point): boolean {
    if (nodes.length !== 1) return false;

    const node = mustExist(nodes[0]);

    // Node must have a parent
    if (!node.parent || !isNode(node.parent)) return false;

    const parent = node.parent;

    // Node must not be absolutely positioned
    const elementLayout = node.renderProps.layout?.element;
    if (elementLayout?.isAbsolute === true) return false;

    // Parent must have active container layout
    const containerLayout = parent.renderProps.layout?.container;
    if (!containerLayout || containerLayout.enabled === false) return false;

    // Movement must be along the primary axis
    const direction = containerLayout.direction;
    return (
      (direction === 'horizontal' && offset.x !== 0) || (direction === 'vertical' && offset.y !== 0)
    );
  }

  /**
   * Attempts to swap the node with a sibling in the specified direction
   * Returns true if swap was performed, false otherwise
   */
  private trySwapWithSibling(node: DiagramNode, offset: Point): boolean {
    const parent = node.parent as DiagramNode;
    const containerLayout = parent.renderProps.layout!.container!;
    const direction = containerLayout.direction;
    const isHorizontal = direction === 'horizontal';

    // Get all non-absolute siblings
    const siblings = parent.children
      .filter(isNode)
      .filter(child => child.renderProps.layout?.element?.isAbsolute !== true);

    // Find the target sibling based on position
    const targetSibling = this.findSibling(node, siblings, direction, offset);

    // Calculate the translation needed to swap with the sibling
    const movingForward = isHorizontal ? offset.x > 0 : offset.y > 0;
    const currentPos = isHorizontal ? node.bounds.x : node.bounds.y;
    const targetPos = isHorizontal ? targetSibling.bounds.x : targetSibling.bounds.y;
    const newPos = movingForward ? targetPos + 1 : targetPos - 1;
    const delta = newPos - currentPos;

    const translation = isHorizontal ? { x: delta, y: 0 } : { x: 0, y: delta };

    // Swap by nudging the selected node's position past the sibling
    UnitOfWork.executeWithUndo(this.context.model.activeDiagram, 'Reorder', uow => {
      transformElements([node], [new Translation(translation)], uow);
    });

    return true;
  }

  /**
   * Finds the sibling to swap with in the specified direction
   */
  private findSibling(node: DiagramNode, nodes: DiagramNode[], dir: Axis, offset: Point) {
    const isHorizontal = dir === 'horizontal';
    const movingForward = isHorizontal ? offset.x > 0 : offset.y > 0;

    // Sort siblings by position along the primary axis
    const sorted = [...nodes].sort((a, b) => {
      const posA = isHorizontal ? a.bounds.x : a.bounds.y;
      const posB = isHorizontal ? b.bounds.x : b.bounds.y;
      return posA - posB;
    });

    const idx = sorted.findIndex(s => s.id === node.id);
    if (idx === -1) return node;

    return sorted.at(movingForward ? idx + 1 : Math.max(0, idx - 1)) ?? node;
  }
}
