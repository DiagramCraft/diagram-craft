import { Box } from '@diagram-craft/geometry/box';
import { Point } from '@diagram-craft/geometry/point';

export interface AbstractElement {
  id: string;
  type: string;
}

export interface AbstractNode extends AbstractElement {
  type: 'node';
  nodeType: 'group' | string;
  id: string;
  bounds: Box;

  anchors?: ReadonlyArray<Anchor>;
}

export type Anchor = {
  id: string;
  // TODO: Type is not used yet
  type: 'center' | 'point' | 'edge' | 'custom';
  start: Point;
  // TODO: end is not yet used
  end?: Point;
  // TODO: directions is not yet used
  directions?: ReadonlyArray<Range>;
  clip?: boolean;
};

export type LabelNodeType =
  | 'parallel'
  | 'perpendicular'
  | 'perpendicular-readable'
  | 'parallel-readable'
  | 'horizontal'
  | 'vertical'
  | 'independent';

export type LabelNode = Readonly<{
  id: string;
  offset: Point;
  timeOffset: number;
  type: LabelNodeType;
}>;

export interface AbstractEdge extends AbstractElement {
  type: 'edge';
  id: string;
  waypoints?: ReadonlyArray<Waypoint>;

  labelNodes?: ReadonlyArray<LabelNode>;
}

export type Waypoint = Readonly<{
  point: Point;
  controlPoints?: ControlPoints;
}>;

export type ControlPoints = Readonly<{
  cp1: Point;
  cp2: Point;
}>;
