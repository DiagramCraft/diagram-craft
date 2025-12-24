import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { isNode } from '@diagram-craft/model/diagramElement';
import { assert } from '@diagram-craft/utils/assert';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { DiagramGraph } from '@diagram-craft/model/diagramGraph';
import { layoutForceDirected } from '@diagram-craft/graph/layout/forceDirectedLayout';
import { AnchorEndpoint } from '@diagram-craft/model/endpoint';
import type { Application } from '../../application';
import type { Point } from '@diagram-craft/geometry/point';
import type { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { $tStr } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof layoutForceDirectedActions> {}
  }
}

export type LayoutForceDirectedActionArgs = {
  springStrength: number;
  repulsionStrength: number;
  idealEdgeLength: number;
  iterations: number;
};

export const layoutForceDirectedActions = (context: Application) => ({
  LAYOUT_FORCE_DIRECTED: new LayoutForceDirectedAction(context)
});

export class LayoutForceDirectedAction extends AbstractSelectionAction<Application> {
  name = $tStr('action.LAYOUT_FORCE_DIRECTED.name', 'Force-Directed');

  constructor(context: Application) {
    super(context, MultipleType.Both, ElementType.Node);
  }

  execute(): void {
    const undoManager = this.context.model.activeDiagram.undoManager;
    undoManager.setMark();

    this.context.ui.showDialog({
      id: 'toolLayoutForceDirected',
      props: {
        onChange: (d: LayoutForceDirectedActionArgs) => {
          undoManager.undoToMark();
          this.applyChanges(d);
        }
      },
      onCancel: () => {
        undoManager.undoToMark();
        undoManager.clearRedo();
      },
      onOk: (d: LayoutForceDirectedActionArgs) => {
        undoManager.undoToMark();
        this.applyChanges(d);
        this.emit('actionTriggered', {});
      }
    });
  }

  private applyChanges(d: LayoutForceDirectedActionArgs) {
    const diagram = this.context.model.activeDiagram;
    const selection = diagram.selection;

    assert.isRegularLayer(diagram.activeLayer);
    const graph = new DiagramGraph(diagram.activeLayer as RegularLayer);

    // Get selected nodes
    const selectedNodes = selection.elements.filter(isNode);
    if (selectedNodes.length === 0) return;

    // Collect initial positions for all nodes in the layer
    const initialPositions = new Map<string, Point>();
    const allLayerNodes = (diagram.activeLayer as RegularLayer).elements.filter(isNode);
    for (const node of allLayerNodes) {
      initialPositions.set(node.id, {
        x: node.bounds.x + node.bounds.w / 2,
        y: node.bounds.y + node.bounds.h / 2
      });
    }

    // Calculate layout - will layout entire connected component
    const positions = layoutForceDirected(
      graph,
      selectedNodes.map(n => n.id),
      {
        iterations: d.iterations,
        springStrength: d.springStrength,
        repulsionStrength: d.repulsionStrength,
        idealEdgeLength: d.idealEdgeLength,
        initialPositions
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
        // Only center edges between nodes in the layout
        if (positions.has(edge.from) && positions.has(edge.to)) {
          edgesToCenter.add(edge.id);
        }
      }
    }

    for (const edgeId of edgesToCenter) {
      const element = diagram.lookup(edgeId);
      if (element && !isNode(element)) {
        const edge = element as DiagramEdge;
        if (edge.start instanceof AnchorEndpoint) {
          edge.setStart(new AnchorEndpoint(edge.start.node, 'c', edge.start.offset), uow);
        }
        if (edge.end instanceof AnchorEndpoint) {
          edge.setEnd(new AnchorEndpoint(edge.end.node, 'c', edge.end.offset), uow);
        }
      }
    }

    // Apply new positions to nodes
    for (const [nodeId, position] of positions) {
      const node = diagram.lookup(nodeId);
      if (node && isNode(node) && node.renderProps.capabilities.movable !== false) {
        const newBounds = {
          ...node.bounds,
          x: position.x - node.bounds.w / 2,
          y: position.y - node.bounds.h / 2
        };
        node.setBounds(newBounds, uow);
      }
    }

    commitWithUndo(uow, 'Layout force-directed');
  }
}
