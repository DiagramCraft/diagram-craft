import type { Guide, LabelNode, Waypoint } from '../types';
import { Point } from '@diagram-craft/geometry/point';
import type { EdgePropsForEditing } from '../diagramEdge';
import type { NodePropsForEditing, NodeTexts } from '../diagramNode';
import type { OffsetType } from '../endpoint';
import type { StylesheetSnapshot } from '../unitOfWork';
import type { DataSchema, SchemaMetadata } from '../diagramDocumentDataSchemas';
import type { Canvas } from '../diagram';
import type { AdjustmentRule } from '../diagramLayerRuleTypes';
import type { DataTemplate } from '../diagramDocument';
import type { SerializedComment } from '../comment';
import type { QueryEntry } from '../documentProps';
import type { ModificationType } from '../diagramLayerModification';
import { Box } from '@diagram-craft/geometry/box';
import { Anchor } from '../anchor';
import type { Story } from '../documentStories';

export interface Reference {
  id: string;
}

export type SerializedLayer = { id: string; name: string; type: 'layer' } & (
  | {
      layerType: 'regular' | 'basic';
      elements: ReadonlyArray<SerializedElement>;
      isLocked?: boolean;
    }
  | {
      layerType: 'reference';
      diagramId: string;
      layerId: string;
    }
  | {
      layerType: 'rule';
      rules: ReadonlyArray<AdjustmentRule>;
    }
  | {
      layerType: 'modification';
      modifications: ReadonlyArray<{
        id: string;
        type: ModificationType;
        element?: SerializedElement;
      }>;
      isLocked?: boolean;
    }
);

export type SerializedDiagram = {
  id: string;
  name: string;
  layers: ReadonlyArray<SerializedLayer>;
  activeLayerId?: string;
  visibleLayers?: string[];
  diagrams: ReadonlyArray<SerializedDiagram>;
  guides?: ReadonlyArray<Guide>;
  zoom?: {
    x: number;
    y: number;
    zoom: number;
  };
  canvas: Canvas;
  comments?: ReadonlyArray<SerializedComment>;
};

export type SerializedStory = Story;

export interface SerializedDiagramDocument {
  diagrams: ReadonlyArray<SerializedDiagram>;
  attachments?: Record<string, string>;
  customPalette: ReadonlyArray<string>;
  styles: SerializedStyles;
  schemas: ReadonlyArray<DataSchema>;
  schemaMetadata?: Record<string, SchemaMetadata>;
  props?: {
    stencils?: ReadonlyArray<string>;
    query?: {
      history?: ReadonlyArray<QueryEntry>;
      saved?: ReadonlyArray<QueryEntry>;
    };
  };
  data?: {
    providers?: Array<{
      id: string;
      providerId: string;
      data: string;
    }>;
    templates: DataTemplate[];
    overrides?: Record<string, Record<string, SerializedOverride>>;
  };
  stories?: ReadonlyArray<SerializedStory>;
  hash?: string;
}

export type SerializedOverride = {
  type: 'add' | 'update' | 'delete';
  data: Record<string, string> & { _uid: string };
};

export interface SerializedStyles {
  edgeStyles: ReadonlyArray<SerializedStylesheet>;
  nodeStyles: ReadonlyArray<SerializedStylesheet>;
}

export type SerializedStylesheet = Omit<StylesheetSnapshot, '_snapshotType'>;

export interface SerializedNode {
  type: 'node' | 'delegating-node';
  nodeType: 'group' | string;
  id: string;
  bounds: Box;
  anchors?: ReadonlyArray<Anchor>;

  edges?: Record<string, ReadonlyArray<Reference>>;
  children?: ReadonlyArray<SerializedElement>;
  props: NodePropsForEditing;
  metadata: ElementMetadata;
  texts: NodeTexts;
  tags?: ReadonlyArray<string>;
}

export type SerializedPointInNodeEndpoint = {
  ref?: Point;
  node: Reference;
  position?: Point;
  offset: Point;
  offsetType?: OffsetType;
};
export type SerializedAnchorEndpoint = {
  anchor: string;
  node: Reference;
  position?: Point;
  offset: Point;
};
export type SerializedFreeEndpoint = { position: Point };

export type SerializedEndpoint =
  | SerializedAnchorEndpoint
  | SerializedPointInNodeEndpoint
  | SerializedFreeEndpoint;

export interface SerializedEdge {
  id: string;
  type: 'edge' | 'delegating-edge';
  waypoints?: ReadonlyArray<Waypoint>;
  labelNodes?: ReadonlyArray<LabelNode>;

  start: SerializedEndpoint;
  end: SerializedEndpoint;
  props: EdgePropsForEditing;
  metadata: ElementMetadata;
  children?: ReadonlyArray<SerializedElement>;
  tags?: ReadonlyArray<string>;
}

export type SerializedElement = SerializedNode | SerializedEdge;
