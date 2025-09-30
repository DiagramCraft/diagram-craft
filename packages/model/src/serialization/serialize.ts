import { Diagram } from '../diagram';
import { DiagramDocument } from '../diagramDocument';
import { Layer } from '../diagramLayer';
import { DiagramElement, isEdge, isNode } from '../diagramElement';
import {
  SerializedDiagram,
  SerializedDiagramDocument,
  SerializedElement,
  SerializedLayer,
  SerializedNode,
  SerializedStyles
} from './types';
import { NotImplementedYet, VerifyNotReached } from '@diagram-craft/utils/assert';
import { AttachmentManager } from '../attachment';
import { DiagramPalette } from '../diagramPalette';
import { DiagramStyles } from '../diagramStyles';
import { DiagramDocumentDataSchemas, type SchemaMetadata } from '../diagramDocumentDataSchemas';
import { ReferenceLayer } from '../diagramLayerReference';
import { RuleLayer } from '../diagramLayerRule';
import { RegularLayer } from '../diagramLayerRegular';
import { CommentManager, SerializedComment } from '../comment';
import { hash64 } from '@diagram-craft/utils/hash';

export const serializeDiagramDocument = async (
  document: DiagramDocument
): Promise<SerializedDiagramDocument> => {
  const schemaMetadata = serializeSchemaMetadata(document.data._schemas);
  const serialized = {
    diagrams: document.diagrams.map(serializeDiagram),
    attachments: await serializeAttachments(document.attachments),
    customPalette: serializeCustomPalette(document.customPalette),
    styles: serializeStyles(document.styles),
    schemas: serializeSchemas(document.data._schemas),
    ...(Object.keys(schemaMetadata).length > 0 && { schemaMetadata }),
    props: {
      query: {
        history: document.props.query.history,
        saved: document.props.query.saved
      },
      stencils: document.props.recentStencils.stencils
    },
    data: {
      providers: document.data.providers.map(p => ({
        id: p.id,
        providerId: p.providerId,
        data: p.serialize()
      })),
      templates: document.data.templates.all
    }
  };

  // Generate hash based on the serialized JSON (excluding any existing hash)
  const jsonString = JSON.stringify(serialized);
  const jsonBytes = new TextEncoder().encode(jsonString);
  const hashValue = hash64(jsonBytes);

  // Set the hash on both the serialized data and the original document
  document.hash = hashValue;

  return {
    ...serialized,
    hash: hashValue
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

const serializeSchemas = (schemas: DiagramDocumentDataSchemas) => {
  return schemas.all;
};

const serializeSchemaMetadata = (schemas: DiagramDocumentDataSchemas) => {
  const acc: Record<string, SchemaMetadata> = {};
  for (const schema of schemas.all) {
    acc[schema.id] = schemas.getMetadata(schema.id);
  }
  return acc;
};

const serializeComments = (commentManager: CommentManager): SerializedComment[] => {
  return commentManager.getAll().map(comment => comment.serialize());
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
    activeLayerId: diagram.activeLayer.id,
    diagrams: diagram.diagrams.map(d => serializeDiagram(d)),
    guides: diagram.guides.length > 0 ? diagram.guides : undefined,
    comments: serializeComments(diagram.commentManager),
    zoom: {
      x: diagram.viewBox.offset.x,
      y: diagram.viewBox.offset.y,
      zoom: diagram.viewBox.zoomLevel
    },
    canvas: diagram.canvas
  };
};

export const serializeLayer = (layer: Layer): SerializedLayer => {
  if (layer.type === 'regular') {
    return {
      id: layer.id,
      name: layer.name,
      type: 'layer',
      layerType: 'regular',
      elements: (layer as RegularLayer).elements.map(serializeDiagramElement)
    };
  } else if (layer.type === 'reference') {
    return {
      id: layer.id,
      name: layer.name,
      type: 'layer',
      layerType: 'reference',
      layerId: (layer as ReferenceLayer).reference.layerId,
      diagramId: (layer as ReferenceLayer).reference.diagramId
    };
  } else if (layer.type === 'rule') {
    return {
      id: layer.id,
      name: layer.name,
      type: 'layer',
      layerType: 'rule',
      rules: (layer as RuleLayer).rules
    };
  } else {
    throw new NotImplementedYet();
  }
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
      props: node.storedPropsCloned,
      metadata: node.metadataCloned,
      texts: node.textsCloned,
      tags: node.tags.length > 0 ? node.tags : undefined
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
      props: edge.storedPropsCloned,
      metadata: edge.metadataCloned,
      children: edge.children.map(serializeDiagramElement) as SerializedNode[],
      tags: edge.tags.length > 0 ? edge.tags : undefined
    };
  } else {
    throw new VerifyNotReached();
  }
};
