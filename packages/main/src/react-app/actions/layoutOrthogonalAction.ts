import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { assert } from '@diagram-craft/utils/assert';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { DiagramGraph } from '@diagram-craft/model/diagramGraph';
import { layoutOrthogonal } from '@diagram-craft/graph/layout/orthogonalLayout';
import { AnchorEndpoint } from '@diagram-craft/model/endpoint';
import type { Application } from '../../application';
import { $tStr } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof layoutOrthogonalActions> {}
  }
}

export type LayoutOrthogonalActionDirection = 'down' | 'up' | 'left' | 'right';

export type LayoutOrthogonalActionArgs = {
  gap: number;
  direction: LayoutOrthogonalActionDirection;
};

export const layoutOrthogonalActions = (context: Application) => ({
  LAYOUT_ORTHOGONAL: new LayoutOrthogonalAction(context)
});

export class LayoutOrthogonalAction extends AbstractSelectionAction<Application> {
  name = $tStr('action.LAYOUT_ORTHOGONAL.name', 'Orthogonal');

  constructor(context: Application) {
    super(context, MultipleType.Both, ElementType.Node);
  }

  execute(): void {
    const undoManager = this.context.model.activeDiagram.undoManager;
    undoManager.setMark();

    this.context.ui.showDialog({
      id: 'toolLayoutOrthogonal',
      props: {
        onChange: (d: LayoutOrthogonalActionArgs) => {
          undoManager.undoToMark();
          this.applyChanges(d);
        }
      },
      onCancel: () => {
        undoManager.undoToMark();
        undoManager.clearRedo();
      },
      onOk: (d: LayoutOrthogonalActionArgs) => {
        undoManager.undoToMark();
        this.applyChanges(d);
        this.emit('actionTriggered', {});
      }
    });
  }

  private applyChanges(d: LayoutOrthogonalActionArgs) {
    const diagram = this.context.model.activeDiagram;
    const selection = diagram.selection;

    assert.isRegularLayer(diagram.activeLayer);
    const graph = new DiagramGraph(diagram.activeLayer as RegularLayer);

    const selectedNodes = selection.elements.filter(isNode);
    if (selectedNodes.length === 0) return;

    // Get the orthogonal layout positions
    const positions = layoutOrthogonal(
      graph,
      selectedNodes.map(n => n.id),
      {
        gridSpacing: selectedNodes.reduce((a, b) => Math.max(a, b.bounds.w), 0) + d.gap,
        direction: d.direction
      }
    );

    if (positions.size === 0) return;

    UnitOfWork.executeWithUndo(diagram, 'Layout orthogonal', uow => {
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
            element.setStart(
              new AnchorEndpoint(element.start.node, 'c', element.start.offset),
              uow
            );
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
    });
  }
}
