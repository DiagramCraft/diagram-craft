import { Path } from './path';
import { Box } from './box';
import { RawSegment } from './pathBuilder';

export const PathUtils = {
  scalePath: (path: Path, fromBounds: Box, toBounds: Box) => {
    const p = path.path;
    const start = path.start;

    const destStart = {
      x: ((start.x - fromBounds.x) / fromBounds.w) * toBounds.w + toBounds.x,
      y: ((start.y - fromBounds.y) / fromBounds.h) * toBounds.h + toBounds.y
    };
    const destPath: RawSegment[] = [];

    for (const el of p) {
      const s = [...el] as RawSegment;
      const command = s[0];

      switch (command) {
        case 'L':
          s[1] = ((s[1] - fromBounds.x) / fromBounds.w) * toBounds.w + toBounds.x;
          s[2] = ((s[2] - fromBounds.y) / fromBounds.h) * toBounds.h + toBounds.y;
          break;
        case 'C':
          s[1] = ((s[1] - fromBounds.x) / fromBounds.w) * toBounds.w + toBounds.x;
          s[2] = ((s[2] - fromBounds.y) / fromBounds.h) * toBounds.h + toBounds.y;
          s[3] = ((s[3] - fromBounds.x) / fromBounds.w) * toBounds.w + toBounds.x;
          s[4] = ((s[4] - fromBounds.y) / fromBounds.h) * toBounds.h + toBounds.y;
          s[5] = ((s[5] - fromBounds.x) / fromBounds.w) * toBounds.w + toBounds.x;
          s[6] = ((s[6] - fromBounds.y) / fromBounds.h) * toBounds.h + toBounds.y;
          break;
        case 'Q':
          s[1] = ((s[1] - fromBounds.x) / fromBounds.w) * toBounds.w + toBounds.x;
          s[2] = ((s[2] - fromBounds.y) / fromBounds.h) * toBounds.h + toBounds.y;
          s[3] = ((s[3] - fromBounds.x) / fromBounds.w) * toBounds.w + toBounds.x;
          s[4] = ((s[4] - fromBounds.y) / fromBounds.h) * toBounds.h + toBounds.y;
          break;
        case 'T':
          s[1] = ((s[1] - fromBounds.x) / fromBounds.w) * toBounds.w + toBounds.x;
          s[2] = ((s[2] - fromBounds.y) / fromBounds.h) * toBounds.h + toBounds.y;
          break;
        case 'A':
          s[1] = ((s[1] / Math.abs(fromBounds.w)) * Math.abs(toBounds.w)) / 2;
          s[2] = ((s[2] / Math.abs(fromBounds.h)) * Math.abs(toBounds.h)) / 2;
          s[6] = ((s[6] - fromBounds.x) / fromBounds.w) * toBounds.w + toBounds.x;
          s[7] = ((s[7] - fromBounds.y) / fromBounds.h) * toBounds.h + toBounds.y;
          break;
      }

      destPath.push(s);
    }

    return new Path(destStart, destPath);
  }
};
