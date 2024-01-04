import { Diagram } from '../diagram.ts';
import { DiagramNode } from '../diagramNode.ts';
import { DiagramEdge } from '../diagramEdge.ts';
import { UnitOfWork } from '../unitOfWork.ts';
import { Layer } from '../diagramLayer.ts';
import { isConnected } from './serialize.ts';
import { DiagramDocument } from '../diagramDocument.ts';
import { Point } from '../../geometry/point.ts';
import { DiagramElement } from '../diagramElement.ts';
import { VERIFY_NOT_REACHED } from '../../utils/assert.ts';
import {
  SerializedDiagram,
  SerializedDiagramDocument,
  SerializedEdge,
  SerializedElement,
  SerializedLayer,
  SerializedNode
} from './types.ts';

const isNodeDef = (element: SerializedElement | SerializedLayer): element is SerializedNode =>
  element.type === 'node';
const isEdgeDef = (element: SerializedElement | SerializedLayer): element is SerializedEdge =>
  element.type === 'edge';

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
          ...Point.add(nodeLookup[child.id].bounds, nodeLookup[child.parent.id].bounds)
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

export const deserializeDiagramDocument = <T extends Diagram>(
  document: SerializedDiagramDocument,
  factory: (d: SerializedDiagram) => T
): DiagramDocument => {
  const diagrams = document.diagrams;
  const dest = deserializeDiagrams(diagrams, factory);

  return new DiagramDocument(dest);
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
