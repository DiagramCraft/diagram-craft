import { Diagram } from '../diagram';
import { DiagramNode } from '../diagramNode';
import { DiagramEdge } from '../diagramEdge';
import { UnitOfWork } from '../unitOfWork';
import { Layer } from '../diagramLayer';
import { isSerializedEndpointConnected, isSerializedEndpointFixed } from './serialize';
import { DiagramDocument } from '../diagramDocument';
import { DiagramElement } from '../diagramElement';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import {
  SerializedConnectedEndpoint,
  SerializedDiagram,
  SerializedDiagramDocument,
  SerializedEdge,
  SerializedElement,
  SerializedFixedEndpoint,
  SerializedFreeEndpoint,
  SerializedLayer,
  SerializedNode
} from './types';
import { ConnectedEndpoint, FixedEndpoint, FreeEndpoint } from '../endpoint';
import { Waypoint } from '../types';

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
      ...nodes.flatMap(n => (n.type === 'node' ? recurse(n.children ?? [], n) : []))
    ];
  };

  if ((node.children ?? []).length > 0) {
    return [{ ...node }, ...recurse(node.children ?? [], node)];
  } else {
    return [{ ...node }];
  }
};

const deserializeEndpoint = (
  e: SerializedConnectedEndpoint | SerializedFixedEndpoint | SerializedFreeEndpoint,
  nodeLookup: Record<string, DiagramNode>
) => {
  if (isSerializedEndpointConnected(e)) {
    return new ConnectedEndpoint(e.anchor, nodeLookup[e.node.id]);
  } else if (isSerializedEndpointFixed(e)) {
    return new FixedEndpoint(e.anchor, e.offset, nodeLookup[e.node.id]);
  } else {
    return new FreeEndpoint(e.position);
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

  // Resolve relations
  for (const n of allNodes) {
    for (const c of unfoldGroup(n)) {
      if (c.type === 'edge') continue;
      nodeLookup[c.id].setChildren(
        c.children?.map(c2 => nodeLookup[c2.id]) ?? [],
        UnitOfWork.immediate(diagram)
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

    const startEndpoint = deserializeEndpoint(start, nodeLookup);
    const endEndpoint = deserializeEndpoint(end, nodeLookup);

    const edge = new DiagramEdge(
      e.id,
      startEndpoint,
      endEndpoint,
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
        UnitOfWork.immediate(diagram)
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

export type DocumentFactory = () => DiagramDocument;
export type DiagramFactory<T extends Diagram> = (d: SerializedDiagram, doc: DiagramDocument) => T;

export const deserializeDiagramDocument = async <T extends Diagram>(
  document: SerializedDiagramDocument,
  documentFactory: DocumentFactory,
  diagramFactory: DiagramFactory<T>
): Promise<DiagramDocument> => {
  const diagrams = document.diagrams;

  const doc = documentFactory();
  const dest = deserializeDiagrams(doc, diagrams, diagramFactory);
  dest.forEach(d => doc.addDiagram(d));

  if (document.attachments) {
    for (const val of Object.values(document.attachments)) {
      const buf = Uint8Array.from(atob(val), c => c.charCodeAt(0));
      await doc.attachments.addAttachment(new Blob([buf]));
    }
  }

  return doc;
};

const deserializeDiagrams = <T extends Diagram>(
  doc: DiagramDocument,
  diagrams: ReadonlyArray<SerializedDiagram>,
  diagramFactory: DiagramFactory<T>
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

    const newDiagram = diagramFactory($d, doc);

    const uow = new UnitOfWork(newDiagram);
    for (const l of $d.layers) {
      const layer = new Layer(l.id, l.name, [], newDiagram);
      newDiagram.layers.add(layer, UnitOfWork.immediate(newDiagram));

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

    if ($d.zoom) {
      newDiagram.viewBox.zoom($d.zoom.zoom);
      newDiagram.viewBox.pan({ x: $d.zoom.x, y: $d.zoom.y });
    }
    dest.push(newDiagram);
    uow.commit();

    newDiagram.diagrams = deserializeDiagrams(doc, $d.diagrams, diagramFactory);
  }

  return dest;
};
