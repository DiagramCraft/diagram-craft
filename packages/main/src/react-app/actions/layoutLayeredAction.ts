import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas-app/actions/abstractSelectionAction';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { assert } from '@diagram-craft/utils/assert';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { DiagramGraph } from '@diagram-craft/model/diagramGraph';
import { layoutLayered } from '@diagram-craft/graph/layout/layeredLayout';
import { AnchorEndpoint } from '@diagram-craft/model/endpoint';
import type { Application } from '../../application';
import { $tStr } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof layoutLayeredActions> {}
  }
}

export type LayoutLayeredActionDirection = 'down' | 'up' | 'left' | 'right';

export type LayoutLayeredActionArgs = {
  gap: number;
  direction: LayoutLayeredActionDirection;
};

export const layoutLayeredActions = (context: Application) => ({
  LAYOUT_LAYERED: new LayoutLayeredAction(context)
});

export class LayoutLayeredAction extends AbstractSelectionAction<Application> {
  name = $tStr('action.LAYOUT_LAYERED.name', 'Layered');

  constructor(context: Application) {
    super(context, MultipleType.Both, ElementType.Node);
  }

  execute(): void {
    const undoManager = this.context.model.activeDiagram.undoManager;
    undoManager.setMark();

    this.context.ui.showDialog({
      id: 'toolLayoutLayered',
      props: {
        onChange: (d: LayoutLayeredActionArgs) => {
          undoManager.undoToMark();
          this.applyChanges(d);
        }
      },
      onCancel: () => {
        undoManager.undoToMark();
        undoManager.clearRedo();
      },
      onOk: (d: LayoutLayeredActionArgs) => {
        undoManager.undoToMark();
        this.applyChanges(d);
        this.emit('actionTriggered', {});
      }
    });
  }

  private applyChanges(d: LayoutLayeredActionArgs) {
    const diagram = this.context.model.activeDiagram;
    const selection = diagram.selection;

    assert.isRegularLayer(diagram.activeLayer);
    const graph = new DiagramGraph(diagram.activeLayer as RegularLayer);

    const selectedNodes = selection.elements.filter(isNode);
    if (selectedNodes.length === 0) return;

    // Get the layered layout positions
    const positions = layoutLayered(
      graph,
      selectedNodes.map(n => n.id),
      {
        horizontalSpacing: selectedNodes.reduce((a, b) => Math.max(a, b.bounds.w), 0) + d.gap,
        verticalSpacing: selectedNodes.reduce((a, b) => Math.max(a, b.bounds.h), 0) + d.gap,
        direction: d.direction
      }
    );

    if (positions.size === 0) return;

    const uow = new UnitOfWork(diagram, true);

    // Center all edge anchors for edges in the layout
    const adjacencyList = graph.adjacencyList();
    const edgesToCenter = new Set<string>();

    for (const nodeId of positions.keys()) {
      const neighbors = adjacencyList.get(nodeId) ?? [];
      for (const { edge } of neighbors) {
        if (positions.has(edge.from) && positions.has(edge.to)) {
          edgesToCenter.add(edge.id);
        }
      }
    }

    for (const edgeId of edgesToCenter) {
      const element = diagram.lookup(edgeId);
      if (element && isEdge(element)) {
        if (element.start instanceof AnchorEndpoint) {
          element.setStart(new AnchorEndpoint(element.start.node, 'c', element.start.offset), uow);
        }
        if (element.end instanceof AnchorEndpoint) {
          element.setEnd(new AnchorEndpoint(element.end.node, 'c', element.end.offset), uow);
        }
      }
    }

    // Get the first selected node's current position to keep it in place
    const firstNode = selectedNodes[0];
    if (!firstNode) return;

    const firstPosition = positions.get(firstNode.id);
    if (!firstPosition) return;

    const rootOffset = {
      x: firstNode.bounds.x - firstPosition.x,
      y: firstNode.bounds.y - firstPosition.y
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

    commitWithUndo(uow, 'Layout layered');
  }
}
