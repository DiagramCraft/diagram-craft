import { AbstractEdge, AbstractNode } from '../types';
import { Point } from '@diagram-craft/geometry/point';

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
};

export interface SerializedDiagramDocument {
  diagrams: ReadonlyArray<SerializedDiagram>;
  attachments?: Record<string, string>;
}

export interface SerializedNode extends AbstractNode {
  edges?: Record<string, ReadonlyArray<Reference>>;
  children: ReadonlyArray<SerializedElement>;
}

export type SerializedConnectedEndpoint = { anchor: number; node: Reference; position?: Point };

export type SerializedEndpoint = SerializedConnectedEndpoint | { position: Point };

export interface SerializedEdge extends AbstractEdge {
  start: SerializedEndpoint;
  end: SerializedEndpoint;
}

export type SerializedElement = SerializedNode | SerializedEdge;
