import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { DiagramEdge, type EdgePropsForEditing } from '@diagram-craft/model/diagramEdge';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { AnchorEndpoint, ConnectedEndpoint } from '@diagram-craft/model/endpoint';
import { newid } from '@diagram-craft/utils/id';
import {
  ANCHOR_POSITION_MAP,
  ARROW_TYPE_MAP,
  SIMPLIFIED_DEFAULTS,
  SimplifiedDiagram,
  SimplifiedEdge,
  type SimplifiedEdgeType,
  SimplifiedNode,
  type SimplifiedNodeType
} from './aiDiagramTypes';
import {
  commitWithUndo,
  ElementAddUndoableAction,
  ElementDeleteUndoableAction
} from '@diagram-craft/model/diagramUndoActions';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { assert } from '@diagram-craft/utils/assert';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';
import type { DiagramElement } from '@diagram-craft/model/diagramElement';
import type { DeepWriteable } from '@diagram-craft/utils/types';

export class AIModel {
  private readonly diagram: Diagram;
  private readonly layer: RegularLayer;

  constructor(diagram: Diagram) {
    this.diagram = diagram;

    assert.isRegularLayer(diagram.layers.active);
    this.layer = diagram.layers.active;
  }

  /**
   * Converts a simplified diagram format to internal Diagram elements
   * and adds them to the diagram
   */
  applyChange(simplified: SimplifiedDiagram): void {
    switch (simplified.action) {
      case 'create':
      case 'add':
        this.diagram.undoManager.addAndExecute(this.handleCreateOrAdd(simplified));
        break;
      case 'modify': {
        const uow = new UnitOfWork(this.diagram, true);
        this.handleModify(simplified, uow);
        commitWithUndo(uow, 'AI Changes');
        break;
      }
      case 'replace':
        this.diagram.undoManager.addAndExecute(this.handleReplace(simplified));
        break;
      case 'remove':
      case 'delete':
        this.diagram.undoManager.addAndExecute(this.handleRemove(simplified));
        break;
    }
  }

  private handleCreateOrAdd(simplified: SimplifiedDiagram) {
    const nodes = simplified.nodes ?? [];
    const edges = simplified.edges ?? [];

    // Apply auto-layout if requested and positions not specified
    const needsLayout = simplified.layout === 'auto' || this.needsAutoLayout(nodes);
    const nodesWithLayout = needsLayout ? this.applyAutoLayout(nodes) : nodes;

    const elements: DiagramElement[] = [];

    // Create nodes first
    const newNodes = new Map<string, DiagramNode>();
    for (const simpleNode of nodesWithLayout) {
      const e = this.createNode(simpleNode);
      elements.push(e);
      newNodes.set(simpleNode.id, e);
    }

    // Create edges after all nodes exist
    for (const simpleEdge of edges) {
      const e = this.createEdge(simpleEdge, newNodes);
      if (e) elements.push(e);
    }

    return new ElementAddUndoableAction(elements, this.diagram, this.layer, 'AI Additions');
  }

  private handleModify(simplified: SimplifiedDiagram, uow: UnitOfWork): void {
    const modifications = simplified.modifications ?? [];

    for (const mod of modifications) {
      const existingNode = this.diagram.nodeLookup.get(mod.nodeId);
      if (existingNode) {
        this.updateNode(existingNode, mod.updates, uow);
      }
    }
  }

  private handleRemove(simplified: SimplifiedDiagram) {
    const elements: DiagramElement[] = [];
    for (const id of simplified.removeIds ?? []) {
      const element = this.diagram.lookup(id);
      if (element) elements.push(element);
    }

    return new ElementDeleteUndoableAction(this.diagram, this.layer, elements, true, 'AI Removals');
  }

  private handleReplace(simplified: SimplifiedDiagram) {
    return new CompoundUndoableAction([
      new ElementDeleteUndoableAction(this.diagram, this.layer, [...this.layer.elements], true),
      this.handleCreateOrAdd(simplified)
    ]);
  }

  private needsAutoLayout(nodes: SimplifiedNode[]): boolean {
    return nodes.some(node => node.x === undefined || node.y === undefined);
  }

  private applyAutoLayout(nodes: SimplifiedNode[]): SimplifiedNode[] {
    // Simple grid-based layout
    const COLS = Math.ceil(Math.sqrt(nodes.length));
    const { layoutSpacingX, layoutSpacingY, layoutStartX, layoutStartY, nodeWidth, nodeHeight } =
      SIMPLIFIED_DEFAULTS;

    return nodes.map((node, index) => {
      if (node.x !== undefined && node.y !== undefined) {
        return node; // Keep manual positions
      }

      const col = index % COLS;
      const row = Math.floor(index / COLS);

      return {
        ...node,
        x: layoutStartX + col * layoutSpacingX,
        y: layoutStartY + row * layoutSpacingY,
        width: node.width ?? nodeWidth,
        height: node.height ?? nodeHeight
      };
    });
  }

  private createNode(simpleNode: SimplifiedNode): DiagramNode {
    const { nodeType, nodeWidth, nodeHeight, nodeFill, nodeStroke, nodeStrokeWidth } =
      SIMPLIFIED_DEFAULTS;

    const bounds = {
      x: simpleNode.x ?? 0,
      y: simpleNode.y ?? 0,
      w: simpleNode.width ?? nodeWidth,
      h: simpleNode.height ?? nodeHeight,
      r: 0
    };

    const props = {
      fill: {
        color: simpleNode.fill ?? nodeFill
      },
      stroke: {
        color: simpleNode.stroke ?? nodeStroke,
        width: simpleNode.strokeWidth ?? nodeStrokeWidth
      }
    };

    const metadata = {
      name: simpleNode.id
    };

    const texts = simpleNode.text ? { text: simpleNode.text } : undefined;

    return ElementFactory.node(
      newid(),
      simpleNode.type ?? nodeType,
      bounds,
      this.layer,
      props,
      metadata,
      texts
    );
  }

  private createEdge(
    simpleEdge: SimplifiedEdge,
    nodes: Map<string, DiagramNode>
  ): DiagramEdge | null {
    // Look in nodeMap first (newly created nodes), then fall back to diagram lookup (existing nodes)
    const fromNode = nodes.get(simpleEdge.from) ?? this.diagram.nodeLookup.get(simpleEdge.from);
    const toNode = nodes.get(simpleEdge.to) ?? this.diagram.nodeLookup.get(simpleEdge.to);

    if (!fromNode || !toNode) {
      return null;
    }

    const { edgeType, edgeStroke, edgeStrokeWidth, edgeEndArrow, anchorPosition } =
      SIMPLIFIED_DEFAULTS;

    const fromAnchor = ANCHOR_POSITION_MAP[simpleEdge.fromAnchor ?? anchorPosition];
    const toAnchor = ANCHOR_POSITION_MAP[simpleEdge.toAnchor ?? anchorPosition];

    const startArrowType = simpleEdge.startArrow ? ARROW_TYPE_MAP[simpleEdge.startArrow] : null;
    const endArrowType = simpleEdge.endArrow
      ? ARROW_TYPE_MAP[simpleEdge.endArrow]
      : ARROW_TYPE_MAP[edgeEndArrow];

    const props: DeepWriteable<EdgePropsForEditing> = {
      type: simpleEdge.type ?? edgeType,
      stroke: {
        color: simpleEdge.stroke ?? edgeStroke,
        width: simpleEdge.strokeWidth ?? edgeStrokeWidth
      }
    };

    // Add arrow configuration
    if (startArrowType || endArrowType) {
      props.arrow = {};
      if (startArrowType) props.arrow.start = { type: startArrowType, size: 10 };
      if (endArrowType) props.arrow.end = { type: endArrowType, size: 10 };
    }

    return ElementFactory.edge(
      newid(),
      new AnchorEndpoint(fromNode, fromAnchor),
      new AnchorEndpoint(toNode, toAnchor),
      props,
      {},
      [],
      this.layer
    );
  }

  private updateNode(node: DiagramNode, updates: Partial<SimplifiedNode>, uow: UnitOfWork): void {
    node.setBounds(
      {
        x: updates.x ?? node.bounds.x,
        y: updates.y ?? node.bounds.y,
        w: updates.width ?? node.bounds.w,
        h: updates.height ?? node.bounds.h,
        r: node.bounds.r
      },
      uow
    );

    // Update text if changed
    if (updates.text !== undefined) {
      node.setText(updates.text, uow);
    }

    // Update props if colors changed
    if (
      updates.fill !== undefined ||
      updates.stroke !== undefined ||
      updates.strokeWidth !== undefined
    ) {
      const newProps = {
        ...node.renderProps,
        fill: updates.fill !== undefined ? { color: updates.fill } : node.renderProps.fill,
        stroke: {
          color: updates.stroke ?? node.renderProps.stroke?.color,
          width: updates.strokeWidth ?? node.renderProps.stroke?.width ?? 2
        }
      };
      node.updateProps(p => ({ ...p, ...newProps }), uow);
    }
  }

  /**
   * Exports current diagram to simplified format
   */
  asAIView(): SimplifiedDiagram {
    const nodes: SimplifiedNode[] = Array.from(this.diagram.nodeLookup.values()).map(node => ({
      id: node.id,
      type: node.nodeType as SimplifiedNodeType,
      x: node.bounds.x,
      y: node.bounds.y,
      width: node.bounds.w,
      height: node.bounds.h,
      text: node.getText(),
      fill: node.renderProps.fill?.color,
      stroke: node.renderProps.stroke?.color,
      strokeWidth: node.renderProps.stroke?.width
    }));

    const edges: SimplifiedEdge[] = Array.from(this.diagram.edgeLookup.values()).map(edge => {
      const startNode = edge.start.isConnected
        ? ((edge.start as ConnectedEndpoint).node as DiagramNode)
        : undefined;
      const endNode = edge.end.isConnected
        ? ((edge.end as ConnectedEndpoint).node as DiagramNode)
        : undefined;

      return {
        from: startNode?.id ?? '',
        to: endNode?.id ?? '',
        type: edge.renderProps.type as SimplifiedEdgeType,
        stroke: edge.renderProps.stroke?.color,
        strokeWidth: edge.renderProps.stroke?.width
      };
    });

    return { action: 'create', nodes, edges, layout: 'manual' };
  }
}
