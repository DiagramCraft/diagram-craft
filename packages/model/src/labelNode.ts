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

export const isParallel = (s: LabelNodeType) => s === 'parallel' || s === 'parallel-readable';

export const isPerpendicular = (s: LabelNodeType) =>
  s === 'perpendicular' || s === 'perpendicular-readable';

export const isReadable = (s: LabelNodeType) =>
  s === 'parallel-readable' || s === 'perpendicular-readable';

export const isHorizontal = (s: LabelNodeType) => s === 'horizontal';

export const isVertical = (s: LabelNodeType) => s === 'vertical';
