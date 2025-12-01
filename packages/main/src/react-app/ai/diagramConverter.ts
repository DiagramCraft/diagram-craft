import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { AnchorEndpoint } from '@diagram-craft/model/endpoint';
import { newid } from '@diagram-craft/utils/id';
import {
  SimplifiedDiagram,
  SimplifiedNode,
  SimplifiedEdge,
  SIMPLIFIED_DEFAULTS,
  ANCHOR_POSITION_MAP,
  ARROW_TYPE_MAP
} from './aiDiagramTypes';
import type { RegularLayer } from '@diagram-craft/model/diagramLayer';

export class DiagramConverter {
  private diagram: Diagram;
  private layer: RegularLayer;
  private nodeMap: Map<string, DiagramNode> = new Map();

  constructor(diagram: Diagram) {
    this.diagram = diagram;
    this.layer = diagram.layers.active as RegularLayer;
  }

  /**
   * Converts a simplified diagram format to internal Diagram elements
   * and adds them to the diagram
   */
  convert(simplified: SimplifiedDiagram): void {
    const uow = UnitOfWork.immediate(this.diagram);

    // Handle different action types
    switch (simplified.action) {
      case 'create':
      case 'add':
        this.handleCreateOrAdd(simplified, uow);
        break;
      case 'modify':
        this.handleModify(simplified, uow);
        break;
      case 'replace':
        this.handleReplace(simplified, uow);
        break;
    }
  }

  private handleCreateOrAdd(simplified: SimplifiedDiagram, uow: UnitOfWork): void {
    const nodes = simplified.nodes ?? [];
    const edges = simplified.edges ?? [];

    // Apply auto-layout if requested and positions not specified
    const needsLayout = simplified.layout === 'auto' || this.needsAutoLayout(nodes);
    const layoutedNodes = needsLayout ? this.applyAutoLayout(nodes) : nodes;

    // Create nodes first
    for (const simpleNode of layoutedNodes) {
      const node = this.createNode(simpleNode);
      this.layer.addElement(node, uow);
      this.nodeMap.set(simpleNode.id, node);
    }

    // Create edges after all nodes exist
    for (const simpleEdge of edges) {
      const edge = this.createEdge(simpleEdge);
      if (edge) {
        this.layer.addElement(edge, uow);
      }
    }
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

  private handleReplace(simplified: SimplifiedDiagram, uow: UnitOfWork): void {
    // Clear existing elements
    const allElements = [...this.layer.elements];
    for (const element of allElements) {
      this.layer.removeElement(element, uow);
    }

    // Clear node map
    this.nodeMap.clear();

    // Add new elements
    this.handleCreateOrAdd(simplified, uow);
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
    const {
      nodeType,
      nodeWidth,
      nodeHeight,
      nodeFill,
      nodeStroke,
      nodeStrokeWidth
    } = SIMPLIFIED_DEFAULTS;

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

  private createEdge(simpleEdge: SimplifiedEdge): DiagramEdge | null {
    const fromNode = this.nodeMap.get(simpleEdge.from);
    const toNode = this.nodeMap.get(simpleEdge.to);

    if (!fromNode || !toNode) {
      console.warn(`Cannot create edge: node not found (from: ${simpleEdge.from}, to: ${simpleEdge.to})`);
      return null;
    }

    const { edgeType, edgeStroke, edgeStrokeWidth, edgeEndArrow, anchorPosition } =
      SIMPLIFIED_DEFAULTS;

    const fromAnchor = ANCHOR_POSITION_MAP[simpleEdge.fromAnchor ?? anchorPosition];
    const toAnchor = ANCHOR_POSITION_MAP[simpleEdge.toAnchor ?? anchorPosition];

    const startArrowType = simpleEdge.startArrow
      ? ARROW_TYPE_MAP[simpleEdge.startArrow]
      : null;
    const endArrowType = simpleEdge.endArrow
      ? ARROW_TYPE_MAP[simpleEdge.endArrow]
      : ARROW_TYPE_MAP[edgeEndArrow];

    const props: any = {
      type: simpleEdge.type ?? edgeType,
      stroke: {
        color: simpleEdge.stroke ?? edgeStroke,
        width: simpleEdge.strokeWidth ?? edgeStrokeWidth
      }
    };

    // Add arrow configuration
    if (startArrowType || endArrowType) {
      props.arrow = {};
      if (startArrowType) {
        props.arrow.start = { type: startArrowType, size: 10 };
      }
      if (endArrowType) {
        props.arrow.end = { type: endArrowType, size: 10 };
      }
    }

    const edge = ElementFactory.edge(
      newid(),
      new AnchorEndpoint(fromNode, fromAnchor),
      new AnchorEndpoint(toNode, toAnchor),
      props,
      {},
      [],
      this.layer
    );

    return edge;
  }

  private updateNode(node: DiagramNode, updates: Partial<SimplifiedNode>, uow: UnitOfWork): void {
    // Update bounds if position or size changed
    if (updates.x !== undefined || updates.y !== undefined || updates.width !== undefined || updates.height !== undefined) {
      const newBounds = {
        x: updates.x ?? node.bounds.x,
        y: updates.y ?? node.bounds.y,
        w: updates.width ?? node.bounds.w,
        h: updates.height ?? node.bounds.h,
        r: node.bounds.r
      };
      node.updateBounds(newBounds, uow);
    }

    // Update text if changed
    if (updates.text !== undefined) {
      const newTexts = { ...node.getText(), text: updates.text };
      node.updateText(newTexts, uow);
    }

    // Update props if colors changed
    if (updates.fill !== undefined || updates.stroke !== undefined || updates.strokeWidth !== undefined) {
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
   * Gets all node IDs in the current diagram
   */
  getExistingNodeIds(): string[] {
    return Array.from(this.diagram.nodeLookup.values()).map(node => node.id);
  }

  /**
   * Exports current diagram to simplified format
   */
  exportToSimplified(): SimplifiedDiagram {
    const nodes: SimplifiedNode[] = Array.from(this.diagram.nodeLookup.values()).map(node => ({
      id: node.id,
      type: node.nodeType as any,
      x: node.bounds.x,
      y: node.bounds.y,
      width: node.bounds.w,
      height: node.bounds.h,
      text: node.getText(),
      fill: node.renderProps.fill?.color,
      stroke: node.renderProps.stroke?.color,
      strokeWidth: node.renderProps.stroke?.width
    }));

    const edges: SimplifiedEdge[] = Array.from(this.diagram.edgeLookup.values()).map(edge => ({
      from: edge.start.node?.id ?? '',
      to: edge.end.node?.id ?? '',
      type: edge.renderProps.type as any,
      stroke: edge.renderProps.stroke?.color,
      strokeWidth: edge.renderProps.stroke?.width
    }));

    return {
      action: 'create',
      nodes,
      edges,
      layout: 'manual'
    };
  }
}
