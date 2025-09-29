import { Path } from './path';
import { assert } from '@diagram-craft/utils/assert';
import { Box } from './box';
import { Point } from './point';
import { LengthOffsetOnPath, TimeOffsetOnSegment } from './pathPosition';
import { constructPathTree, type Hierarchy } from './pathUtils';

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
    assert.arrayWithExactlyOneElement(
      this.paths,
      `Expected a single path, ${this.paths.length} found`
    );
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

    const classification = constructPathTree(this.paths, 1);

    const dest: Path[] = [];

    for (let depth = 0; depth < this.paths.length; depth++) {
      let found = false;

      for (const p of this.paths) {
        const c = classification.get(p);
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
    let best: ProjectedPointOnPathList | undefined ;
    for (let idx = 0; idx < this.paths.length; idx++) {
      const path = this.paths[idx]!;

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

  isOn(p: Point, epsilon = 0.0001): boolean {
    return this.paths.some(path => path.isOn(p, epsilon));
  }

  intersections(p: Path): Point[] {
    return this.paths.flatMap(path => path.intersections(p)).map(i => i.point);
  }
}

export const splitDisjointsPathList = (pathList: PathList): Array<PathList> => {
  const makePathList = (parent: Path, classification: Map<Path, Hierarchy>, dest: Path[]) => {
    dest.push(parent);
    for (const [path, hierarchy] of classification.entries()) {
      if (hierarchy.parent !== parent) continue;
      makePathList(path, classification, dest);
    }
  };

  const dest: PathList[] = [];

  const p = pathList.normalize();

  const classification = constructPathTree(p.all(), 1);

  for (const [path, hierarchy] of classification.entries()) {
    if (hierarchy.depth > 0) continue;

    const destPathList: Path[] = [];
    makePathList(path, classification, destPathList);
    dest.push(new PathList(destPathList).normalize().clone());
  }

  return dest;
};
