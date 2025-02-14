import { Diagram } from '../diagram';
import { DiagramNode } from '../diagramNode';
import { DiagramEdge } from '../diagramEdge';
import { UnitOfWork } from '../unitOfWork';
import { Layer, RegularLayer } from '../diagramLayer';
import { isSerializedEndpointAnchor, isSerializedEndpointConnected } from './serialize';
import { DiagramDocument } from '../diagramDocument';
import { DiagramElement } from '../diagramElement';
import { VERIFY_NOT_REACHED, VerifyNotReached } from '@diagram-craft/utils/assert';
import {
  SerializedAnchorEndpoint,
  SerializedDiagram,
  SerializedDiagramDocument,
  SerializedElement,
  SerializedFreeEndpoint,
  SerializedLayer,
  SerializedNode,
  SerializedPointInNodeEndpoint,
  SerializedStylesheet
} from './types';
import { Endpoint } from '../endpoint';
import { Waypoint } from '../types';
import { Stylesheet } from '../diagramStyles';
import { DefaultStyles } from '../diagramDefaults';
import { ReferenceLayer } from '../diagramLayerReference';
import { RuleLayer } from '../diagramLayerRule';
import { DataProviderRegistry } from '../dataProvider';
import { DiagramDocumentDataTemplates } from '../diagramDocumentDataTemplates';

const isNodeDef = (element: SerializedElement | SerializedLayer): element is SerializedNode =>
  element.type === 'node';

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
    return [...recurse(node.children ?? [], node), { ...node }];
  } else {
    return [{ ...node }];
  }
};

const deserializeEndpoint = (
  e: SerializedAnchorEndpoint | SerializedPointInNodeEndpoint | SerializedFreeEndpoint,
  nodeLookup: Record<string, DiagramNode> | Map<string, DiagramNode>
) => {
  return Endpoint.deserialize(e, nodeLookup);
};

export const deserializeDiagramElements = (
  diagramElements: ReadonlyArray<SerializedElement>,
  diagram: Diagram,
  layer: Layer,
  nodeLookup?: Record<string, DiagramNode>,
  edgeLookup?: Record<string, DiagramEdge>
) => {
  nodeLookup ??= {};
  edgeLookup ??= {};

  const allNodes = diagramElements.filter(isNodeDef);

  // Index skeleton nodes
  for (const n of allNodes) {
    for (const c of unfoldGroup(n)) {
      if (c.type === 'edge') continue;

      // Note: this is for backwards compatibility only
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textProps: any = c.props.text;
      if (textProps && textProps.text && (!c.texts || !c.texts.text)) {
        c.texts ??= { text: textProps.text };
        c.texts.text = textProps.text;
        delete textProps.text;
      }

      nodeLookup[c.id] = new DiagramNode(
        c.id,
        c.nodeType,
        c.bounds,
        diagram,
        layer,
        c.props,
        {
          style: c.nodeType === 'text' ? DefaultStyles.node.text : DefaultStyles.node.default,
          ...c.metadata
        },
        c.texts,
        c.anchors
      );
    }
  }

  // Resolve relations
  const uow = new UnitOfWork(diagram, false, true);
  for (const n of allNodes) {
    for (const c of unfoldGroup(n)) {
      if (c.type === 'edge') continue;
      nodeLookup[c.id].setChildren(c.children?.map(c2 => nodeLookup[c2.id]) ?? [], uow);
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
      e.props,
      {
        style: 'default-edge',
        ...e.metadata
      },
      (e.waypoints ?? []) as Array<Waypoint>,
      diagram,
      layer
    );

    if (isSerializedEndpointAnchor(start)) {
      const startNode = nodeLookup[start.node.id];
      startNode.edges.set(start.anchor, [...(startNode.edges.get(start.anchor) ?? []), edge]);
    } else if (isSerializedEndpointConnected(start)) {
      const startNode = nodeLookup[start.node.id];
      startNode.edges.set(undefined, [...(startNode.edges.get(undefined) ?? []), edge]);
    }

    if (isSerializedEndpointAnchor(end)) {
      const endNode = nodeLookup[end.node.id];
      endNode.edges.set(end.anchor, [...(endNode.edges.get(end.anchor) ?? []), edge]);
    } else if (isSerializedEndpointConnected(end)) {
      const endNode = nodeLookup[end.node.id];
      endNode.edges.set(undefined, [...(endNode.edges.get(undefined) ?? []), edge]);
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

  if (document.customPalette) {
    for (let i = 0; i < document.customPalette.length; i++) {
      doc.customPalette.setColor(i, document.customPalette[i]);
    }
  }

  if (document.styles) {
    for (const edgeStyle of document.styles.edgeStyles) {
      doc.styles.addStylesheet(deserializeStylesheet(edgeStyle));
    }
    for (const nodeStyle of document.styles.nodeStyles) {
      doc.styles.addStylesheet(deserializeStylesheet(nodeStyle));
    }
  }

  if (document.schemas) {
    for (const schema of document.schemas) {
      doc.schemas.addSchema(schema);
    }
  }

  const dest = deserializeDiagrams(doc, diagrams, diagramFactory);
  dest.forEach(d => doc.addDiagram(d));

  if (document.attachments) {
    for (const val of Object.values(document.attachments)) {
      const buf = Uint8Array.from(atob(val), c => c.charCodeAt(0));
      await doc.attachments.addAttachment(new Blob([buf]));
    }
  }

  if (document.data?.providerId) {
    const provider = DataProviderRegistry.get(document.data.providerId);
    if (provider) {
      doc.dataProvider = provider(document.data.data!);
    } else {
      console.warn(`Provider ${document.data.providerId} not found`);
    }
  }

  doc.dataTemplates = new DiagramDocumentDataTemplates(doc, document.dataTemplates);

  return doc;
};

const deserializeStylesheet = (s: SerializedStylesheet) => {
  return new Stylesheet(s.type, s.id, s.name, s.props);
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

    const newDiagram = diagramFactory($d, doc);
    newDiagram.canvas = $d.canvas;

    const uow = new UnitOfWork(newDiagram);
    for (const l of $d.layers) {
      if (l.layerType === 'regular' || l.layerType === 'basic') {
        const layer = new RegularLayer(l.id, l.name, [], newDiagram);
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
      } else if (l.layerType === 'reference') {
        const layer = new ReferenceLayer(l.id, l.name, newDiagram, {
          diagramId: l.diagramId,
          layerId: l.layerId
        });
        newDiagram.layers.add(layer, UnitOfWork.immediate(newDiagram));
      } else if (l.layerType === 'rule') {
        const layer = new RuleLayer(l.id, l.name, newDiagram, l.rules ?? []);
        newDiagram.layers.add(layer, UnitOfWork.immediate(newDiagram));
      } else {
        throw new VerifyNotReached();
      }
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
