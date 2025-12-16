import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas-app/actions/abstractSelectionAction';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { isNode } from '@diagram-craft/model/diagramElement';
import { assert } from '@diagram-craft/utils/assert';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { DiagramGraph } from '@diagram-craft/model/diagramGraph';
import { layoutTree } from '@diagram-craft/graph/layout/treeLayout';
import { extractMaximalTree } from '@diagram-craft/graph/transformation';
import { AnchorEndpoint } from '@diagram-craft/model/endpoint';
import type { Application } from '../../application';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof layoutTreeActions> {}
  }
}

export type LayoutTreeActionDirection = 'down' | 'up' | 'left' | 'right';

export type LayoutTreeActionArgs = {
  gap: number;
  direction: LayoutTreeActionDirection;
};

export const layoutTreeActions = (context: Application) => ({
  LAYOUT_TREE: new LayoutTreeAction(context)
});

export class LayoutTreeAction extends AbstractSelectionAction<Application> {
  name = 'Tree';

  constructor(context: Application) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
  }

  execute(): void {
    const undoManager = this.context.model.activeDiagram.undoManager;
    undoManager.setMark();

    this.context.ui.showDialog({
      id: 'toolLayoutTree',
      props: {
        onChange: (d: LayoutTreeActionArgs) => {
          undoManager.undoToMark();
          this.applyChanges(d);
        }
      },
      onCancel: () => {
        undoManager.undoToMark();
        undoManager.clearRedo();
      },
      onOk: (d: LayoutTreeActionArgs) => {
        undoManager.undoToMark();
        this.applyChanges(d);
        this.emit('actionTriggered', {});
      }
    });
  }

  private applyChanges(d: LayoutTreeActionArgs) {
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
      horizontalSpacing: tree.vertices.reduce((a, b) => Math.max(a, b.data.bounds.w), 0) + d.gap,
      verticalSpacing: tree.vertices.reduce((a, b) => Math.max(a, b.data.bounds.h), 0) + d.gap,
      direction: d.direction
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
  }
}
