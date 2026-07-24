import { Diagram } from '../diagram';
import { DiagramDocument } from '../diagramDocument';
import { Layer } from '../diagramLayer';
import { DiagramElement, isEdge, isNode } from '../diagramElement';
import type { DiagramNode } from '../diagramNode';
import {
  SerializedDiagram,
  SerializedDiagramDocument,
  SerializedElement,
  SerializedLayer,
  type SerializedModificationElement,
  SerializedNode,
  type SerializedOverride,
  type SerializedRegularElement,
  SerializedStyles
} from './serializedTypes';
import { NotImplementedYet, VerifyNotReached } from '@diagram-craft/utils/assert';
import { AttachmentManager } from '../attachment';
import { DiagramPalette } from '../diagramPalette';
import { DiagramStyles } from '../diagramStyles';
import { DiagramDocumentDataSchemas, type SchemaMetadata } from '../diagramDocumentDataSchemas';
import { ReferenceLayer } from '../diagramLayerReference';
import { RuleLayer } from '../diagramLayerRule';
import { RegularLayer } from '../diagramLayerRegular';
import { ModificationLayer } from '../diagramLayerModification';
import { CommentManager, SerializedComment } from '../comment';
import { hash64 } from '@diagram-craft/utils/hash';
import type { DataManager } from '../diagramDocumentData';

export type SerializeDiagramOptions = {
  anchorMode?: 'resolved' | 'stored';
};

export const serializeDiagramDocument = async (
  document: DiagramDocument,
  options: SerializeDiagramOptions = {}
): Promise<SerializedDiagramDocument> => {
  const schemaMetadata = serializeSchemaMetadata(document.data._schemas);
  const stories = document.stories.stories;
  const serialized = {
    diagrams: document.diagrams.map(diagram => serializeDiagram(diagram, options)),
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
      stencils: document.props.recentStencils.stencils,
      activeStencilPackages: document.props.activeStencilPackages.ids,
      recentEdgeStylesheets: document.props.recentEdgeStylesheets.stylesheets,
      metadata: document.props.metadata.getAll()
    },
    data: {
      providers: document.data.providers.map(p => ({
        id: p.id,
        providerId: p.providerId,
        data: p.serialize()
      })),
      templates: document.data.templates.all,
      overrides: serializeOverrides(document.data.db)
    },
    ...(stories.length > 0 && { stories }),
    activeDiagramId: document.activeDiagramId,
    isLocked: document.locked ? true : undefined
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
    nodeStyles: styles.nodeStyles.map(e => e.snapshot()),
    textStyles: styles.textStyles.map(e => e.snapshot())
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

export const serializeDiagram = (
  diagram: Diagram,
  options: SerializeDiagramOptions = {}
): SerializedDiagram => {
  return {
    id: diagram.id,
    name: diagram.name,
    layers: diagram.layers.all.map(l => serializeLayer(l, options)),
    activeLayerId: diagram.activeLayer.id,
    visibleLayers: diagram.layers.visible.map(l => l.id),
    views: diagram.views.all.length > 0 ? diagram.views.all : undefined,
    diagrams: diagram.diagrams.map(d => serializeDiagram(d, options)),
    guides: diagram.guides.length > 0 ? diagram.guides : undefined,
    comments: serializeComments(diagram.commentManager),
    zoom: {
      x: diagram.viewBox.offset.x,
      y: diagram.viewBox.offset.y,
      zoom: diagram.viewBox.zoomLevel
    },
    canvas: diagram.bounds,
    isLocked: diagram.locked ? true : undefined
  };
};

export const serializeLayer = (
  layer: Layer,
  options: SerializeDiagramOptions = {}
): SerializedLayer => {
  if (layer.type === 'regular') {
    return {
      id: layer.id,
      name: layer.name,
      type: 'layer',
      layerType: 'regular',
      elements: (layer as RegularLayer).elements.map(
        element => serializeDiagramElement(element, options) as SerializedRegularElement
      ),
      isLocked: layer.locked
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
  } else if (layer.type === 'modification') {
    return {
      id: layer.id,
      name: layer.name,
      type: 'layer',
      layerType: 'modification',
      modifications: (layer as ModificationLayer).modifications.map(m => ({
        id: m.id,
        type: m.type,
        element: m.element
          ? (serializeDiagramElement(m.element, options) as SerializedModificationElement)
          : undefined
      })),
      isLocked: layer.locked
    };
  } else {
    throw new NotImplementedYet();
  }
};

const serializeNodeAnchors = (node: DiagramNode, options: SerializeDiagramOptions) => {
  if (options.anchorMode === 'stored') {
    return node.getStoredAnchors() ?? [];
  } else {
    return node.anchors;
  }
};

export const serializeDiagramElement = (
  element: DiagramElement,
  options: SerializeDiagramOptions = {}
): SerializedElement => {
  if (isNode(element)) {
    const node = element;
    return {
      id: node.id,
      type: node.type as 'node' | 'delegating-node',
      nodeType: node.nodeType,
      bounds: node.bounds,
      anchors: serializeNodeAnchors(node, options),
      children: node.children.map(child =>
        serializeDiagramElement(child, options)
      ) as SerializedNode[],
      props: node.storedProps,
      metadata: node.metadata,
      texts: node.texts,
      tags: node.tags.length > 0 ? node.tags : undefined,
      isLocked: node.locked ? true : undefined
    };
  } else if (isEdge(element)) {
    const edge = element;
    return {
      id: edge.id,
      type: edge.type as 'edge' | 'delegating-edge',
      start: edge.start.serialize(),
      end: edge.end.serialize(),
      labelNodes: edge.labelNodes?.map(e => ({
        id: e.id,
        type: e.type,
        offset: e.offset,
        offsetType: e.offsetType,
        timeOffset: e.timeOffset
      })),
      waypoints: edge.waypoints,
      props: edge.storedProps,
      metadata: edge.metadata,
      children: edge.children.map(child =>
        serializeDiagramElement(child, options)
      ) as SerializedNode[],
      tags: edge.tags.length > 0 ? edge.tags : undefined,
      isLocked: edge.locked ? true : undefined
    };
  } else {
    throw new VerifyNotReached();
  }
};

const serializeOverrides = (db: DataManager) => {
  const dest: Record<string, Record<string, SerializedOverride>> = {};

  for (const [schemaId, schemaOverrides] of db.getOverrides().entries()) {
    const serializedSchemaOverrides: Record<string, SerializedOverride> = {};
    dest[schemaId] = serializedSchemaOverrides;

    for (const [uid, operation] of schemaOverrides.entries()) {
      serializedSchemaOverrides[uid] = { ...operation };
    }
  }

  return dest;
};
