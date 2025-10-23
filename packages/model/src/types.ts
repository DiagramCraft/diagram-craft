import { Point } from '@diagram-craft/geometry/point';

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

export type Waypoint = Readonly<{
  point: Point;
  controlPoints?: ControlPoints;
}>;

export type ControlPoints = Readonly<{
  cp1: Point;
  cp2: Point;
}>;

export type GuideType = 'horizontal' | 'vertical';

export interface Guide {
  id: string;
  type: GuideType;
  position: number;
  color?: string;
}

export const DEFAULT_GUIDE_COLOR = 'var(--accent-9)';
