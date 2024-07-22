import { Point } from './point';
import { Angle } from './angle';

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
  },
  fromAngle: (angle: number, inverted = false): Direction => {
    const a = Angle.normalize(angle);

    if (a > Math.PI / 4 && a < (3 * Math.PI) / 4) {
      return inverted ? 's' : 'n';
    } else if (a > (3 * Math.PI) / 4 && a < (5 * Math.PI) / 4) {
      return 'w';
    } else if (a > (5 * Math.PI) / 4 && a < (7 * Math.PI) / 4) {
      return inverted ? 'n' : 's';
    } else {
      return 'e';
    }
  },
  toAngle: (d: Direction, inverted = false): number => {
    switch (d) {
      case 'n':
        return inverted ? (3 * Math.PI) / 2 : Math.PI / 2;
      case 's':
        return inverted ? Math.PI / 2 : (3 * Math.PI) / 2;
      case 'w':
        return Math.PI;
      case 'e':
        return 0;
    }
  }
};
