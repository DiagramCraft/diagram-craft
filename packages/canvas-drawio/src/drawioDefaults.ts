import type { ARROW_SHAPES } from '@diagram-craft/canvas/arrowShapes';

export const drawioBuiltinShapes: Partial<Record<string, string>> = {
  actor:
    'stencil(tZPtDoIgFIavhv8IZv1tVveBSsm0cPjZ3QeCNlBytbU5tvc8x8N74ABwXOekogDBHOATQCiAUK5S944mdUXTRgc7IhhJSqpJ3Qhe0J5ljanBHjkVrFEUnwE8yhz14TghaXETvH1kDgDo4mVXLugKmHBF1LYLMOE771R3g3Zmenk6vcntP5RIW6FrBHYRIyOjB2RjI8MJY613E8c2/85DsLdNhI6JmdumfCZ+8nDAtgfHwoz/exAQbpwEdC4kcny8E9zAhpOS19SbNc60ZzblTLOy1M9mpcD462Lqx6h+rGPgBQ==)'
};

export const arrows: Record<string, keyof typeof ARROW_SHAPES> = {
  'open': 'SQUARE_STICK_ARROW',
  'classic': 'SHARP_ARROW_FILLED',
  'classicThin': 'SHARP_ARROW_THIN_FILLED',
  'oval': 'BALL_FILLED',
  'doubleBlock': 'SQUARE_DOUBLE_ARROW_FILLED',
  'doubleBlock-outline': 'SQUARE_DOUBLE_ARROW_OUTLINE',
  'ERzeroToMany-outline': 'CROWS_FEET_BALL',
  'ERzeroToOne-outline': 'BAR_BALL',
  'ERoneToMany-outline': 'CROWS_FEET_BAR',
  'ERmandOne-outline': 'BAR_DOUBLE',
  'ERone-outline': 'BAR',
  'baseDash-outline': 'BAR_END',
  'halfCircle-outline': 'SOCKET',
  'box-outline': 'BOX_OUTLINE',
  'diamond-outline': 'DIAMOND_OUTLINE',
  'diamondThin-outline': 'DIAMOND_THIN_OUTLINE',
  'diamond': 'DIAMOND_FILLED',
  'diamondThin': 'DIAMOND_THIN_FILLED',
  'circle': 'BALL_FILLED',
  'circle-outline': 'BALL_OUTLINE',
  'circlePlus-outline': 'BALL_PLUS_OUTLINE',
  'oval-outline': 'BALL_OUTLINE',
  'block': 'SQUARE_ARROW_FILLED',
  'blockThin': 'SQUARE_ARROW_THIN_FILLED',
  'block-outline': 'SQUARE_ARROW_OUTLINE',
  'open-outline': 'SQUARE_STICK_ARROW',
  'openAsync-outline': 'SQUARE_STICK_ARROW_HALF_LEFT',
  'async': 'SQUARE_STICK_ARROW_HALF_LEFT_THIN_FILLED',
  'classic-outline': 'SHARP_ARROW_OUTLINE',
  'blockThin-outline': 'SQUARE_ARROW_THIN_OUTLINE',
  'async-outline': 'SQUARE_STICK_ARROW_HALF_LEFT_THIN_OUTLINE',
  'dash-outline': 'SLASH',
  'cross-outline': 'CROSS',
  'openThin-outline': 'SQUARE_STICK_ARROW',
  'manyOptional': 'CROWS_FEET_BALL_FILLED',
  'manyOptional-outline': 'CROWS_FEET_BALL'
};

export const LABEL_POSITIONS: Record<
  string,
  Record<string, 'nw' | 'w' | 'sw' | 'n' | 'c' | 's' | 'ne' | 'e' | 'se' | undefined>
> = {
  left: {
    top: 'nw',
    middle: 'w',
    bottom: 'sw'
  },
  center: {
    top: 'n',
    middle: 'c',
    bottom: 's'
  },
  right: {
    top: 'ne',
    middle: 'e',
    bottom: 'se'
  }
};
