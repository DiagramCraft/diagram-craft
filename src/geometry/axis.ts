export type Axis = 'h' | 'v';

export const Axis = {
  h: 'h' as Axis,
  v: 'v' as Axis,
  orthogonal: (axis: Axis): Axis => (axis === 'h' ? 'v' : 'h'),
  axises: (): Axis[] => ['h', 'v'],
  toXY: (axis: Axis): 'x' | 'y' => (axis === 'h' ? 'x' : 'y')
};
