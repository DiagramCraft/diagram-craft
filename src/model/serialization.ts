import { Point } from '../geometry/point.ts';
import { VERIFY_NOT_REACHED, VerifyNotReached } from '../utils/assert.ts';
import { DiagramNode } from './diagramNode.ts';
import { ConnectedEndpoint, DiagramEdge } from './diagramEdge.ts';
import { Diagram } from './diagram.ts';
import { DiagramDocument } from './diagramDocument.ts';
import { AbstractEdge, AbstractNode } from './types.ts';
import { Layer } from './diagramLayer.ts';
import { DiagramElement, isEdge, isNode } from './diagramElement.ts';
import { UnitOfWork } from './unitOfWork.ts';

interface Reference {
  id: string;
}

type SerializedLayer = {
  id: string;
  name: string;
  type: 'layer';
  layerType: 'basic' | 'reference' | 'adjustment';
  elements: ReadonlyArray<SerializedElement>;
};

export type SerializedDiagram = {
  id: string;
  name: string;
  layers: ReadonlyArray<SerializedLayer>;
  diagrams: ReadonlyArray<SerializedDiagram>;
};

export interface SerializedDiagramDocument {
  diagrams: ReadonlyArray<SerializedDiagram>;
}

export interface SerializedNode extends AbstractNode {
  edges?: Record<string, ReadonlyArray<Reference>>;
  children: ReadonlyArray<SerializedElement>;
}

type SerializedConnectedEndpoint = { anchor: number; node: Reference; position?: Point };

type SerializedEndpoint = SerializedConnectedEndpoint | { position: Point };

export interface SerializedEdge extends AbstractEdge {
  start: SerializedEndpoint;
  end: SerializedEndpoint;
}

export type SerializedElement = SerializedNode | SerializedEdge;

const isNodeDef = (element: SerializedElement | SerializedLayer): element is SerializedNode =>
  element.type === 'node';
const isEdgeDef = (element: SerializedElement | SerializedLayer): element is SerializedEdge =>
  element.type === 'edge';

export const isConnected = (
  endpoint: SerializedEndpoint
): endpoint is SerializedConnectedEndpoint => 'node' in endpoint;

const unfoldGroup = (node: SerializedNode) => {
  const recurse = (
    nodes: ReadonlyArray<SerializedElement>,
    parent?: SerializedNode | undefined
  ): (SerializedElement & { parent?: SerializedNode | undefined })[] => {
    return [
      ...nodes.map(n => ({ ...n, parent })),
      ...nodes.flatMap(n => (n.type === 'node' ? recurse(n.children, n) : []))
    ];
  };

  if (node.nodeType === 'group') {
    return [{ ...node }, ...recurse(node.children, node)];
  } else {
    return [{ ...node }];
  }
};

export const deserializeDiagramElements = (
  diagramElements: ReadonlyArray<SerializedElement>,
  diagram: Diagram,
  layer: Layer,
  nodeLookup: Record<string, DiagramNode>,
  edgeLookup: Record<string, DiagramEdge>
) => {
  const allNodes = diagramElements.filter(isNodeDef);

  // Index skeleton nodes
  for (const n of allNodes) {
    for (const c of unfoldGroup(n)) {
      if (c.type === 'edge') continue;
      nodeLookup[c.id] = new DiagramNode(
        c.id,
        c.nodeType,
        c.bounds,
        diagram,
        layer,
        c.props,
        c.anchors
      );
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
      if (c.type === 'edge') continue;
      nodeLookup[c.id].children = c.children.map(c2 => nodeLookup[c2.id]);
      if (c.parent) {
        nodeLookup[c.id].parent = nodeLookup[c.parent.id];
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
      e.waypoints ?? [],
      diagram,
      layer
    );

    if (isConnected(start)) {
      const startNode = nodeLookup[start.node.id];

      startNode.edges[start.anchor] ??= [];
      startNode.edges[start.anchor].push(edge);
    }

    if (isConnected(end)) {
      const endNode = nodeLookup[end.node.id];

      endNode.edges[end.anchor] ??= [];
      endNode.edges[end.anchor].push(edge);
    }

    if (e.labelNodes) {
      edge.labelNodes = e.labelNodes.map(ln => ({
        ...ln,
        node: nodeLookup[ln.id]
      }));
    }

    edgeLookup[e.id] = edge;
  }

  const elements: DiagramElement[] = [];
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

const deserializeDiagrams = <T extends Diagram>(
  diagrams: ReadonlyArray<SerializedDiagram>,
  factory: (d: SerializedDiagram) => T
) => {
  const dest: T[] = [];
  for (const $d of diagrams) {
    const nodeLookup: Record<string, DiagramNode> = {};
    const edgeLookup: Record<string, DiagramEdge> = {};

    const diagramElements: SerializedElement[] = [];
    for (const l of $d.layers) {
      for (const e of l.elements) {
        if (isNodeDef(e)) {
          diagramElements.push(e);
        } else if (isEdgeDef(e)) {
          diagramElements.push(e);
        }
      }
    }

    const newDiagram = factory($d);
    const uow = new UnitOfWork(newDiagram);
    for (const l of $d.layers) {
      const layer = new Layer(l.id, l.name, [], newDiagram);
      newDiagram.layers.add(layer);

      const elements = deserializeDiagramElements(
        l.elements,
        newDiagram,
        layer,
        nodeLookup,
        edgeLookup
      );
      elements.forEach(e => {
        layer.addElement(e, uow);
      });
    }
    dest.push(newDiagram);

    newDiagram.diagrams = deserializeDiagrams($d.diagrams, factory);
  }

  return dest;
};

export const deserializeDiagramDocument = <T extends Diagram>(
  document: SerializedDiagramDocument,
  factory: (d: SerializedDiagram) => T
): DiagramDocument => {
  const diagrams = document.diagrams;
  const dest = deserializeDiagrams(diagrams, factory);

  return new DiagramDocument(dest);
};

export const serializeDiagramDocument = (document: DiagramDocument): SerializedDiagramDocument => {
  return {
    diagrams: document.diagrams.map(serializeDiagram)
  };
};

export const serializeDiagram = (diagram: Diagram): SerializedDiagram => {
  return {
    id: diagram.id,
    name: diagram.name,
    layers: diagram.layers.all.map(l => serializeLayer(l)),
    diagrams: diagram.diagrams.map(d => serializeDiagram(d))
  };
};

export const serializeLayer = (layer: Layer): SerializedLayer => {
  return {
    id: layer.id,
    name: layer.name,
    type: 'layer',
    layerType: 'basic',
    elements: layer.elements.map(serializeDiagramElement)
  };
};

export const serializeDiagramElement = (element: DiagramElement): SerializedElement => {
  if (isNode(element)) {
    const node = element;
    return {
      id: node.id,
      type: 'node',
      nodeType: node.nodeType,
      bounds: node.bounds,
      anchors: node.anchors,
      children: node.children.map(serializeDiagramElement) as SerializedNode[],
      props: node.props
    };
  } else if (isEdge(element)) {
    const edge = element;
    return {
      id: edge.id,
      type: 'edge',
      start: edge.isStartConnected()
        ? {
            anchor: (edge.start as ConnectedEndpoint).anchor,
            node: { id: (edge.start as ConnectedEndpoint).node.id },
            position: edge.startPosition
          }
        : {
            position: edge.startPosition
          },
      end: edge.isEndConnected()
        ? {
            anchor: (edge.end as ConnectedEndpoint).anchor,
            node: { id: (edge.end as ConnectedEndpoint).node.id },
            position: edge.endPosition
          }
        : {
            position: edge.endPosition
          },
      waypoints: edge.waypoints,
      props: edge.props
    };
  } else {
    throw new VerifyNotReached();
  }
};
