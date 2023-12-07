import { Point } from '../geometry/point.ts';
import { VERIFY_NOT_REACHED } from '../utils/assert.ts';
import { AbstractNode, DiagramNode } from './diagramNode.ts';
import { AbstractEdge, DiagramEdge } from './diagramEdge.ts';

interface Reference {
  id: string;
}

type SerializedLayer = {
  id: string;
  name: string;
  type: 'layer';
  layerType: 'basic' | 'reference' | 'adjustment';
  elements: (SerializedNode | SerializedEdge | SerializedLayer)[];
};

type SerializedDiagram = {
  id: string;
  name: string;
  layers: SerializedLayer[];
  diagrams: SerializedDiagram[];
};

export interface SerializedDiagramDocument {
  diagrams: SerializedDiagram[];
}

export interface SerializedNode extends AbstractNode {
  edges?: Record<string, Reference[]>;

  // TODO: Should allow edges as part of group
  children: SerializedNode[];
}

type SerializedConnectedEndpoint = { anchor: number; node: Reference };

type SerializedEndpoint = SerializedConnectedEndpoint | { position: Point };

export interface SerializedEdge extends AbstractEdge {
  start: SerializedEndpoint;
  end: SerializedEndpoint;
}

const isNodeDef = (
  element: SerializedNode | SerializedEdge | SerializedLayer
): element is SerializedNode => element.type === 'node';
const isEdgeDef = (
  element: SerializedNode | SerializedEdge | SerializedLayer
): element is SerializedEdge => element.type === 'edge';

const isConnected = (endpoint: SerializedEndpoint): endpoint is SerializedConnectedEndpoint =>
  'node' in endpoint;

const unfoldGroup = (node: SerializedNode) => {
  const recurse = (
    nodes: SerializedNode[],
    parent?: SerializedNode | undefined
  ): (SerializedNode & { parent?: SerializedNode | undefined })[] => {
    return [...nodes.map(n => ({ ...n, parent })), ...nodes.flatMap(n => recurse(n.children, n))];
  };

  if (node.nodeType === 'group') {
    return [{ ...node }, ...recurse(node.children, node)];
  } else {
    return [{ ...node }];
  }
};

export const deserializeDiagramDocument = (
  diagram: SerializedDiagramDocument
): (DiagramNode | DiagramEdge)[] => {
  const nodeLookup: Record<string, DiagramNode> = {};
  const edgeLookup: Record<string, DiagramEdge> = {};

  const diagramElements: (SerializedNode | SerializedEdge)[] = [];
  for (const d of diagram.diagrams) {
    for (const l of d.layers) {
      for (const e of l.elements) {
        if (isNodeDef(e)) {
          diagramElements.push(e);
        } else if (isEdgeDef(e)) {
          diagramElements.push(e);
        }
      }
    }
  }

  const allNodes = diagramElements.filter(isNodeDef);

  // Index skeleton nodes
  for (const n of allNodes) {
    for (const c of unfoldGroup(n)) {
      nodeLookup[c.id] = new DiagramNode(c.id, c.nodeType, c.bounds, c.anchors);
      nodeLookup[c.id].props = c.props;
    }
  }

  // Resolve relative positions
  for (const n of allNodes) {
    for (const child of unfoldGroup(n)) {
      if (child.parent) {
        nodeLookup[child.id].bounds = {
          ...nodeLookup[child.id].bounds,
          pos: Point.add(nodeLookup[child.id].bounds.pos, nodeLookup[child.parent.id].bounds.pos)
        };
      }
    }
  }

  // Resolve relations
  for (const n of allNodes) {
    for (const c of unfoldGroup(n)) {
      nodeLookup[c.id].children = c.children.map(c2 => nodeLookup[c2.id]);
      if (c.parent) {
        nodeLookup[n.id].parent = nodeLookup[c.parent.id];
      }
    }
  }

  for (const e of diagramElements) {
    if (e.type !== 'edge') continue;

    const start = e.start;
    const end = e.end;

    const edge = new DiagramEdge(
      e.id,
      isConnected(start)
        ? { anchor: start.anchor, node: nodeLookup[start.node.id] }
        : { position: start.position },
      isConnected(end)
        ? { anchor: end.anchor, node: nodeLookup[end.node.id] }
        : { position: end.position },
      e.props,
      e.waypoints
    );

    if (isConnected(start)) {
      const startNode = nodeLookup[start.node.id];

      startNode.edges ??= {};
      startNode.edges[start.anchor] ??= [];
      startNode.edges[start.anchor].push(edge);
    }

    if (isConnected(end)) {
      const endNode = nodeLookup[end.node.id];

      endNode.edges ??= {};
      endNode.edges[end.anchor] ??= [];
      endNode.edges[end.anchor].push(edge);
    }

    edgeLookup[e.id] = edge;
  }

  const elements: (DiagramEdge | DiagramNode)[] = [];
  for (const n of diagramElements) {
    if (n.type === 'node') {
      elements.push(nodeLookup[n.id]);
    } else if (n.type === 'edge') {
      elements.push(edgeLookup[n.id]);
    } else {
      VERIFY_NOT_REACHED();
    }
  }

  return elements;
};
