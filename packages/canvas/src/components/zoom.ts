import { round } from '@diagram-craft/utils/math';

export class Zoom {
  constructor(public level: number) {}

  str(v: number, min = 0, unit: string = 'px') {
    return `${round(Math.max(min, v * this.level))}${unit}`;
  }

  num(v: number, min = 0) {
    return round(Math.max(min, v * this.level));
  }
}
