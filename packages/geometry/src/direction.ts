import { Point } from './point';

export type Direction = 'n' | 's' | 'w' | 'e';

export const Direction = {
  opposite(d: Direction): Direction {
    switch (d) {
      case 'n':
        return 's';
      case 's':
        return 'n';
      case 'w':
        return 'e';
      case 'e':
        return 'w';
    }
  },
  all: (): ReadonlyArray<Direction> => {
    return ['n', 's', 'w', 'e'];
  },
  fromVector: (p: Point): Direction => {
    if (Math.abs(p.x) > Math.abs(p.y)) {
      return p.x > 0 ? 'w' : 'e';
    } else {
      return p.y > 0 ? 'n' : 's';
    }
  }
};
