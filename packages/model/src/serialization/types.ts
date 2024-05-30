import { AbstractEdge, AbstractNode } from '../types';
import { Point } from '@diagram-craft/geometry/point';
import { Canvas } from '../diagram';
import { EdgePropsForEditing } from '../diagramEdge';
import { NodePropsForEditing } from '../diagramNode';

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
  canvas?: Canvas;
};

export interface SerializedDiagramDocument {
  diagrams: ReadonlyArray<SerializedDiagram>;
  attachments?: Record<string, string>;
}

export interface SerializedNode extends AbstractNode {
  edges?: Record<string, ReadonlyArray<Reference>>;
  children: ReadonlyArray<SerializedElement>;
  props: NodePropsForEditing;
}

export type SerializedFixedEndpoint = { offset: Point; node: Reference; position?: Point };
export type SerializedConnectedEndpoint = { anchor: number; node: Reference; position?: Point };
export type SerializedFreeEndpoint = { position: Point };

export type SerializedEndpoint =
  | SerializedConnectedEndpoint
  | SerializedFixedEndpoint
  | SerializedFreeEndpoint;

export interface SerializedEdge extends AbstractEdge {
  start: SerializedEndpoint;
  end: SerializedEndpoint;
  props: EdgePropsForEditing;
}

export type SerializedElement = SerializedNode | SerializedEdge;
