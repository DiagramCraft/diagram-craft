import { Point } from '@diagram-craft/geometry/point';

export type ArrowShape = {
  width: number;
  height: number;
  anchor: Point;
  path: string;
  fill: 'fg' | 'bg' | 'transparent';
  shortenBy?: number;
};

export type ArrowShapeFactory = (scale: number) => ArrowShape;

export const ARROW_SHAPES: Partial<Record<string, ArrowShapeFactory>> = {
  SQUARE_ARROW_FILLED: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 10, y: s * 5 },
    path: [`M 0 0`, `L ${s * 10} ${s * 5}`, `L 0 ${s * 10}`, `z`].join('\n'),
    fill: 'fg'
  }),
  SQUARE_ARROW_OUTLINE: s => ({
    width: s * 20,
    height: s * 20,
    anchor: { x: s * 10, y: s * 5 },
    path: [`M 0 0`, `L ${s * 10} ${s * 5}`, `L 0 ${s * 10}`, `z`].join('\n'),
    fill: 'bg'
  }),
  BALL_FILLED: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 10, y: s * 5 },
    /* M cx cy m r, 0 a r,r 0 1,1 -(r * 2),0 a r,r 0 1,1  (r * 2),0 */
    path: [
      `M ${s * 5},${s * 5}`,
      `m ${s * 5}, 0`,
      `a ${s * 5},${s * 5} 0 1,1 -${s * 10},0`,
      `a ${s * 5},${s * 5} 0 1,1 ${s * 10},0`
    ].join('\n'),
    fill: 'fg'
  }),
  BALL_OUTLINE: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 10, y: s * 5 },
    /* M cx cy m r, 0 a r,r 0 1,1 -(r * 2),0 a r,r 0 1,1  (r * 2),0 */
    path: [
      `M ${s * 5},${s * 5}`,
      `m ${s * 5}, 0`,
      `a ${s * 5},${s * 5} 0 1,1 -${s * 10},0`,
      `a ${s * 5},${s * 5} 0 1,1 ${s * 10},0`
    ].join('\n'),
    fill: 'bg'
  }),
  BALL_PLUS_OUTLINE: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 10, y: s * 5 },
    /* M cx cy m r, 0 a r,r 0 1,1 -(r * 2),0 a r,r 0 1,1  (r * 2),0 */
    path: [
      `M ${s * 5},${s * 5}`,
      `m ${s * 5}, 0`,
      `a ${s * 5},${s * 5} 0 1,1 -${s * 10},0`,
      `a ${s * 5},${s * 5} 0 1,1 ${s * 10},0`,
      `M ${s * 5},0`,
      `L ${s * 5},${s * 10}`,
      `M 0,${s * 5}`,
      `L ${s * 10},${s * 5}`
    ].join('\n'),
    fill: 'bg'
  }),
  SQUARE_DOUBLE_ARROW_FILLED: s => ({
    width: s * 20,
    height: s * 10,
    anchor: { x: s * 20, y: s * 5 },
    path: [
      `M 0 0`,
      `L ${s * 10} ${s * 5}`,
      `L ${s * 10} 0`,
      `L ${s * 20} ${s * 5}`,
      `L ${s * 10} ${s * 10}`,
      `L ${s * 10} ${s * 5}`,
      `L 0 ${s * 10}`,
      `z`
    ].join('\n'),
    fill: 'fg'
  }),
  SQUARE_DOUBLE_ARROW_OUTLINE: s => ({
    width: s * 20,
    height: s * 10,
    anchor: { x: s * 20, y: s * 5 },
    path: [
      `M 0 0`,
      `L ${s * 10} ${s * 5}`,
      `L ${s * 10} 0`,
      `L ${s * 20} ${s * 5}`,
      `L ${s * 10} ${s * 10}`,
      `L ${s * 10} ${s * 5}`,
      `L 0 ${s * 10}`,
      `z`
    ].join('\n'),
    fill: 'bg'
  }),
  BOX_FILLED: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 10, y: s * 5 },
    path: [`M 0 0`, `L ${s * 10} 0`, `L ${s * 10} ${s * 10}`, `L 0 ${s * 10}`, `z`].join('\n'),
    fill: 'fg'
  }),
  BOX_OUTLINE: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 10, y: s * 5 },
    path: [`M 0 0`, `L ${s * 10} 0`, `L ${s * 10} ${s * 10}`, `L 0 ${s * 10}`, `z`].join('\n'),
    fill: 'bg'
  }),
  DIAMOND_FILLED: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 10, y: s * 5 },
    path: [
      `M 0 ${s * 5}`,
      `L ${s * 5} 0`,
      `L ${s * 10} ${s * 5}`,
      `L ${s * 5} ${s * 10}`,
      `z`
    ].join('\n'),
    fill: 'fg'
  }),
  DIAMOND_OUTLINE: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 10, y: s * 5 },
    path: [
      `M 0 ${s * 5}`,
      `L ${s * 5} 0`,
      `L ${s * 10} ${s * 5}`,
      `L ${s * 5} ${s * 10}`,
      `z`
    ].join('\n'),
    fill: 'bg'
  }),
  FORK: s => ({
    width: s * 15,
    height: s * 10,
    anchor: { x: s * 10, y: s * 5 },
    path: [`M ${s * 10} 0`, `L 0 0`, `L 0 ${s * 10}`, `L ${s * 10} ${s * 10}`].join('\n'),
    fill: 'transparent'
  }),
  SQUARE_STICK_ARROW: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 10, y: s * 5 },
    path: [`M 0 0`, `L ${s * 10} ${s * 5}`, `L 0 ${s * 10}`].join('\n'),
    fill: 'transparent'
  }),
  SQUARE_STICK_ARROW_HALF_LEFT: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 10, y: s * 5 },
    path: [`M 0 0`, `L ${s * 10} ${s * 5}`].join('\n'),
    fill: 'transparent'
  }),
  SQUARE_STICK_ARROW_HALF_RIGHT: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 10, y: s * 5 },
    path: [`M ${s * 10} ${s * 5}`, `L 0 ${s * 10}`].join('\n'),
    fill: 'transparent'
  }),
  SQUARE_DOUBLE_STICK_ARROW: s => ({
    width: s * 20,
    height: s * 10,
    anchor: { x: s * 20, y: s * 5 },
    path: [
      `M 0 0`,
      `L ${s * 10} ${s * 5}`,
      `L 0 ${s * 10}`,
      `M ${s * 10} 0`,
      `L ${s * 20} ${s * 5}`,
      `L ${s * 10} ${s * 10}`
    ].join('\n'),
    fill: 'transparent'
  }),
  BAR: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 8, y: s * 5 },
    path: [`M 0 0`, `L 0 ${s * 10}`].join('\n'),
    fill: 'transparent'
  }),
  BAR_END: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: 0, y: s * 5 },
    path: [`M 0 0`, `L 0 ${s * 10}`].join('\n'),
    fill: 'transparent'
  }),
  BAR_DOUBLE: s => ({
    width: s * 15,
    height: s * 10,
    anchor: { x: s * 15, y: s * 5 },
    path: [`M 0 0`, `L 0 ${s * 10}`, `M 6 0`, `L 6 ${s * 10}`].join('\n'),
    fill: 'transparent'
  }),
  SHARP_ARROW_FILLED: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 10, y: s * 5 },
    path: [`M 0 0`, `L ${s * 10} ${s * 5}`, `L 0 ${s * 10}`, `L ${s * 3} ${s * 5}`, `Z`].join('\n'),
    fill: 'fg'
  }),
  SHARP_ARROW_OUTLINE: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 10, y: s * 5 },
    path: [`M 0 0`, `L ${s * 10} ${s * 5}`, `L 0 ${s * 10}`, `L ${s * 3} ${s * 5}`, `Z`].join('\n'),
    fill: 'bg'
  }),
  CROWS_FEET: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 10, y: s * 5 },
    path: [`M 0 ${s * 5}`, `L ${s * 10} 0`, `M 0 ${s * 5}`, `L ${s * 10} ${s * 10}`].join('\n'),
    fill: 'transparent'
  }),
  CROWS_FEET_BAR: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 10, y: s * 5 },
    path: [
      `M 0 ${s * 5}`,
      `L ${s * 10} 0`,
      `M 0 ${s * 5}`,
      `L ${s * 10} ${s * 10}`,
      `M 0 ${s * 0}`,
      `L 0 ${s * 10}`
    ].join('\n'),
    fill: 'transparent'
  }),
  CROWS_FEET_BALL: s => ({
    width: s * 35,
    height: s * 20,
    anchor: { x: s * 25, y: s * 5 },
    path: [
      `M ${s * 15} ${s * 5}`,
      `L ${s * 25} 0`,
      `M ${s * 15} ${s * 5}`,
      `L ${s * 25} ${s * 5}`,
      `M ${s * 15} ${s * 5}`,
      `L ${s * 25} ${s * 10}`,
      `M ${s * 15} ${s * 5}`,
      `L ${s * 13},${s * 5}`,

      /* M cx cy m r, 0 a r,r 0 1,1 -(r * 2),0 a r,r 0 1,1  (r * 2),0 */
      `M ${s * 9},${s * 5}`,
      `m ${s * 4}, 0`,
      `a ${s * 4},${s * 4} 0 1,1 -${s * 8},0`,
      `a ${s * 4},${s * 4} 0 1,1 ${s * 8},0`
    ].join('\n'),
    fill: 'bg'
  }),
  BAR_BALL: s => ({
    width: s * 30,
    height: s * 20,
    anchor: { x: s * 25, y: s * 10 },
    path: [
      `M ${s * 17} ${s * 5}`,
      `L ${s * 17} ${s * 15}`,
      `M ${s * 13} ${s * 10}`,
      `L ${s * 25} ${s * 10}`,

      /* M cx cy m r, 0 a r,r 0 1,1 -(r * 2),0 a r,r 0 1,1  (r * 2),0 */
      `M ${s * 9},${s * 10}`,
      `m ${s * 4}, 0`,
      `a ${s * 4},${s * 4} 0 1,1 -${s * 8},0`,
      `a ${s * 4},${s * 4} 0 1,1 ${s * 8},0`
    ].join('\n'),
    fill: 'bg'
  }),
  ARROW_DIMENSION_STICK_ARROW: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 10, y: s * 5 },
    path: [
      `M 0 0`,
      `L ${s * 10} ${s * 5}`,
      `L 0 ${s * 10}`,
      `M ${s * 10} 0`,
      `L ${s * 10} ${s * 10}`
    ].join('\n'),
    fill: 'transparent'
  }),
  SOCKET: s => ({
    width: s * 20,
    height: s * 20,
    anchor: { x: s * 10, y: s * 7.5 },
    path: [`M ${s * 15} ${s * 3}`, `A ${s * 6},${s * 8} 0 1,0 ${s * 15} ${s * 12}`].join('\n'),
    fill: 'bg'
  }),
  SLASH: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 13, y: s * 5 },
    path: [`M 0 0`, `L ${s * 10} ${s * 10}`].join('\n'),
    fill: 'transparent'
  }),

  CROSS: s => ({
    width: s * 10,
    height: s * 10,
    anchor: { x: s * 13, y: s * 5 },
    path: [`M 0 0`, `L ${s * 10} ${s * 10}`, `M 0 ${s * 10}`, `L ${s * 10} 0`].join('\n'),
    fill: 'transparent'
  })
};
