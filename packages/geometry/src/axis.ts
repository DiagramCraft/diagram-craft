export type Axis = 'h' | 'v';

/** @namespace */
export const Axis = {
  h: 'h' as Axis,
  v: 'v' as Axis,
  axises: (): ReadonlyArray<Axis> => ['h', 'v'],

  orthogonal: (axis: Axis): Axis => (axis === 'h' ? 'v' : 'h'),
  toXY: (axis: Axis): 'x' | 'y' => (axis === 'h' ? 'x' : 'y')
};
