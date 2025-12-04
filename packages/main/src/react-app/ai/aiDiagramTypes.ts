// Simplified diagram format for LLM generation
// This format is designed to be easy for LLMs to generate and understand

export type SimplifiedAction = 'create' | 'add' | 'modify' | 'replace' | 'remove' | 'delete';

export type SimplifiedNodeType =
  | 'rect'
  | 'rounded-rect'
  | 'circle'
  | 'diamond'
  | 'triangle'
  | 'hexagon'
  | 'star'
  | 'parallelogram'
  | 'trapezoid'
  | 'cylinder'
  | 'cube'
  | 'cloud'
  | 'arrow'
  | 'text'
  | 'document'
  | 'process'
  | 'delay';

export type SimplifiedAnchorPosition =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'center'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export type SimplifiedEdgeType = 'straight' | 'curved' | 'orthogonal';

export type SimplifiedArrowType = 'none' | 'arrow' | 'triangle' | 'diamond' | 'circle';

export interface SimplifiedNode {
  id: string;
  type?: SimplifiedNodeType;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface SimplifiedEdge {
  id?: string;
  from: string;
  to: string;
  fromAnchor?: SimplifiedAnchorPosition;
  toAnchor?: SimplifiedAnchorPosition;
  type?: SimplifiedEdgeType;
  text?: string;
  startArrow?: SimplifiedArrowType;
  endArrow?: SimplifiedArrowType;
  stroke?: string;
  strokeWidth?: number;
}

export interface SimplifiedNodeModification {
  nodeId: string;
  updates: Partial<SimplifiedNode>;
}

export interface SimplifiedDiagram {
  action: SimplifiedAction;
  nodes?: SimplifiedNode[];
  edges?: SimplifiedEdge[];
  modifications?: SimplifiedNodeModification[];
  removeIds?: string[];
  layout?: 'auto' | 'manual';
}

// Default values for simplified format
export const SIMPLIFIED_DEFAULTS = {
  nodeType: 'rect' as SimplifiedNodeType,
  nodeWidth: 120,
  nodeHeight: 80,
  nodeFill: '#ffffff',
  nodeStroke: '#000000',
  nodeStrokeWidth: 1,
  edgeType: 'straight' as SimplifiedEdgeType,
  edgeStroke: '#000000',
  edgeStrokeWidth: 1,
  edgeEndArrow: 'arrow' as SimplifiedArrowType,
  anchorPosition: 'center' as SimplifiedAnchorPosition,
  layoutSpacingX: 150,
  layoutSpacingY: 120,
  layoutStartX: 100,
  layoutStartY: 100
} as const;

// Map simplified anchor positions to internal anchor IDs
export const ANCHOR_POSITION_MAP: Record<SimplifiedAnchorPosition, string> = {
  'center': 'c',
  'top': '1',
  'right': '3',
  'bottom': '2',
  'left': '4',
  'top-left': 'tl',
  'top-right': 'tr',
  'bottom-left': 'bl',
  'bottom-right': 'br'
};

// Map simplified arrow types to internal arrow types
export const ARROW_TYPE_MAP: Record<SimplifiedArrowType, string | null> = {
  none: null,
  arrow: 'SIMPLE_ARROW',
  triangle: 'FILLED_TRIANGLE',
  diamond: 'FILLED_DIAMOND',
  circle: 'FILLED_CIRCLE'
};
