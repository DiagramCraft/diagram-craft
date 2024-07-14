import { AbstractEdge, AbstractNode } from '../types';
import { Point } from '@diagram-craft/geometry/point';
import { EdgePropsForEditing } from '../diagramEdge';
import { NodePropsForEditing } from '../diagramNode';
import { OffsetType } from '../endpoint';

interface Reference {
  id: string;
}

export type SerializedLayer = {
  id: string;
  name: string;
  type: 'layer';
  layerType: 'basic' | 'reference' | 'adjustment';
  elements: ReadonlyArray<SerializedElement>;
};

export type SerializedDiagram = {
  id: string;
  name: string;
  layers: ReadonlyArray<SerializedLayer>;
  diagrams: ReadonlyArray<SerializedDiagram>;
  zoom?: {
    x: number;
    y: number;
    zoom: number;
  };
};

export interface SerializedDiagramDocument {
  diagrams: ReadonlyArray<SerializedDiagram>;
  attachments?: Record<string, string>;
}

export interface SerializedNode extends AbstractNode {
  edges?: Record<string, ReadonlyArray<Reference>>;
  children?: ReadonlyArray<SerializedElement>;
  props: NodePropsForEditing;
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
}

export type SerializedElement = SerializedNode | SerializedEdge;
