import { Box } from '@diagram-craft/geometry/box';
import { Point } from '@diagram-craft/geometry/point';
import { DeepReadonly } from '@diagram-craft/utils/types';

export interface AbstractElement {
  id: string;
  type: string;
}

export interface AbstractNode extends AbstractElement {
  type: 'node';
  nodeType: 'group' | string;
  id: string;
  bounds: Box;

  // TODO: Maybe we should make this readonly (deep)?
  props: DeepReadonly<NodeProps>;
  anchors?: ReadonlyArray<Anchor>;
}

export type Anchor = {
  point: Point;
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
  props: DeepReadonly<EdgeProps>;

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
