import { Direction } from '@diagram-craft/geometry/direction';
import { Anchor } from '@diagram-craft/model/anchor';
import { assert } from '@diagram-craft/utils/assert';
import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import { Angle } from '@diagram-craft/geometry/angle';
import { ActionContext } from '@diagram-craft/canvas/action';
import { createLinkedNode } from '@diagram-craft/canvas/linkedNode';

export const createLinkedNodeActions = (context: ActionContext) => {
  return {
    CREATE_LINKED_NODE_E: new CreateLinkedNodeAction(context, 'e'),
    CREATE_LINKED_NODE_W: new CreateLinkedNodeAction(context, 'w'),
    CREATE_LINKED_NODE_N: new CreateLinkedNodeAction(context, 'n'),
    CREATE_LINKED_NODE_S: new CreateLinkedNodeAction(context, 's'),
    CREATE_LINKED_NODE_KEEP_E: new CreateLinkedNodeAction(context, 'e', true),
    CREATE_LINKED_NODE_KEEP_W: new CreateLinkedNodeAction(context, 'w', true),
    CREATE_LINKED_NODE_KEEP_N: new CreateLinkedNodeAction(context, 'n', true),
    CREATE_LINKED_NODE_KEEP_S: new CreateLinkedNodeAction(context, 's', true)
  };
};

declare global {
  interface ActionMap extends ReturnType<typeof createLinkedNodeActions> {}
}

export class CreateLinkedNodeAction extends AbstractSelectionAction {
  constructor(
    context: ActionContext,
    protected readonly direction: Direction,
    protected readonly keepSelection: boolean = false
  ) {
    super(context, MultipleType.SingleOnly, ElementType.Node, ['regular']);
  }

  execute(): void {
    const $sel = this.context.model.activeDiagram.selection;
    const node = $sel.nodes[0];
    assert.present(node);

    let best: [number, Anchor | undefined] = [Number.MAX_SAFE_INTEGER, undefined];
    for (const anchor of node.anchors) {
      if (anchor.type === 'center') continue;
      const d = Angle.normalize(anchor.normal ?? 0) + node.bounds.r;
      const diff = Math.abs(Direction.toAngle(this.direction, true) - d);
      if (diff < best[0]) {
        best = [diff, anchor];
      }
    }

    assert.present(best[1], 'Could not find best anchor');

    const newNode = createLinkedNode(node, best[1].id, this.direction);

    if (!this.keepSelection) {
      $sel.setElements([newNode]);
    }
  }
}
