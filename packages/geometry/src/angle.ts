import { round } from '@diagram-craft/utils/math';

export const Angle = {
  toDeg: (radians: number) => (radians * (180 / Math.PI)) % 360,

  toRad: (degrees: number) => degrees * (Math.PI / 180),

  isVertical: (angle: number) => {
    return round(angle) === round(Math.PI / 2) || round(angle) === round((3 * Math.PI) / 2);
  },

  isHorizontal: (angle: number) => {
    return round(angle) === 0 || round(angle) === round(Math.PI);
  }
};
