import { Point } from '@diagram-craft/geometry/point';

export type ArrowShape = {
  width: number;
  height: number;
  anchor: Point;
  path: string;
  fill: 'fg' | 'bg' | 'transparent';
  shortenBy?: number;
};

export type ArrowShapeFactory = (scale: number, stroke: number) => ArrowShape;

export const ARROW_SHAPES: Partial<Record<string, ArrowShapeFactory>> = {
  SQUARE_ARROW_FILLED: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 10 + 2 * s,
    anchor: { x: z * 10, y: s + z * 5 },
    path: [`M ${s} ${s}`, `L ${s + z * 10} ${s + z * 5}`, `L ${s} ${s + z * 10}`, `z`].join('\n'),
    fill: 'fg',
    shortenBy: 2 * s
  }),
  SQUARE_ARROW_THIN_FILLED: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 6 + 2 * s,
    anchor: { x: z * 10, y: s + z * 3 },
    path: [`M ${s} ${s}`, `L ${s + z * 10} ${s + z * 3}`, `L ${s} ${s + z * 6}`, `z`].join('\n'),
    fill: 'fg',
    shortenBy: 2 * s
  }),
  SQUARE_ARROW_OUTLINE: (z, s) => ({
    width: z * 20 + 2 * s,
    height: z * 20 + 2 * s,
    anchor: { x: z * 10, y: s + z * 5 },
    path: [`M ${s} ${s}`, `L ${s + z * 10} ${s + z * 5}`, `L ${s} ${s + z * 10}`, `z`].join('\n'),
    fill: 'bg',
    shortenBy: 2 * s
  }),
  SQUARE_ARROW_THIN_OUTLINE: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 6 + 2 * s,
    anchor: { x: z * 10, y: s + z * 3 },
    path: [`M ${s} ${s}`, `L ${s + z * 10} ${s + z * 3}`, `L ${s} ${s + z * 6}`, `z`].join('\n'),
    fill: 'bg',
    shortenBy: 2 * s
  }),
  BALL_FILLED: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 10 + 2 * s,
    anchor: { x: z * 10, y: s + z * 5 },
    /* M cx cy m r, 0 a r,r 0 1,1 -(r * 2),0 a r,r 0 1,1  (r * 2),0 */
    path: [
      `M ${s + z * 5},${s + z * 5}`,
      `m ${z * 5}, 0`,
      `a ${z * 5},${z * 5} 0 1,1 -${z * 10},0`,
      `a ${z * 5},${z * 5} 0 1,1 ${z * 10},0`
    ].join('\n'),
    fill: 'fg',
    shortenBy: 1.5 * s
  }),
  BALL_OUTLINE: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 10 + 2 * s,
    anchor: { x: z * 10, y: s + z * 5 },
    /* M cx cy m r, 0 a r,r 0 1,1 -(r * 2),0 a r,r 0 1,1  (r * 2),0 */
    path: [
      `M ${s + z * 5},${s + z * 5}`,
      `m ${z * 5}, 0`,
      `a ${z * 5},${z * 5} 0 1,1 -${z * 10},0`,
      `a ${z * 5},${z * 5} 0 1,1 ${z * 10},0`
    ].join('\n'),
    fill: 'bg',
    shortenBy: 1.5 * s
  }),
  BALL_PLUS_OUTLINE: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 10 + 2 * s,
    anchor: { x: z * 10, y: s + z * 5 },
    /* M cx cy m r, 0 a r,r 0 1,1 -(r * 2),0 a r,r 0 1,1  (r * 2),0 */
    path: [
      `M ${s + z * 5},${s + z * 5}`,
      `m ${z * 5}, 0`,
      `a ${z * 5},${z * 5} 0 1,1 -${z * 10},0`,
      `a ${z * 5},${z * 5} 0 1,1 ${z * 10},0`,
      `M ${s + z * 5},${s}`,
      `L ${s + z * 5},${s + z * 10}`,
      `M ${s},${s + z * 5}`,
      `L ${s + z * 10},${s + z * 5}`
    ].join('\n'),
    fill: 'bg',
    shortenBy: 1.5 * s
  }),
  SQUARE_DOUBLE_ARROW_FILLED: (z, s) => ({
    width: z * 20 + 2 * s,
    height: z * 10 + 2 * s,
    anchor: { x: z * 20, y: s + z * 5 },
    path: [
      `M ${s} ${s}`,
      `L ${s + z * 10} ${s + z * 5}`,
      `L ${s + z * 10} ${s}`,
      `L ${s + z * 20} ${s + z * 5}`,
      `L ${s + z * 10} ${s + z * 10}`,
      `L ${s + z * 10} ${s + z * 5}`,
      `L ${s} ${s + z * 10}`,
      `z`
    ].join('\n'),
    fill: 'fg',
    shortenBy: 2 * s
  }),
  SQUARE_DOUBLE_ARROW_OUTLINE: (z, s) => ({
    width: z * 20 + 2 * s,
    height: z * 10 + 2 * s,
    anchor: { x: z * 20, y: s + z * 5 },
    path: [
      `M ${s} ${s}`,
      `L ${s + z * 10} ${s + z * 5}`,
      `L ${s + z * 10} ${s}`,
      `L ${s + z * 20} ${s + z * 5}`,
      `L ${s + z * 10} ${s + z * 10}`,
      `L ${s + z * 10} ${s + z * 5}`,
      `L ${s} ${s + z * 10}`,
      `z`
    ].join('\n'),
    fill: 'bg',
    shortenBy: 2 * s
  }),
  BOX_FILLED: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 10 + 2 * s,
    anchor: { x: z * 10, y: s + z * 5 },
    path: [
      `M ${s} ${s}`,
      `L ${s + z * 10} ${s}`,
      `L ${s + z * 10} ${s + z * 10}`,
      `L ${s} ${s + z * 10}`,
      `z`
    ].join('\n'),
    fill: 'fg',
    shortenBy: 1.5 * s
  }),
  BOX_OUTLINE: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 10 + 2 * s,
    anchor: { x: z * 10, y: s + z * 5 },
    path: [
      `M ${s} ${s}`,
      `L ${s + z * 10} ${s}`,
      `L ${s + z * 10} ${s + z * 10}`,
      `L ${s} ${s + z * 10}`,
      `z`
    ].join('\n'),
    fill: 'bg',
    shortenBy: 1.5 * s
  }),
  DIAMOND_FILLED: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 10 + 2 * s,
    anchor: { x: z * 10, y: s + z * 5 },
    path: [
      `M ${s} ${s + z * 5}`,
      `L ${s + z * 5} ${s}`,
      `L ${s + z * 10} ${s + z * 5}`,
      `L ${s + z * 5} ${s + z * 10}`,
      `z`
    ].join('\n'),
    fill: 'fg',
    shortenBy: 1.5 * s
  }),
  DIAMOND_THIN_FILLED: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 6 + 2 * s,
    anchor: { x: z * 10, y: s + z * 3 },
    path: [
      `M ${s} ${s + z * 3}`,
      `L ${s + z * 5} ${s}`,
      `L ${s + z * 10} ${s + z * 3}`,
      `L ${s + z * 5} ${s + z * 6}`,
      `z`
    ].join('\n'),
    fill: 'fg',
    shortenBy: 1.7 * s
  }),
  DIAMOND_THIN_OUTLINE: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 6 + 2 * s,
    anchor: { x: z * 10, y: s + z * 3 },
    path: [
      `M ${s} ${s + z * 3}`,
      `L ${s + z * 5} ${s}`,
      `L ${s + z * 10} ${s + z * 3}`,
      `L ${s + z * 5} ${s + z * 6}`,
      `z`
    ].join('\n'),
    fill: 'bg',
    shortenBy: 1.7 * s
  }),
  DIAMOND_OUTLINE: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 10 + 2 * s,
    anchor: { x: z * 10, y: s + z * 5 },
    path: [
      `M ${s} ${s + z * 5}`,
      `L ${s + z * 5} ${s}`,
      `L ${s + z * 10} ${s + z * 5}`,
      `L ${s + z * 5} ${s + z * 10}`,
      `z`
    ].join('\n'),
    fill: 'bg',
    shortenBy: 1.5 * s
  }),
  FORK: (z, s) => ({
    width: z * 10,
    height: z * 10 + 2 * s,
    anchor: { x: 0, y: s + z * 5 },
    path: [
      `M ${z * 10} ${s}`,
      `L 0 ${s}`,
      `L 0 ${s + z * 10}`,
      `L ${z * 10} ${s + z * 10}`,
      `M 0 ${z * 5 + s}`,
      `L ${z * 10}, ${z * 5 + s}`
    ].join('\n'),
    fill: 'transparent',
    shortenBy: z * 10
  }),
  SQUARE_STICK_ARROW: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 10 + 2 * s,
    anchor: { x: z * 10, y: z * 5 + s },
    path: [`M ${s} ${s}`, `L ${s + z * 10} ${s + z * 5}`, `L ${s} ${s + z * 10}`].join('\n'),
    fill: 'transparent',
    shortenBy: 2 * s
  }),
  SQUARE_STICK_ARROW_HALF_LEFT_THIN_FILLED: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 6 + 2 * s,
    anchor: { x: z * 10, y: s + z * 3 },
    path: [`M ${s} ${s}`, `L ${s + z * 10} ${s + z * 3}`, `L ${s} ${s + z * 3}`, `z`].join('\n'),
    fill: 'fg',
    shortenBy: 2 * s
  }),
  SQUARE_STICK_ARROW_HALF_LEFT_THIN_OUTLINE: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 6 + 2 * s,
    anchor: { x: z * 10, y: s + z * 3 },
    path: [`M ${s} ${s}`, `L ${s + z * 10} ${s + z * 3}`, `L ${s} ${s + z * 3}`, `z`].join('\n'),
    fill: 'transparent',
    shortenBy: 2 * s
  }),
  SQUARE_STICK_ARROW_HALF_LEFT: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 10 + 2 * s,
    anchor: { x: z * 10, y: z * 5 + s },
    path: [`M ${s} ${s}`, `L ${s + z * 10} ${s + z * 5}`, `L ${s} ${s + z * 5}`].join('\n'),
    fill: 'transparent',
    shortenBy: 2 * s
  }),
  SQUARE_STICK_ARROW_HALF_RIGHT: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 10 + 2 * s,
    anchor: { x: z * 10, y: z * 5 + s },
    path: [`M ${s} ${z * 10 + s}`, `L ${s + z * 10} ${s + z * 5}`, `L ${s} ${s + z * 5}`].join(
      '\n'
    ),
    fill: 'transparent',
    shortenBy: 2 * s
  }),
  SQUARE_DOUBLE_STICK_ARROW: (z, s) => ({
    width: z * 20 + 2 * s,
    height: z * 10 + 2 * s,
    anchor: { x: z * 20, y: s + z * 5 },
    path: [
      `M ${s} ${s}`,
      `L ${s + z * 10} ${s + z * 5}`,
      `L ${s} ${s + z * 10}`,
      `M ${s + z * 10} ${s}`,
      `L ${s + z * 20} ${s + z * 5}`,
      `L ${s + z * 10} ${s + z * 10}`
    ].join('\n'),
    fill: 'transparent',
    shortenBy: 2 * s
  }),
  BAR: (z, s) => ({
    width: 9 + s,
    height: z * 10,
    anchor: { x: 9 + s, y: z * 5 },
    path: [`M 0 0`, `L 0 ${z * 10}`].join('\n'),
    fill: 'transparent'
  }),
  BAR_END: (z, s) => ({
    width: 2 * s,
    height: z * 10,
    anchor: { x: -0.5 * s, y: z * 5 },
    path: [`M 0 0`, `L 0 ${z * 10}`].join('\n'),
    fill: 'transparent',
    shortenBy: s
  }),
  BAR_DOUBLE: (z, s) => ({
    width: 14 + s,
    height: z * 10,
    anchor: { x: 14 + s, y: z * 5 },
    path: [`M 0 0`, `L 0 ${z * 10}`, `M ${5 + s} 0`, `L ${5 + s} ${z * 10}`].join('\n'),
    fill: 'transparent'
  }),
  SHARP_ARROW_FILLED: (z, s) => {
    return {
      width: z * 10 + 2 * s,
      height: z * 10 + 2 * s,
      anchor: { x: z * 3, y: s + z * 5 },
      path: [
        `M ${s} ${s}`,
        `L ${s + z * 10} ${s + z * 5}`,
        `L ${s} ${s + z * 10}`,
        `L ${s + z * 3} ${s + z * 5}`,
        `Z`
      ].join('\n'),
      fill: 'fg',
      shortenBy: z * 6 + 2 * s
    };
  },
  SHARP_ARROW_THIN_FILLED: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 6 + 2 * s,
    anchor: { x: z * 3, y: z * 3 + s },
    path: [
      `M ${s} ${s}`,
      `L ${s + z * 10} ${s + z * 3}`,
      `L ${s} ${s + z * 6}`,
      `L ${s + z * 3} ${s + z * 3}`,
      `Z`
    ].join('\n'),
    fill: 'fg',
    shortenBy: z * 6 + 2 * s
  }),
  SHARP_ARROW_OUTLINE: (z, s) => ({
    width: z * 10 + 2 * s,
    height: z * 10 + 2 * s,
    anchor: { x: z * 10, y: s + z * 5 },
    path: [
      `M ${s} ${s}`,
      `L ${s + z * 10} ${s + z * 5}`,
      `L ${s} ${s + z * 10}`,
      `L ${s + z * 3} ${s + z * 5}`,
      `Z`
    ].join('\n'),
    fill: 'bg',
    shortenBy: 2 * s
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
      `M 0 0`,
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
  CROWS_FEET_BALL_FILLED: s => ({
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
    fill: 'fg'
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
  SOCKET: (z, s) => ({
    width: z * 20,
    height: z * 20,
    anchor: { x: z * 5 - s, y: z * 7.5 },
    path: [`M ${z * 15} ${z * 3}`, `A ${z * 6},${z * 8} 0 1,0 ${z * 15} ${z * 12}`].join('\n'),
    fill: 'transparent',
    shortenBy: z * 7.5
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
