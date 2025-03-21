import { Box } from '@diagram-craft/geometry/box';
import { Point } from '@diagram-craft/geometry/point';
import { Anchor } from './anchor';

export interface ElementInterface {
  id: string;
  type: string;
}

export interface NodeInterface extends ElementInterface {
  type: 'node';
  nodeType: 'group' | string;
  id: string;
  bounds: Box;

  anchors?: ReadonlyArray<Anchor>;
}

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

export interface EdgeInterface extends ElementInterface {
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
