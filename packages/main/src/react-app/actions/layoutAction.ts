import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas-app/actions/abstractSelectionAction';
import { ActionContext } from '@diagram-craft/canvas/action';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { isNode } from '@diagram-craft/model/diagramElement';
import { assert } from '@diagram-craft/utils/assert';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { DiagramGraph } from '@diagram-craft/model/diagramGraph';
import { layoutTree } from '@diagram-craft/graph/layout';
import { extractMaximalTree } from '@diagram-craft/graph/transformation';
import { AnchorEndpoint } from '@diagram-craft/model/endpoint';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof layoutActions> {}
  }
}

export const layoutActions = (context: ActionContext) => ({
  LAYOUT_TREE: new LayoutTreeAction(context)
});

export class LayoutTreeAction extends AbstractSelectionAction {
  constructor(context: ActionContext) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
  }

  execute(): void {
    const diagram = this.context.model.activeDiagram;
    const selection = diagram.selection;

    assert.isRegularLayer(diagram.activeLayer);
    const graph = new DiagramGraph(diagram.activeLayer as RegularLayer);

    const rootElement = selection.elements[0];
    assert.present(rootElement);
    assert.true(isNode(rootElement));

    const tree = extractMaximalTree(graph, rootElement.id);
    assert.present(tree);

    // Get the tree layout positions
    const positions = layoutTree(graph, rootElement.id, {
      horizontalSpacing: tree.vertices.reduce((a, b) => Math.max(a, b.data.bounds.w), 0) + 50,
      verticalSpacing: tree.vertices.reduce((a, b) => Math.max(a, b.data.bounds.h), 0) + 50,
      direction: 'down'
    });

    if (positions.size === 0) return;

    const uow = new UnitOfWork(diagram, true);

    // Ensure all anchors are centered
    for (const edge of tree.edges) {
      const e = edge.data;
      if (e.start instanceof AnchorEndpoint) {
        edge.data.setStart(new AnchorEndpoint(e.start.node, 'c', e.start.offset), uow);
      }
      if (e.end instanceof AnchorEndpoint) {
        edge.data.setEnd(new AnchorEndpoint(e.end.node, 'c', e.end.offset), uow);
      }
    }

    // Get the root's current position to keep it in place
    const rootPosition = positions.get(rootElement.id);
    if (!rootPosition) return;

    const rootOffset = {
      x: rootElement.bounds.x - rootPosition.x,
      y: rootElement.bounds.y - rootPosition.y
    };

    // Move all nodes according to their relative positions
    for (const [nodeId, position] of positions) {
      const node = diagram.lookup(nodeId);
      if (node && isNode(node) && node.renderProps.capabilities.movable !== false) {
        const newBounds = {
          ...node.bounds,
          x: position.x + rootOffset.x,
          y: position.y + rootOffset.y
        };
        node.setBounds(newBounds, uow);
      }
    }

    commitWithUndo(uow, 'Layout tree');

    this.emit('actionTriggered', {});
  }
}
