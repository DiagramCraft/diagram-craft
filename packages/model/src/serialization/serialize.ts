import { Diagram } from '../diagram';
import { DiagramDocument } from '../diagramDocument';
import { Layer } from '../diagramLayer';
import { DiagramElement, isEdge, isNode } from '../diagramElement';
import {
  SerializedAnchorEndpoint,
  SerializedDiagram,
  SerializedDiagramDocument,
  SerializedElement,
  SerializedEndpoint,
  SerializedPointInNodeEndpoint,
  SerializedFreeEndpoint,
  SerializedLayer,
  SerializedNode,
  SerializedStyles
} from './types';
import { VerifyNotReached } from '@diagram-craft/utils/assert';
import { AttachmentManager } from '../attachment';
import { DiagramPalette } from '../diagramPalette';
import { DiagramStyles } from '../diagramStyles';
import { DiagramDataSchemas } from '../diagramDataSchemas';

export const isSerializedEndpointAnchor = (
  endpoint: SerializedEndpoint
): endpoint is SerializedAnchorEndpoint => 'node' in endpoint && 'anchor' in endpoint;

export const isSerializedEndpointConnected = (
  endpoint: SerializedEndpoint
): endpoint is SerializedPointInNodeEndpoint => 'node' in endpoint && !('anchor' in endpoint);

export const isSerializedEndpointFree = (
  endpoint: SerializedEndpoint
): endpoint is SerializedFreeEndpoint => !('node' in endpoint);

export const serializeDiagramDocument = async (
  document: DiagramDocument
): Promise<SerializedDiagramDocument> => {
  return {
    diagrams: document.diagrams.map(serializeDiagram),
    attachments: await serializeAttachments(document.attachments),
    customPalette: serializeCustomPalette(document.customPalette),
    styles: serializeStyles(document.styles),
    schemas: serializeSchemas(document.schemas)
  };
};

const serializeCustomPalette = (customPalette: DiagramPalette): string[] => {
  return customPalette.colors;
};

const serializeStyles = (styles: DiagramStyles): SerializedStyles => {
  return {
    edgeStyles: styles.edgeStyles.map(e => e.snapshot()),
    nodeStyles: styles.nodeStyles.map(e => e.snapshot())
  };
};

const serializeSchemas = (schemas: DiagramDataSchemas) => {
  return schemas.all;
};

const serializeAttachments = async (
  attachments: AttachmentManager
): Promise<Record<string, string>> => {
  attachments.pruneAttachments();

  const dest: Record<string, string> = {};
  for (const [hash, attachment] of attachments.attachments) {
    if (attachment.inUse) {
      const buf = await attachment.content.arrayBuffer();
      dest[hash] = btoa(
        Array.from(new Uint8Array(buf))
          .map(b => String.fromCharCode(b))
          .join('')
      );
    }
  }

  return dest;
};

export const serializeDiagram = (diagram: Diagram): SerializedDiagram => {
  return {
    id: diagram.id,
    name: diagram.name,
    layers: diagram.layers.all.map(l => serializeLayer(l)),
    diagrams: diagram.diagrams.map(d => serializeDiagram(d)),
    zoom: {
      x: diagram.viewBox.offset.x,
      y: diagram.viewBox.offset.y,
      zoom: diagram.viewBox.zoomLevel
    }
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
      props: node.storedProps,
      metadata: node.metadata,
      texts: node.texts
    };
  } else if (isEdge(element)) {
    const edge = element;
    return {
      id: edge.id,
      type: 'edge',
      start: edge.start.serialize(),
      end: edge.end.serialize(),
      labelNodes: edge.labelNodes?.map(e => ({
        id: e.id,
        type: e.type,
        offset: e.offset,
        timeOffset: e.timeOffset
      })),
      waypoints: edge.waypoints,
      props: edge.storedProps,
      metadata: edge.metadata
    };
  } else {
    throw new VerifyNotReached();
  }
};
