import { PathList } from './pathListBuilder';
import { Point } from './point';
import { PathSegment } from './pathSegment';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { Path } from './path';
import { Vector } from './vector';
import { MultiMap } from '@diagram-craft/utils/multimap';
import { isSame } from '@diagram-craft/utils/math';
import { Line } from './line';

type VertexType = 'in->out' | 'out->in';

type Vertex = {
  label?: string;
  point: Point;
  segment: PathSegment;
  alpha: number;

  prev: Vertex;
  next: Vertex;
} & (
  | { intersect: true; neighbor: Vertex; type?: VertexType }
  | { intersect: false; neighbor?: never; type?: VertexType }
);

type VertexList = Vertex[];

// @ts-expect-error placeholder value to handle partial construction
const SENTINEL_VERTEX: Vertex = {
  point: { x: -Infinity, y: -Infinity }
};
SENTINEL_VERTEX.prev = SENTINEL_VERTEX;
SENTINEL_VERTEX.next = SENTINEL_VERTEX;

export type BooleanOperation =
  | 'A union B'
  | 'A not B'
  | 'B not A'
  | 'A intersection B'
  | 'A xor B'
  | 'A divide B';

/*
 * This implementation is based on https://www.inf.usi.ch/hormann/papers/Greiner.1998.ECO.pdf
 */

export const applyBooleanOperation = (
  a: PathList,
  b: PathList,
  operation: BooleanOperation
): Array<PathList> => {
  const vertices = getClipVertices(a, b);

  // We need to classify vertices to determine if each intersection is also a crossing
  classifyClipVertices(vertices, [a, b], [false, false]);

  const isCrossing =
    vertices[0][0].filter(v => v.intersect).length > 0 &&
    vertices[1][0].filter(v => v.intersect).length > 0;

  // Note: this assumes there's only one path in each compound path
  const aContainedInB =
    !isCrossing && vertices[0][0].every(v => b.isInside(v.point) || b.isOn(v.point));
  const bContainedInA =
    !isCrossing && vertices[1][0].every(v => a.isInside(v.point) || a.isOn(v.point));

  switch (operation) {
    case 'A union B':
      if (!isCrossing) {
        if (aContainedInB) return [b];
        else if (bContainedInA) return [a];
        else return [a, b];
      }

      classifyClipVertices(vertices, [a, b], [false, false]);
      return [makeHoles(clipVertices(vertices), a, b)];
    case 'A not B':
      if (!isCrossing) {
        if (aContainedInB) return [];
        else if (bContainedInA) {
          return [new PathList([...a.all(), ...b.all().map(e => e.reverse())])];
        } else return [a];
      }

      classifyClipVertices(vertices, [a, b], [false, true]);
      return [clipVertices(vertices)];
    case 'B not A':
      if (!isCrossing) {
        if (bContainedInA) return [];
        else if (aContainedInB) {
          return [new PathList([...b.all(), ...a.all().map(e => e.reverse())])];
        } else return [b];
      }

      classifyClipVertices(vertices, [a, b], [true, false]);
      return [clipVertices(vertices)];
    case 'A intersection B': {
      if (!isCrossing) {
        if (aContainedInB) return [a];
        else if (bContainedInA) return [b];
        else return [];
      }

      classifyClipVertices(vertices, [a, b], [true, true]);

      const intersection = clipVertices(vertices);
      return intersection.segments().length > 0 ? [intersection] : [];
    }
    case 'A xor B': {
      const cp1 = applyBooleanOperation(a, b, 'A not B');
      const cp2 = applyBooleanOperation(a, b, 'B not A');
      return [...cp1, ...cp2];
    }
    case 'A divide B': {
      return [
        ...applyBooleanOperation(a, b, 'A xor B'),
        ...applyBooleanOperation(a, b, 'A intersection B')
      ];
    }
  }
};

const clipSegments = (vertices: Vertex[]) => {
  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i];
    if (current.intersect && current.alpha !== 0) continue;

    const clips: Vertex[] = [];
    for (let j = i + 1; j < vertices.length; j++) {
      if (!vertices[j].intersect || vertices[j].alpha === 0) break;
      clips.push(vertices[j]);
    }

    if (clips.length === 0) continue;
    clips.reverse();

    let remaining = current.segment;

    let r = 1;
    for (const c of clips) {
      const [a, b] = remaining.split(c.alpha / r);
      r = c.alpha;
      remaining = a;
      c.segment = b;
    }

    current.segment = remaining;
  }
};

const makeLinkedList = (vertices: Vertex[]) => {
  for (let i = 0; i < vertices.length; i++) {
    vertices[i].next = vertices[(i + 1) % vertices.length];
    vertices[i].prev = vertices[i === 0 ? vertices.length - 1 : i - 1];
  }
};

const sortIntoVertexList = (
  pathList: PathList,
  intersectionVertices: MultiMap<PathSegment, Vertex>
) => {
  const dest: VertexList[] = [];
  for (const path of pathList.all()) {
    const vertexList: VertexList = [];
    dest.push(vertexList);

    for (const segment of path.segments) {
      const intersectionsOnSegment = intersectionVertices.get(segment) ?? [];
      intersectionsOnSegment.sort((a, b) => a.alpha - b.alpha);

      vertexList.push({
        point: segment.start,
        segment: segment,
        alpha: 0,
        intersect: false,
        prev: SENTINEL_VERTEX,
        next: SENTINEL_VERTEX
      });

      vertexList.push(...intersectionsOnSegment);
    }
  }

  return dest;
};

/**
 * Finds the closest intersection point between a line segment and a list of paths.
 * Finds all intersections between start and end and returns the one closest to start.
 */
const findClosestIntersection = (start: Point, end: Point, pathList: PathList) => {
  return pathList
    .intersections(new Path(start, [['L', end.x, end.y]]))
    .filter(i => !Point.isEqual(i, start))
    .sort((a, b) => Point.distance(a, start) - Point.distance(b, start))?.[0];
};

/**
 * Find a point inside this path, not inside any of the other paths. This is done
 * by forming a ray from the midpoint of each segment, in the direction of the normal
 * as well as in the opposite direction. A point inside can be found by finding the
 * closest intersection and picking a point on the line between the intersection and
 * the midpoint of the segment.
 */
const findPointInside = (path: Path, pathList: PathList) => {
  // Representing the length of a ray into the infinite distance
  // This is safe as the normal has length 1 - hence the ray will never overflow
  const RAY_LENGTH = Number.MAX_SAFE_INTEGER;

  // Looping through all segments but returning as soon as we find a point inside
  for (const segment of path.segments) {
    const normal = Vector.tangentToNormal(segment.tangent(0.5));
    const midpoint = segment.point(0.5);

    const c1 = findClosestIntersection(midpoint, Vector.scale(normal, RAY_LENGTH), pathList);
    if (c1) {
      const p1 = Line.midpoint(Line.of(midpoint, c1));
      if (path.isInside(p1)) return p1;
    }

    const c2 = findClosestIntersection(midpoint, Vector.scale(normal, -RAY_LENGTH), pathList);
    if (c2) {
      const p2 = Line.midpoint(Line.of(midpoint, c2));
      if (path.isInside(p2)) return p2;
    }
  }
};

const makeHoles = (pathList: PathList, a: PathList, b: PathList) => {
  const dest: Path[] = [];
  for (const path of pathList.all()) {
    const pointInside = findPointInside(path, pathList);

    assert.present(pointInside);

    const isOutsideA = !a.isInside(pointInside) || a.isInHole(pointInside);
    const isOutsideB = !b.isInside(pointInside) || b.isInHole(pointInside);

    if (isOutsideA && isOutsideB && path.isClockwise()) {
      dest.push(path.reverse());
    } else {
      dest.push(path);
    }
  }

  return new PathList(dest);
};

// NOTE: At this point, the vertices are part of a linked list
const removeDuplicatePoints = (vertices: Vertex[]) => {
  const vertexSet = new Set<Vertex>(vertices);

  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i];
    if (!vertexSet.has(current)) continue;

    const next = vertices[(i + 1) % vertices.length];
    const prev = vertices[(i + vertices.length - 1) % vertices.length];

    if (prev.intersect && isSame(prev.alpha, 1)) {
      prev.prev.next = current;
      current.prev = prev.prev;

      vertexSet.delete(prev);

      current.intersect = true;
      current.alpha = 0;
      current.neighbor = prev.neighbor;
      current.neighbor.neighbor = current;
    }

    if (
      Point.isEqual(next.point, current.point) &&
      next.intersect &&
      isSame(next.alpha, current.alpha) &&
      !isSame(next.alpha, 0)
    ) {
      next.next.prev = current;
      current.next = next.next;

      vertexSet.delete(next);

      next.neighbor.neighbor = current;
    }

    if (next.intersect && isSame(next.alpha, 0)) {
      next.next.prev = current;
      current.next = next.next;

      vertexSet.delete(next);

      current.intersect = true;
      current.alpha = 0;
      current.neighbor = next.neighbor;
      current.neighbor.neighbor = current;
    }

    if (current.neighbor) {
      assert.true(current.neighbor.neighbor === current);
      assert.true(current.intersect);
      assert.true(current.neighbor.intersect);
    }
  }

  // Remove all elements from vertices that are not part of vertexSet
  const dest = vertices.filter(v => vertexSet.has(v));
  vertices.splice(0, vertices.length, ...dest);

  DEBUG: {
    for (const v of vertices) {
      if (v.intersect) {
        assert.true(v.neighbor.neighbor === v);
        assert.true(v.neighbor.intersect);
      }
    }
  }
};

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const dumpVertexList = (
  vertices: Vertex[],
  options: {
    alpha?: boolean;
    length?: boolean;
  } = {
    alpha: true
  }
) => {
  const label = (v: Vertex) => `${v.label}_${v.intersect ? '*' : '_'}`;

  const l1 = vertices.map(v => label(v));
  const l2 = vertices.map(v => (v.intersect ? '  |  ' : ' '.repeat(5)));

  const l4 = vertices.map(v => (v.intersect ? label(v.neighbor) : ' '.repeat(5)));
  console.log(l1.join(' --- '));
  console.log(l2.join('     '));

  if (options.length) {
    const len = vertices.map(v => {
      const l = v.segment.length();
      return l.toFixed(4 - Math.floor(l).toString().length);
    });
    console.log(len.join('     '));
  }

  if (options.alpha) {
    const alpha = vertices.map(v => (v.intersect ? v.alpha.toFixed(3) : ' '.repeat(5)));
    console.log(alpha.join('     '));
  }

  console.log(l2.join('     '));
  console.log(l4.join('     '));
};

const arrangeSegments = (dest: VertexList[]) => {
  const paths: PathSegment[][] = [];

  for (const contour of dest) {
    const currentPath: PathSegment[] = [];
    for (let i = 0; i < contour.length - 1; i++) {
      const current = contour[i];
      const next = contour[i + 1];
      if (current.next === next || current.next === next.neighbor) {
        currentPath.push(current.segment);
      } else if (current.prev === next) {
        currentPath.push(next.segment.reverse());
      } else if (current.prev === next.neighbor) {
        currentPath.push(next.neighbor.segment.reverse());
      } else {
        VERIFY_NOT_REACHED();
      }
    }
    paths.push(currentPath);
  }
  return paths;
};

const assertConsistency = (subjectVertices: VertexList[], clipVertices: VertexList[]) => {
  // 1. Assert that each vertex only exists once

  const subjectVerticesSet = new Set<Vertex>();
  for (const vertexList of subjectVertices) {
    for (const vertex of vertexList) {
      assert.false(subjectVerticesSet.has(vertex));
      subjectVerticesSet.add(vertex);
    }
  }

  const clipVerticesSet = new Set<Vertex>();
  for (const vertexList of clipVertices) {
    for (const vertex of vertexList) {
      assert.false(clipVerticesSet.has(vertex));
      clipVerticesSet.add(vertex);
    }
  }

  // 2. Assert the linked list and neighbors

  const verifyLinkedListAndNeighbor = (vertexList: VertexList, set: Set<Vertex>) => {
    for (let i = 0; i < vertexList.length; i++) {
      const current = vertexList[i];

      const next = vertexList[(i + 1) % vertexList.length];
      const prev = vertexList[(i + vertexList.length - 1) % vertexList.length];

      assert.true(current.next === next);
      assert.true(current.prev === prev);

      assert.true(current.prev.next === current);
      assert.true(current.next.prev === current);

      if (current.neighbor) {
        assert.true(current === current.neighbor.neighbor);
        assert.true(set.has(current.neighbor));
      }
    }
  };

  for (const vertexList of subjectVertices) {
    verifyLinkedListAndNeighbor(vertexList, clipVerticesSet);
  }

  for (const vertexList of clipVertices) {
    verifyLinkedListAndNeighbor(vertexList, subjectVerticesSet);
  }
};

const assertPathSegmentsAreConnected = (
  subjectVertices: VertexList[],
  clipVertices: VertexList[]
) => {
  for (const vertexList of subjectVertices) {
    for (let i = 0; i < vertexList.length; i++) {
      const current = vertexList[i];
      const next = vertexList[(i + 1) % vertexList.length];
      if (
        !Point.isEqual(
          current.segment.end,
          next.point,
          Math.max(0.001, current.segment.length() * 0.01)
        )
      ) {
        console.log(i, current.segment.end, next.point);
        assert.fail();
      }
    }
  }
  for (const vertexList of clipVertices) {
    for (let i = 0; i < vertexList.length; i++) {
      const current = vertexList[i];
      const next = vertexList[(i + 1) % vertexList.length];
      if (
        !Point.isEqual(
          current.segment.end,
          next.point,
          Math.max(0.001, current.segment.length() * 0.01)
        )
      ) {
        console.log(current.segment.end, next.point);
        assert.fail();
      }
    }
  }
};

/*
  for each vertex Si of subject polygon do
    for each vertex Cj of clip polygon do
      if intersect(Si,Si+1,Cj,Cj+1,a,b)
        I1 = CreateVertex(Si,Si+1,a)
        I2 = CreateVertex(Cj,Cj+1,b)
        link intersection points I1 and I2
        sort I1 into subject polygon
        sort I2 into clip polygon
      end if
    end for
  end for
 */
export const getClipVertices = (cp1: PathList, cp2: PathList): [VertexList[], VertexList[]] => {
  const intersectionVertices = new MultiMap<PathSegment, Vertex>();

  for (const p1 of cp1.all()) {
    for (const p2 of cp2.all()) {
      for (const thisSegment of p1.segments) {
        for (const otherSegment of p2.segments) {
          const intersections = thisSegment.intersectionsWith(otherSegment);
          if (!intersections) continue;

          for (const intersection of intersections) {
            const i1: Vertex = {
              point: intersection,
              segment: thisSegment,
              alpha: thisSegment.projectPoint(intersection).t,
              intersect: true,
              prev: SENTINEL_VERTEX,
              next: SENTINEL_VERTEX,
              neighbor: SENTINEL_VERTEX
            };

            const i2: Vertex = {
              point: intersection,
              segment: otherSegment,
              alpha: otherSegment.projectPoint(intersection).t,
              intersect: true,
              prev: SENTINEL_VERTEX,
              next: SENTINEL_VERTEX,
              neighbor: SENTINEL_VERTEX
            };

            i1.neighbor = i2;
            i2.neighbor = i1;

            intersectionVertices.add(thisSegment, i1);
            intersectionVertices.add(otherSegment, i2);
          }
        }
      }
    }
  }

  // Sort into the target vertex lists
  const subjectVertices = sortIntoVertexList(cp1, intersectionVertices);
  const clipVertices = sortIntoVertexList(cp2, intersectionVertices);

  // Fix linked list
  subjectVertices.forEach(vertexList => makeLinkedList(vertexList));
  clipVertices.forEach(vertexList => makeLinkedList(vertexList));

  // This is just for debugging purposes
  subjectVertices.forEach(vertexList => vertexList.forEach((e, i) => (e.label = 's_' + i)));
  clipVertices.forEach(vertexList => vertexList.forEach((e, i) => (e.label = 'c_' + i)));

  // Remove duplicate points'
  subjectVertices.forEach(vertexList => removeDuplicatePoints(vertexList));
  clipVertices.forEach(vertexList => removeDuplicatePoints(vertexList));

  DEBUG: {
    assertConsistency(subjectVertices, clipVertices);
  }

  // Clip segments
  subjectVertices.forEach(vertexList => clipSegments(vertexList));
  clipVertices.forEach(vertexList => clipSegments(vertexList));

  DEBUG: {
    assertPathSegmentsAreConnected(subjectVertices, clipVertices);
  }

  return [subjectVertices, clipVertices];
};

const isDegeneracy = (v: Vertex) =>
  v.intersect &&
  (v.alpha === 0 || v.alpha === 1 || v.neighbor.alpha === 0 || v.neighbor.alpha === 1);

/*
  for both polygons P do
    if P0 inside other polygon
      status = exit
    else
      status = entry
    end if
    for each vertex Pi of polygon do
      if Pi->intersect then
        Pi->entry_exit = status
        toggle status
      end if
    end for
  end for
 */
export const classifyClipVertices = (
  vertices: [Array<VertexList>, Array<VertexList>],
  paths: [PathList, PathList],
  type: [boolean, boolean]
) => {
  const doClassifyClipVertices = (pVertexList: Array<VertexList>, start: boolean, q: PathList) => {
    for (let i = 0; i < pVertexList.length; i += 1) {
      const pVertices = pVertexList[i];
      const p0 = pVertices[0].point;

      /*
        if P0 inside other polygon
          status = exit
        else
          status = entry
        end if
      */
      let status = q.isInside(p0);
      if (start) status = !status;

      // for each vertex Pi of polygon do
      for (let j = 0; j < pVertices.length; j++) {
        const intersection = pVertices[j];

        // if Pi->intersect then
        if (intersection.intersect) {
          if (isDegeneracy(intersection)) {
            const ot1 = Vector.angle(
              Vector.from(intersection.point, intersection.neighbor.prev.point)
            );

            const ot2 = Vector.angle(
              Vector.from(intersection.point, intersection.neighbor.next.point)
            );

            const t1 = Vector.angle(Vector.from(intersection.point, intersection.prev.point));

            const t2 = Vector.angle(Vector.from(intersection.point, intersection.next.point));

            const arr = [
              { label: 'o', angle: ot1 },
              { label: 'o', angle: ot2 },
              { label: 't', angle: t1 },
              { label: 't', angle: t2 }
            ];
            arr.sort((a, b) => a.angle - b.angle);

            if (
              j > 0 &&
              (arr[0].label === arr[1].label ||
                arr[1].label === arr[2].label ||
                arr[2].label === arr[3].label)
            ) {
              // @ts-ignore
              intersection.intersect = false;
              intersection.neighbor.intersect = false;
              continue;
            }
          }

          // Pi->entry_exit = status
          intersection.type = status ? 'in->out' : 'out->in';

          // toggle status
          status = !status;
        }
      }
    }
  };

  // for both polygons P do
  doClassifyClipVertices(vertices[0], type[0], paths[1]);
  doClassifyClipVertices(vertices[1], type[1], paths[0]);
};

/*
  while unprocessed intersecting points in subject polygon
    current = first unprocessed intersecting point of subject polygon
    newPolygon
    newVertex(current)
    repeat
      if current->entry
        repeat
          current = current->next
          newVertex(current)
        until current->intersect
      else
        repeat
          current = current->prev
          newVertex(current)
        until current->intersect
      end if
      current = current->neighbor
    until PolygonClosed
  end while
 */
export const clipVertices = (p: [Array<VertexList>, Array<VertexList>]) => {
  const [subject] = p;

  let unprocessedIntersectingPoints = subject.flatMap(e => e).filter(v => v.intersect);

  const dest: Vertex[][] = [];

  const markAsProcessed = (current: Vertex) => {
    unprocessedIntersectingPoints = unprocessedIntersectingPoints.filter(
      v => v !== current && v !== current.neighbor
    );
  };

  // while unprocessed intersecting points in subject polygon
  while (unprocessedIntersectingPoints.length > 0) {
    let current: Vertex = unprocessedIntersectingPoints[0];

    // newPolygon
    const currentContour: Vertex[] = [];
    dest.push(currentContour);

    // newVertex(current)
    currentContour.push(current);

    // repeat
    //   ...
    // until PolygonClosed
    let maxOuterLoop = 1000;
    do {
      markAsProcessed(current);

      if (current.type === 'in->out') {
        // repeat
        //   ...
        // until current->intersect
        let maxLoop = 1000;
        do {
          // current = current->next
          current = current.next;
          if (current.intersect) break;

          // newVertex(current)
          currentContour.push(current);
        } while (--maxLoop > 0);
        assert.true(maxLoop > 0);
      } else if (current.type === 'out->in') {
        // repeat
        //   ...
        // until current->intersect
        let maxLoop = 1000;
        do {
          // current = current->prev
          current = current.prev;
          if (current.intersect) break;

          // newVertex(current)
          currentContour.push(current);
        } while (--maxLoop > 0);
        assert.true(maxLoop > 0);
      } else {
        VERIFY_NOT_REACHED();
      }

      assert.present(current.neighbor);

      current = current.neighbor;
      currentContour.push(current);

      markAsProcessed(current);
    } while (dest.at(-1)![0] !== current && --maxOuterLoop > 0);
    assert.true(maxOuterLoop > 0);
  }

  return new PathList(
    arrangeSegments(dest).map(arr => {
      return new Path(
        arr[0].start,
        arr.flatMap(s => s.raw())
      );
    })
  );
};
