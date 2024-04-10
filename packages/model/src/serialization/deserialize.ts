import { Diagram } from '../diagram';
import { DiagramNode } from '../diagramNode';
import { DiagramEdge } from '../diagramEdge';
import { UnitOfWork } from '../unitOfWork';
import { Layer } from '../diagramLayer';
import { isSerializedEndpointConnected } from './serialize';
import { DiagramDocument } from '../diagramDocument';
import { DiagramElement } from '../diagramElement';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils';
import {
  SerializedDiagram,
  SerializedDiagramDocument,
  SerializedEdge,
  SerializedElement,
  SerializedLayer,
  SerializedNode
} from './types';
import { ConnectedEndpoint, FreeEndpoint } from '../endpoint';
import { Waypoint } from '../types';
import { Point } from '@diagram-craft/geometry/point';

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
        {
          style: c.nodeType === 'text' ? 'default-text' : 'default',
          ...c.props
        },
        c.anchors
      );
    }
  }

  // Resolve relative positions
  for (const n of allNodes) {
    for (const child of unfoldGroup(n)) {
      if (child.parent) {
        nodeLookup[child.id].setBounds(
          {
            ...nodeLookup[child.id].bounds,
            ...Point.add(nodeLookup[child.id].bounds, nodeLookup[child.parent.id].bounds)
          },
          new UnitOfWork(diagram)
        );
      }
    }
  }

  // Resolve relations
  for (const n of allNodes) {
    for (const c of unfoldGroup(n)) {
      if (c.type === 'edge') continue;
      nodeLookup[c.id].setChildren(
        c.children.map(c2 => nodeLookup[c2.id]),
        new UnitOfWork(diagram)
      );
      if (c.parent) {
        nodeLookup[c.id]._setParent(nodeLookup[c.parent.id]);
      }
    }
  }

  for (const e of diagramElements) {
    if (e.type !== 'edge') continue;

    const start = e.start;
    const end = e.end;

    const edge = new DiagramEdge(
      e.id,
      isSerializedEndpointConnected(start)
        ? new ConnectedEndpoint(start.anchor, nodeLookup[start.node.id])
        : new FreeEndpoint(start.position),
      isSerializedEndpointConnected(end)
        ? new ConnectedEndpoint(end.anchor, nodeLookup[end.node.id])
        : new FreeEndpoint(end.position),
      {
        style: 'default-edge',
        ...e.props
      },
      (e.waypoints ?? []) as Array<Waypoint>,
      diagram,
      layer
    );

    if (isSerializedEndpointConnected(start)) {
      const startNode = nodeLookup[start.node.id];
      startNode.edges.set(start.anchor, [...(startNode.edges.get(start.anchor) ?? []), edge]);
    }

    if (isSerializedEndpointConnected(end)) {
      const endNode = nodeLookup[end.node.id];
      endNode.edges.set(end.anchor, [...(endNode.edges.get(end.anchor) ?? []), edge]);
    }

    edgeLookup[e.id] = edge;

    if (e.labelNodes) {
      // Note, we don't commit the UOW here
      edge.setLabelNodes(
        e.labelNodes.map(ln => ({
          ...ln,
          node: nodeLookup[ln.id]
        })),
        new UnitOfWork(diagram)
      );
    }
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
      newDiagram.layers.add(layer, UnitOfWork.throwaway(newDiagram));

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

      layer.elements.forEach(e => e.invalidate(uow));
    }
    dest.push(newDiagram);

    newDiagram.diagrams = deserializeDiagrams($d.diagrams, factory);
  }

  return dest;
};
