import { AbstractEdge, AbstractNode } from '../types';
import { Point } from '@diagram-craft/geometry/point';
import { EdgePropsForEditing } from '../diagramEdge';
import { NodePropsForEditing, NodeTexts } from '../diagramNode';
import { OffsetType } from '../endpoint';
import { StylesheetSnapshot } from '../unitOfWork';
import { DataSchema } from '../diagramDocumentDataSchemas';
import { Canvas } from '../diagram';
import { AdjustmentRule } from '../diagramLayerRuleTypes';
import { DataTemplate } from '../diagramDocument';

interface Reference {
  id: string;
}

export type SerializedLayer = { id: string; name: string; type: 'layer' } & (
  | {
      layerType: 'regular' | 'basic';
      elements: ReadonlyArray<SerializedElement>;
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
);

export type SerializedDiagram = {
  id: string;
  name: string;
  layers: ReadonlyArray<SerializedLayer>;
  activeLayerId?: string;
  diagrams: ReadonlyArray<SerializedDiagram>;
  zoom?: {
    x: number;
    y: number;
    zoom: number;
  };
  canvas: Canvas;
};

export interface SerializedDiagramDocument {
  diagrams: ReadonlyArray<SerializedDiagram>;
  attachments?: Record<string, string>;
  customPalette: ReadonlyArray<string>;
  styles: SerializedStyles;
  schemas: ReadonlyArray<DataSchema>;
  data?: {
    providerId?: string;
    data?: string;
    templates: DataTemplate[];
  };
}

export interface SerializedStyles {
  edgeStyles: ReadonlyArray<SerializedStylesheet>;
  nodeStyles: ReadonlyArray<SerializedStylesheet>;
}

export type SerializedStylesheet = Omit<StylesheetSnapshot, '_snapshotType'>;

export interface SerializedNode extends AbstractNode {
  edges?: Record<string, ReadonlyArray<Reference>>;
  children?: ReadonlyArray<SerializedElement>;
  props: NodePropsForEditing;
  metadata: ElementMetadata;
  texts: NodeTexts;
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

export interface SerializedEdge extends AbstractEdge {
  start: SerializedEndpoint;
  end: SerializedEndpoint;
  props: EdgePropsForEditing;
  metadata: ElementMetadata;
}

export type SerializedElement = SerializedNode | SerializedEdge;
