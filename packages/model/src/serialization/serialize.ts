import { Diagram } from '../diagram';
import { DiagramDocument } from '../diagramDocument';
import { Layer } from '../diagramLayer';
import { DiagramElement, isEdge, isNode } from '../diagramElement';
import {
  SerializedConnectedEndpoint,
  SerializedDiagram,
  SerializedDiagramDocument,
  SerializedElement,
  SerializedEndpoint,
  SerializedLayer,
  SerializedNode
} from './types';
import { ConnectedEndpoint } from '../endpoint';
import { VerifyNotReached } from '@diagram-craft/utils/assert';
import { AttachmentManager } from '../attachment';

export const isSerializedEndpointConnected = (
  endpoint: SerializedEndpoint
): endpoint is SerializedConnectedEndpoint => 'node' in endpoint;

export const serializeDiagramDocument = async (
  document: DiagramDocument
): Promise<SerializedDiagramDocument> => {
  return {
    diagrams: document.diagrams.map(serializeDiagram),
    attachments: await serializeAttachments(document.attachments)
  };
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
      start: isSerializedEndpointConnected(edge.start)
        ? {
            anchor: (edge.start as ConnectedEndpoint).anchor,
            node: { id: (edge.start as ConnectedEndpoint).node.id },
            position: edge.start.position
          }
        : {
            position: edge.start.position
          },
      end: isSerializedEndpointConnected(edge.end)
        ? {
            anchor: (edge.end as ConnectedEndpoint).anchor,
            node: { id: (edge.end as ConnectedEndpoint).node.id },
            position: edge.end.position
          }
        : {
            position: edge.end.position
          },
      labelNodes: edge.labelNodes?.map(e => ({
        id: e.id,
        type: e.type,
        offset: e.offset,
        timeOffset: e.timeOffset
      })),
      waypoints: edge.waypoints,
      props: edge.props
    };
  } else {
    throw new VerifyNotReached();
  }
};
