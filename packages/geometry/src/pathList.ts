import { Path } from './path';
import { assert } from '@diagram-craft/utils/assert';
import { Box } from './box';
import { Point } from './point';
import { LengthOffsetOnPath, TimeOffsetOnSegment } from './pathPosition';
import { isDebug } from '@diagram-craft/utils/debug';
import { constructPathTree } from './pathUtils';

type ProjectedPointOnPathList = {
  offset: TimeOffsetOnSegment & LengthOffsetOnPath;
  point: Point;
  pathIdx: number;
};

const FAR_DISTANCE = 1000000;

const RAY_OFFSETS: [number, number][] = [
  [17, 25],
  [-13, 19],
  [-7, -11],
  [11, -17]
];

export class PathList {
  constructor(private paths: Path[]) {}

  singular() {
    assert.true(this.paths.length === 1, `Expected a single path, ${this.paths.length} found`);
    return this.paths[0];
  }

  all() {
    return this.paths;
  }

  bounds() {
    return Box.boundingBox(this.paths.map(p => p.bounds()));
  }

  asSvgPath() {
    return this.paths.map(p => p.asSvgPath()).join(' ');
  }

  segments() {
    return this.paths.flatMap(p => p.segments);
  }

  normalize() {
    // TODO: First we remove all self-intersections

    const classification = constructPathTree(this.paths);

    const dest: Path[] = [];

    for (let depth = 0; depth < this.paths.length; depth++) {
      let found = false;

      for (const p of this.paths) {
        const c = classification.get(p);
        if (isDebug()) console.log('found', c);
        if (c && c.depth === depth) {
          const state = c?.type === 'outline';

          if (p.isClockwise() && state) dest.push(p.reverse());
          else if (!p.isClockwise() && !state) dest.push(p.reverse());
          else {
            dest.push(p);
          }

          found = true;
        }
      }

      if (!found) break;
    }

    this.paths = dest;

    return this;
  }

  clone() {
    return new PathList(this.paths.map(path => path.clone()));
  }

  projectPoint(p: Point): ProjectedPointOnPathList {
    let best: ProjectedPointOnPathList | undefined = undefined;
    for (let idx = 0; idx < this.paths.length; idx++) {
      const path = this.paths[idx];

      const bp = path.projectPoint(p);
      if (best === undefined || Point.distance(p, bp.point) < Point.distance(p, best.point)) {
        best = {
          point: bp.point,
          pathIdx: idx,
          offset: bp
        };
      }
    }

    return best!;
  }

  isInside(p: Point): boolean {
    for (const [dx, dy] of RAY_OFFSETS) {
      const line = new Path(p, [['L', dx * FAR_DISTANCE, dy * FAR_DISTANCE]]);
      const intersections = this.all().flatMap(p => p.intersections(line));
      if (intersections.length % 2 === 0) return false;
    }
    return true;
  }

  isInHole(p: Point): boolean {
    for (const [dx, dy] of RAY_OFFSETS) {
      const line = new Path(p, [['L', dx * FAR_DISTANCE, dy * FAR_DISTANCE]]);
      const intersections = this.all().flatMap(p => p.intersections(line));
      if (intersections.length === 0 || intersections.length % 2 !== 0) return false;
    }
    return true;
  }

  isOn(p: Point): boolean {
    return this.paths.some(path => path.isOn(p));
  }

  intersections(p: Path): Point[] {
    return this.paths.flatMap(path => path.intersections(p)).map(i => i.point);
  }
}
