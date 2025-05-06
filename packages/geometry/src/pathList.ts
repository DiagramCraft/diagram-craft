import { Path } from './path';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { Box } from './box';
import { MultiMap } from '@diagram-craft/utils/multimap';
import { Transform, TransformFactory } from './transform';
import { Point } from './point';
import { LengthOffsetOnPath, TimeOffsetOnSegment } from './pathPosition';

export class PathList {
  constructor(private paths: Path[]) {}

  singularPath() {
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
    const dest: Path[] = [];
    for (const p of this.paths) {
      dest.push(p.clone());
    }
    return new PathList(dest);
  }

  scale(targetBounds: Box, referenceBounds?: Box) {
    const bounds = referenceBounds ?? this.bounds();

    const t = TransformFactory.fromTo(bounds, targetBounds);

    const dest: Path[] = [];
    for (const p of this.paths) {
      const source = p.bounds();
      const target = Transform.box(source, ...t);
      dest.push(p.scale(source, target));
    }

    return new PathList(dest);
  }

  projectPoint(p: Point): { pathIdx: number; offset: TimeOffsetOnSegment & LengthOffsetOnPath } {
    let best:
      | { point: Point; pathIdx: number; offset: TimeOffsetOnSegment & LengthOffsetOnPath }
      | undefined = undefined;
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

  split(p: { pathIdx: number; offset: TimeOffsetOnSegment }): [PathList, PathList] {
    const [before, after] = this.paths[p.pathIdx].split(p.offset);

    return [
      new PathList([...this.paths.slice(0, p.pathIdx), before]),
      new PathList([after, ...this.paths.slice(p.pathIdx + 1)])
    ];
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
    for (const path of this.paths) {
      if (path.isOn(p)) return true;
    }
    return false;
  }

  intersections(p: Path): Point[] {
    return this.all()
      .flatMap(path => path.intersections(p))
      .map(i => i.point);
  }
}
