import { Path } from './path';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { Box } from './box';
import { MultiMap } from '@diagram-craft/utils/multimap';
import { Point } from './point';
import { LengthOffsetOnPath, TimeOffsetOnSegment } from './pathPosition';

type ProjectedPointOnPathList = {
  offset: TimeOffsetOnSegment & LengthOffsetOnPath;
  point: Point;
  pathIdx: number;
};

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

    // Secondly, we need to order all paths in a tree structure based on which contains which
    const containedWithin = new MultiMap<number, number>();
    for (let a = 0; a < this.paths.length; a++) {
      for (let b = 0; b < this.paths.length; b++) {
        if (a === b) continue;
        const pa = this.paths[a];
        const pb = this.paths[b];
        if (pa.segments.map(s => s.start).every(p => pb.isInside(p))) {
          containedWithin.add(a, b);
        }
      }
    }

    const dest: Path[] = [];

    let maxLoop = 100;
    let state = true;
    const queue = [...this.paths.map((_, i) => i)];
    while (queue.length > 0) {
      const removed: number[] = [];
      for (const i of queue) {
        const p = this.paths[i];
        if (!containedWithin.has(i)) {
          removed.push(i);

          if (p.isClockwise() && state) dest.push(p.reverse());
          else if (!p.isClockwise() && !state) dest.push(p.reverse());
          else {
            dest.push(p);
          }
        }
      }

      removed.forEach(j => queue.splice(queue.indexOf(j), 1));
      removed.forEach(r => queue.forEach(q => containedWithin.remove(q, r)));

      state = !state;

      if (maxLoop-- === 0) {
        VERIFY_NOT_REACHED('Max loop reached');
      }
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
    // TODO: Check multiple rays - or make it more "unique" - or check that intersection is not on endpoints
    const line = new Path(p, [['L', Number.MAX_SAFE_INTEGER / 17, Number.MAX_SAFE_INTEGER / 25]]);
    const intersections = this.all().flatMap(p => p.intersections(line));
    return intersections.length % 2 !== 0;
  }

  isInHole(p: Point): boolean {
    // TODO: Check multiple rays - or make it more "unique" - or check that intersection is not on endpoints
    const line = new Path(p, [['L', Number.MAX_SAFE_INTEGER / 17, Number.MAX_SAFE_INTEGER / 25]]);
    const intersections = this.all().flatMap(p => p.intersections(line));
    return intersections.length > 1 && intersections.length % 2 === 0;
  }

  isOn(p: Point): boolean {
    return this.paths.some(path => path.isOn(p));
  }

  intersections(p: Path): Point[] {
    return this.paths.flatMap(path => path.intersections(p)).map(i => i.point);
  }
}
