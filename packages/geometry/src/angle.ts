import { round } from '@diagram-craft/utils/math';

export const Angle = {
  toDeg: (radians: number) => (radians * (180 / Math.PI)) % 360,

  toRad: (degrees: number) => degrees * (Math.PI / 180),

  isVertical: (angle: number) => {
    return round(angle) === round(Math.PI / 2) || round(angle) === round((3 * Math.PI) / 2);
  },

  isHorizontal: (angle: number) => {
    return round(angle) === 0 || round(angle) === round(Math.PI);
  },

  /**
   * Checks if an angle is a cardinal direction (0°, 90°, 180°, or 270°)
   */
  isCardinal: (angle: number) => {
    const cardinalDirections = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    return cardinalDirections.some(cardinal => round(angle) === round(cardinal));
  },

  normalize: (radians: number) => {
    let a = radians;
    while (a < 0) {
      a += Math.PI * 2;
    }
    return a % (Math.PI * 2);
  }
};
