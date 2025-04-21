import { CompoundPath } from './pathBuilder';
import { Point } from './point';
import { PathSegment } from './pathSegment';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { Path } from './path';
import { Vector } from './vector';
import { MultiMap } from '@diagram-craft/utils/multimap';
import { isSame } from '@diagram-craft/utils/math';

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
  a: CompoundPath,
  b: CompoundPath,
  operation: BooleanOperation
): CompoundPath[] => {
  const vertices = getClipVertices(a, b);

  // This is sufficient as any intersection will be in each list of vertices
  const isIntersecting = vertices[0].filter(v => v.intersect).length > 0;

  switch (operation) {
    case 'A union B':
      if (!isIntersecting) return [a, b];
      classifyClipVertices(vertices, [a, b], [false, false]);
      return [clipVertices(vertices)];
    case 'A not B':
      if (!isIntersecting) return [a];
      classifyClipVertices(vertices, [a, b], [false, true]);
      return [clipVertices(vertices)];
    case 'B not A':
      if (!isIntersecting) return [b];
      classifyClipVertices(vertices, [a, b], [true, false]);
      return [clipVertices(vertices)];
    case 'A intersection B': {
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
  p: CompoundPath,
  intersectionVertices: MultiMap<PathSegment, Vertex>
) => {
  const dest: Vertex[] = [];
  for (const s of p.singularPath().segments) {
    const intersectionsOnSegment = intersectionVertices.get(s) ?? [];
    intersectionsOnSegment.sort((a, b) => a.alpha - b.alpha);

    dest.push({
      point: s.start,
      segment: s,
      alpha: 0,
      intersect: false,
      prev: SENTINEL_VERTEX,
      next: SENTINEL_VERTEX
    });

    dest.push(...intersectionsOnSegment);
  }
  return dest;
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

const arrangeSegments = (dest: Vertex[][]) => {
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

const assertConsistency = (subjectVertices: Vertex[], clipVertices: Vertex[]) => {
  const subjectVerticesSet = new Set<Vertex>();
  for (let i = 0; i < subjectVertices.length; i++) {
    const current = subjectVertices[i];
    assert.false(subjectVerticesSet.has(current));
    subjectVerticesSet.add(current);

    const next = subjectVertices[(i + 1) % subjectVertices.length];
    const prev = subjectVertices[(i + subjectVertices.length - 1) % subjectVertices.length];

    assert.true(current.next === next);
    assert.true(current.prev === prev);
  }

  const clipVerticesSet = new Set<Vertex>();
  for (let i = 0; i < clipVertices.length; i++) {
    const current = clipVertices[i];
    assert.false(clipVerticesSet.has(current));
    clipVerticesSet.add(current);

    const next = clipVertices[(i + 1) % clipVertices.length];
    const prev = clipVertices[(i + clipVertices.length - 1) % clipVertices.length];

    assert.true(current.next === next);
    assert.true(current.prev === prev);
  }

  // Check that neighbors are consistent
  for (const v of subjectVertices) {
    assert.true(v.prev.next === v);
    assert.true(v.next.prev === v);

    if (v.neighbor) {
      assert.true(v === v.neighbor.neighbor);
      assert.true(clipVerticesSet.has(v.neighbor));
    }
  }
  for (const v of clipVertices) {
    assert.true(v.prev.next === v);
    assert.true(v.next.prev === v);

    if (v.neighbor) {
      assert.true(v === v.neighbor.neighbor);
      assert.true(subjectVerticesSet.has(v.neighbor));
    }
  }
};

const assertPathSegmentsAreConnected = (subjectVertices: Vertex[], clipVertices: Vertex[]) => {
  for (let i = 0; i < subjectVertices.length; i++) {
    const current = subjectVertices[i];
    const next = subjectVertices[(i + 1) % subjectVertices.length];
    if (!Point.isEqual(current.segment.end, next.point, current.segment.length() * 0.001)) {
      console.log(i, current.segment.end, next.point);
      assert.fail();
    }
  }
  for (let i = 0; i < clipVertices.length; i++) {
    const current = clipVertices[i];
    const next = clipVertices[(i + 1) % clipVertices.length];
    if (!Point.isEqual(current.segment.end, next.point, current.segment.length() * 0.001)) {
      console.log(current.segment.end, next.point);
      assert.fail();
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
export const getClipVertices = (cp1: CompoundPath, cp2: CompoundPath): [Vertex[], Vertex[]] => {
  assert.true(cp1.all().length === 1);
  assert.true(cp2.all().length === 1);

  const intersectionVertices = new MultiMap<PathSegment, Vertex>();

  for (const thisSegment of cp1.singularPath().segments) {
    for (const otherSegment of cp2.singularPath().segments) {
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

  // Sort into the target vertex lists
  const subjectVertices = sortIntoVertexList(cp1, intersectionVertices);
  const clipVertices = sortIntoVertexList(cp2, intersectionVertices);

  // Fix linked list
  makeLinkedList(subjectVertices);
  makeLinkedList(clipVertices);

  // This is just for debugging purposes
  subjectVertices.forEach((e, i) => (e.label = 's_' + i));
  clipVertices.forEach((e, i) => (e.label = 'c_' + i));

  // Remove duplicate points'
  removeDuplicatePoints(subjectVertices);
  removeDuplicatePoints(clipVertices);

  DEBUG: {
    assertConsistency(subjectVertices, clipVertices);
  }

  // Clip segments
  clipSegments(subjectVertices);
  clipSegments(clipVertices);

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
  vertices: [Array<Vertex>, Array<Vertex>],
  paths: [CompoundPath, CompoundPath],
  type: [boolean, boolean]
) => {
  assert.true(paths[0].all().length === 1);
  assert.true(paths[1].all().length === 1);

  // for both polygons P do
  for (const i of [0, 1]) {
    const p = paths[i].singularPath();
    const p0 = p.segments[0].start;

    /*
      if P0 inside other polygon
        status = exit
      else
        status = entry
      end if
     */
    let status = paths[1 - i].singularPath().isInside(p0);
    if (type[i]) status = !status;

    // for each vertex Pi of polygon do
    for (let i1 = 0; i1 < vertices[i].length; i1++) {
      const intersection = vertices[i][i1];

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
            i1 > 0 &&
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
export const clipVertices = (p: [Array<Vertex>, Array<Vertex>]) => {
  const [subject] = p;

  let unprocessedIntersectingPoints = subject.filter(v => v.intersect);

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

  return new CompoundPath(
    arrangeSegments(dest).map(arr => {
      return new Path(
        arr[0].start,
        arr.flatMap(s => s.raw())
      );
    })
  );
};
