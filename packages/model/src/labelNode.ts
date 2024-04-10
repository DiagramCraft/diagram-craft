import { LabelNodeType } from './types';

export const isParallel = (s: LabelNodeType) => s === 'parallel' || s === 'parallel-readable';

export const isPerpendicular = (s: LabelNodeType) =>
  s === 'perpendicular' || s === 'perpendicular-readable';

export const isReadable = (s: LabelNodeType) =>
  s === 'parallel-readable' || s === 'perpendicular-readable';

export const isHorizontal = (s: LabelNodeType) => s === 'horizontal';

export const isVertical = (s: LabelNodeType) => s === 'vertical';
