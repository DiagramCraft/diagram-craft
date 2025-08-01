import { Point } from './point';
import { LineSegment, PathSegment } from './pathSegment';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { Path } from './path';
import { Vector } from './vector';
import { MultiMap } from '@diagram-craft/utils/multimap';
import { isSame, mod } from '@diagram-craft/utils/math';
import { PathList } from './pathList';
import { Random } from '@diagram-craft/utils/random';
import { range } from '@diagram-craft/utils/array';
import { newid } from '@diagram-craft/utils/id';

type IntersectionClassification = 'in->out' | 'out->in';

type VertexType = 'simple' | 'overlap' | 'crossing' | 'transient';

type BaseVertex = {
  type: VertexType;
  point: Point;
  segment: PathSegment;

  label?: string;

  alpha?: number;
  neighbor?: Vertex;
  //classification?: IntersectionClassification;

  prev: Vertex;
  next: Vertex;
};

type BaseIntersectionVertex = BaseVertex & {
  alpha: number;
  classification: IntersectionClassification;
  neighbor: Vertex;
};

type OverlapVertex = BaseIntersectionVertex & {
  type: 'overlap';
  overlapId: string;
  neighbor: OverlapVertex;
};

type CrossingVertex = BaseIntersectionVertex & {
  type: 'crossing';
  neighbor: CrossingVertex;
};

type SimpleVertex = BaseVertex & {
  type: 'simple';
};

type TransientVertex = BaseVertex & {
  type: 'transient';
};

export type IntersectionVertex = OverlapVertex | CrossingVertex;
export type Vertex = OverlapVertex | CrossingVertex | SimpleVertex | TransientVertex;

type VertexList = Vertex[];

export const isOverlap = (v: Vertex): v is OverlapVertex => v.type === 'overlap';
export const isCrossing = (v: Vertex): v is CrossingVertex => v.type === 'crossing';
export const isIntersection = (v: Vertex): v is IntersectionVertex => isOverlap(v) || isCrossing(v);

const clearNeighbor = (v: IntersectionVertex) => {
  if (v.neighbor) {
    const n = v.neighbor;

    // @ts-ignore
    v.type = 'simple';
    // @ts-ignore
    v.intersect = false;
    // @ts-ignore
    v.neighbor = undefined;
    // @ts-ignore
    //v.alpha = undefined;

    // @ts-ignore
    n.type = 'simple';
    // @ts-ignore
    n.intersect = false;
    // @ts-ignore
    n.neighbor = undefined;
    // @ts-ignore
    //n.alpha = undefined;

    verifyVertex(v);
    verifyVertex(n);
  }
};

const addNeighbor = (
  v: CrossingVertex | OverlapVertex,
  neighbor: CrossingVertex | OverlapVertex
) => {
  v.neighbor = neighbor;
  neighbor.neighbor = v;
};

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

const makeVertex = (v: Omit<Vertex, 'prev' | 'next'> & { prev?: Vertex; next?: Vertex }) => {
  // @ts-ignore
  const ret: Vertex = {
    prev: SENTINEL_VERTEX,
    next: SENTINEL_VERTEX,
    ...v
  };
  verifyVertex(ret, true);

  return ret;
};

const makeCrossingVertex = (
  v: Omit<CrossingVertex, 'prev' | 'next' | 'type' | 'classification' | 'neighbor' | 'intersect'>
) => {
  return makeVertex({
    type: 'crossing',
    ...v
  }) as CrossingVertex;
};

const makeOverlapVertex = (
  v: Omit<
    OverlapVertex,
    'prev' | 'next' | 'type' | 'classification' | 'neighbor' | 'otherOverlap' | 'intersect'
  >
) => {
  return makeVertex({
    type: 'overlap',
    ...v
  }) as OverlapVertex;
};

const verifyVertex = (v: Vertex, initial = false) => {
  if (!initial) {
    /*if (v.intersect) {
      assert.present(v.neighbor);
      assert.true(v.type === 'overlap' || v.type === 'crossing');
    }*/

    if (v.type === 'overlap') {
      assert.present(v.neighbor);
    }

    if (v.type === 'crossing') {
      assert.present(v.neighbor);
    }
  }
};

/*
 * This implementation is based on https://www.inf.usi.ch/hormann/papers/Greiner.1998.ECO.pdf
 */

export const applyBooleanOperation = (
  a: PathList,
  b: PathList,
  operation: BooleanOperation
): Array<PathList> => {
  const doApplyOperation = (operation: BooleanOperation, a: PathList, b: PathList) => {
    const vertices = getClipVertices(a, b);

    // We need to classify vertices to determine if each intersection is also a crossing
    classifyClipVertices(vertices, [a, b], [false, false]);

    const hasCrossings =
      vertices[0][0].filter(v => isIntersection(v)).length > 0 &&
      vertices[1][0].filter(v => isIntersection(v)).length > 0;

    // TODO: this assumes there's only one path in each compound path
    const aContainedInB =
      !hasCrossings && vertices[0][0].every(v => b.isInside(v.point) || b.isOn(v.point));
    const bContainedInA =
      !hasCrossings && vertices[1][0].every(v => a.isInside(v.point) || a.isOn(v.point));

    switch (operation) {
      case 'A union B':
        if (!hasCrossings) {
          if (aContainedInB) return [b];
          else if (bContainedInA) return [a];
          else return [a, b];
        }

        classifyClipVertices(vertices, [a, b], [false, false]);
        return [clipVertices(vertices)];
      case 'A not B':
        if (!hasCrossings) {
          if (aContainedInB) return [];
          else if (bContainedInA) {
            return [new PathList([...a.all(), ...b.all()])];
          } else return [a];
        }

        classifyClipVertices(vertices, [a, b], [false, true]);
        return [clipVertices(vertices)];
      case 'B not A':
        if (!hasCrossings) {
          if (bContainedInA) return [];
          else if (aContainedInB) {
            return [new PathList([...b.all(), ...a.all()])];
          } else return [b];
        }

        classifyClipVertices(vertices, [a, b], [true, false]);
        return [clipVertices(vertices)];
      case 'A intersection B': {
        if (!hasCrossings) {
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

  return doApplyOperation(operation, a, b)
    .map(a => a.normalize())
    .map(a => a.clone());
};

const clipSegments = (vertices: Vertex[]) => {
  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i];

    const clips: Array<OverlapVertex | CrossingVertex> = [];
    for (let j = i + 1; j < vertices.length; j++) {
      if (vertices[j].segment !== vertices[i].segment) break;
      DEBUG: {
        assert.true(isOverlap(vertices[j]) || isCrossing(vertices[j]));

        if (clips.length > 0) {
          assert.true(
            clips[clips.length - 1].alpha < (vertices[j] as OverlapVertex | CrossingVertex).alpha!,
            'Alpha must be in ascending order'
          );
        }
      }
      clips.push(vertices[j] as OverlapVertex | CrossingVertex);
    }

    if (clips.length === 0) continue;

    i += clips.length;
    clips.reverse();

    let remaining = current.segment;

    let r = 1;
    for (const c of clips) {
      if (c.alpha === 0) {
        remaining = new LineSegment(remaining.end, remaining.end);
        c.segment = remaining;
      } else if (c.alpha === 1) {
        remaining = c.segment;
        c.segment = new LineSegment(c.point, c.point);
      } else {
        const [a, b] = remaining.split(c.alpha / r);
        r = c.alpha;
        remaining = a;
        c.segment = b;
      }
    }

    current.segment = remaining;
  }
};

const makeLinkedList = (vertices: Vertex[]) => {
  for (let i = 0; i < vertices.length; i++) {
    vertices[i].next = vertices[mod(i + 1, vertices.length)];
    vertices[i].prev = vertices[mod(i - 1, vertices.length)];
  }
};

const sortIntoVertexList = (
  pathList: PathList,
  intersectionVertices: MultiMap<PathSegment, CrossingVertex | OverlapVertex>
) => {
  const dest: VertexList[] = [];
  for (const path of pathList.all()) {
    // At this point, there are a number of issues to resolve. We have
    // more vertices than needed, in particular
    //
    // 1. For each original vertex on a segment of the other shape, there
    //    is one additional intersection vertices, one with alpha=0
    //
    // 2. For some overlap there are additional vertices at each end, can be
    //    either regular or intersections. Also the end of the overlap has
    //    the same segment as the beginning of the overlap

    const candidateVertices: VertexList = [];

    for (const segment of path.segments) {
      const intersectionsOnSegment = intersectionVertices.get(segment) ?? [];
      intersectionsOnSegment.sort((a, b) => a.alpha! - b.alpha!);

      // Issue 1
      // In case there's an intersection that starts at the same position, we
      // omit the original vertex, and add the intersection instead
      if (!intersectionsOnSegment.find(v => v.alpha === 0)) {
        candidateVertices.push(
          makeVertex({ type: 'simple', point: segment.start, segment: segment })
        );
      }

      candidateVertices.push(...intersectionsOnSegment);
    }

    // Issue 2
    // Remove any intersections that have the same point as the overlap
    const vertices: Vertex[] = [];
    const toDelete = new Set<Vertex>();
    for (let i = 0; i < candidateVertices.length; i++) {
      const current = candidateVertices[i];
      const next = candidateVertices[(i + 1) % candidateVertices.length];

      if (Point.isEqual(current.point, next.point) && isOverlap(current) && !isOverlap(next)) {
        toDelete.add(next);
        current.segment = next.segment;
        i++;
      }
    }

    for (const v of candidateVertices) {
      if (toDelete.has(v)) {
        if (isCrossing(v) || isOverlap(v)) {
          clearNeighbor(v);
        }
      } else {
        vertices.push(v);
      }
    }
    dest.push(vertices);
  }

  return dest;
};

// @ts-ignore
export const dumpVertexList = (
  vertices: Vertex[],
  options: {
    alpha?: boolean;
    length?: boolean;
  } = {
    alpha: true
  }
) => {
  const label = (v: Vertex) => `${v.label}_${isIntersection(v) ? '*' : '_'}`;

  const l1 = vertices.map(v => label(v));
  const l2 = vertices.map(v => (isIntersection(v) ? '  |  ' : ' '.repeat(5)));

  const l4 = vertices.map(v => (isIntersection(v) ? label(v.neighbor!) : ' '.repeat(5)));
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
    const alpha = vertices.map(v => (isIntersection(v) ? v.alpha!.toFixed(3) : ' '.repeat(5)));
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
    paths.push(currentPath.filter(s => s.length() > 0));
  }
  return paths;
};

const assertVertices = (subjectVertices: VertexList[], clipVertices: VertexList[]) => {
  subjectVertices.forEach(vertexList => vertexList.forEach(v => verifyVertex(v)));
  clipVertices.forEach(vertexList => vertexList.forEach(v => verifyVertex(v)));
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
        assert.true(
          set.has(current.neighbor),
          `${current.label} : ${current.neighbor.label} not in set ${[...set.keys()].map(e => e.label)}`
        );

        assert.true(
          current.type === current.neighbor.type,
          `${current.type} != ${current.neighbor.type}`
        );
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

// This is just for debugging purposes
const assignLabels = (prefix: string, vertices: VertexList[]) => {
  vertices.forEach((vertexList, j) =>
    vertexList.forEach((e, i) => (e.label = `${prefix}_${j}_${i}`))
  );
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
  const intersectionVertices = new MultiMap<PathSegment, CrossingVertex | OverlapVertex>();

  for (const p1 of cp1.all()) {
    for (const p2 of cp2.all()) {
      for (const thisSegment of p1.segments) {
        for (const otherSegment of p2.segments) {
          const intersections =
            thisSegment.intersectionsWith(otherSegment, { includeOverlaps: true }) ?? [];

          for (const intersection of intersections) {
            if (intersection.type === 'intersection') {
              const ta1 = thisSegment.projectPoint(intersection.point).t;
              const oa1 = otherSegment.projectPoint(intersection.point).t;

              // In case we have an intersection at alpha=1, it means that the next line
              // will also have an intersection at alpha=0 - to not keep duplicates,
              // we only keep the ones for alpha=0
              if (isSame(ta1, 1) || isSame(oa1, 1)) continue;

              const t1 = makeCrossingVertex({
                point: intersection.point,
                segment: thisSegment,
                alpha: ta1
              });

              const o1 = makeCrossingVertex({
                point: intersection.point,
                segment: otherSegment,
                alpha: oa1
              });

              addNeighbor(t1, o1);

              intersectionVertices.add(thisSegment, t1);
              intersectionVertices.add(otherSegment, o1);
            } else if (intersection.type === 'overlap') {
              const overlapId = newid();

              const t1 = makeOverlapVertex({
                point: intersection.start!,
                segment: thisSegment,
                alpha: thisSegment.projectPoint(intersection.start!).t,
                overlapId
              });

              const o1 = makeOverlapVertex({
                point: intersection.start!,
                segment: otherSegment,
                alpha: otherSegment.projectPoint(intersection.start!).t,
                overlapId
              });

              addNeighbor(t1, o1);

              intersectionVertices.add(thisSegment, t1);
              intersectionVertices.add(otherSegment, o1);

              const t2 = makeOverlapVertex({
                point: intersection.end!,
                segment: thisSegment,
                alpha: thisSegment.projectPoint(intersection.end!).t,
                overlapId
              });

              const o2 = makeOverlapVertex({
                point: intersection.end!,
                segment: otherSegment,
                alpha: otherSegment.projectPoint(intersection.end!).t,
                overlapId
              });

              addNeighbor(t2, o2);

              intersectionVertices.add(thisSegment, t2);
              intersectionVertices.add(otherSegment, o2);
            }
          }
        }
      }
    }
  }

  // Sort into the target vertex lists
  const subjectVertices = sortIntoVertexList(cp1, intersectionVertices);
  const clipVertices = sortIntoVertexList(cp2, intersectionVertices);

  DEBUG: {
    assertVertices(subjectVertices, clipVertices);
  }

  // Fix linked list
  subjectVertices.forEach(vertexList => makeLinkedList(vertexList));
  clipVertices.forEach(vertexList => makeLinkedList(vertexList));

  assignLabels('s', subjectVertices);
  assignLabels('c', clipVertices);

  DEBUG: {
    assertVertices(subjectVertices, clipVertices);
    assertConsistency(subjectVertices, clipVertices);
  }

  // Clip segments
  subjectVertices.forEach(vertexList => clipSegments(vertexList));
  clipVertices.forEach(vertexList => clipSegments(vertexList));

  DEBUG: {
    assertVertices(subjectVertices, clipVertices);
    assertPathSegmentsAreConnected(subjectVertices, clipVertices);
  }

  return [subjectVertices, clipVertices];
};

const findValidPreviousVertex = (v: Vertex) => {
  assert.present(v);
  let prev = v.prev;
  if (prev.segment.length() === 0) {
    prev = prev.prev;
  }
  return prev;
};

const isDegeneracy = (v: IntersectionVertex) => {
  return (
    //v.intersect &&
    isSame(v.alpha!, 0) ||
    isSame(v.alpha!, 1) ||
    isSame(v.neighbor!.alpha!, 0) ||
    isSame(v.neighbor!.alpha!, 1)
  );
};

// Need to find a point that is either inside or outside - as a starting point
const findStartingPositionNotOnPath = (
  pVertices: Vertex[],
  path: PathList
): [Vertex | undefined, number] => {
  let p0: Vertex | undefined;
  let j0 = 0;

  // First look at all existing vertices
  while (j0 < pVertices.length) {
    const p = pVertices[j0];
    if (!path.isOn(p.point)) {
      p0 = p;
      break;
    }
    j0++;
  }

  // If none is suitable, we need to try to add a new vertex on one of the segments
  const random = new Random(1234);
  if (!p0) {
    for (let j = 0; j < pVertices.length; j++) {
      const offsets = [0.5, 0.25, 0.75, ...range(1, 10).map(() => random.nextRange(0, 1))];
      for (const o of offsets) {
        const current = pVertices[j];
        const p = current.segment.point(o);
        if (!path.isOn(p)) {
          const newVertex: Vertex = makeVertex({
            point: p,
            segment: new LineSegment(p, p),
            next: current.next,
            prev: current,
            type: 'transient'
          });
          current.next = newVertex;
          pVertices.splice(j + 1, 0, newVertex);

          return [newVertex, j + 1];
        }
      }
    }
  }

  return [p0, j0];
};

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
  const crossings: Point[] = [];
  const doClassifyClipVertices = (pVertexList: Array<VertexList>, start: boolean, q: PathList) => {
    for (let i = 0; i < pVertexList.length; i += 1) {
      const pVertices = pVertexList[i];

      const [v0, j0] = findStartingPositionNotOnPath(pVertices, q);
      assert.present(v0);
      const p0 = v0.point;

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
      // ... starting at j0
      for (let J = 0; J < pVertices.length; J++) {
        const j = (J + j0) % pVertices.length;
        const intersection = pVertices[j];

        // if Pi->intersect then
        if (isIntersection(intersection)) {
          if (isDegeneracy(intersection)) {
            if (!intersection.neighbor) {
              console.log(intersection);
            }
            const ot1 = Vector.angle(
              Vector.from(intersection.point, findValidPreviousVertex(intersection.neighbor!).point)
            );

            const ot2 = Vector.angle(
              Vector.from(intersection.point, intersection.neighbor!.next.point)
            );

            const t1 = Vector.angle(
              Vector.from(intersection.point, findValidPreviousVertex(intersection).point)
            );

            const t2 = Vector.angle(Vector.from(intersection.point, intersection.next.point));

            const arr = [
              { label: 'o', angle: ot1 },
              { label: 'o', angle: ot2 },
              { label: 't', angle: t1 },
              { label: 't', angle: t2 }
            ];
            arr.sort((a, b) => a.angle - b.angle);

            if (
              intersection.type !== 'overlap' &&
              (arr[0].label === arr[1].label ||
                arr[1].label === arr[2].label ||
                arr[2].label === arr[3].label)
            ) {
              // @ts-ignore
              intersection.type = 'simple';
              // @ts-ignore
              intersection.intersect = false;
              // @ts-ignore
              intersection.neighbor!.type = 'simple';
              // @ts-ignore
              intersection.neighbor!.intersect = false;

              continue;
            }
          }

          crossings.push(intersection.point);

          // Pi->entry_exit = status
          intersection.classification = status ? 'in->out' : 'out->in';

          // toggle status
          status = !status;
        }
      }
    }
  };

  // for both polygons P do
  doClassifyClipVertices(vertices[0], type[0], paths[1]);
  doClassifyClipVertices(vertices[1], type[1], paths[0]);

  return crossings;
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

  let unprocessedIntersectingPoints = subject.flatMap(e => e).filter(isIntersection);

  const dest: Vertex[][] = [];

  const markAsProcessed = (current: Vertex) => {
    unprocessedIntersectingPoints = unprocessedIntersectingPoints.filter(
      v => v !== current && v !== current.neighbor
    );
  };

  // while unprocessed intersecting points in subject polygon
  while (unprocessedIntersectingPoints.length > 0) {
    let current = unprocessedIntersectingPoints[0];

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

      if (current.classification === 'in->out') {
        // repeat
        //   ...
        // until current->intersect
        let inner: Vertex = current;
        let maxLoop = 1000;
        do {
          // current = current->next
          inner = inner.next;
          if (isIntersection(inner)) {
            current = inner;
            break;
          }

          // newVertex(current)
          currentContour.push(inner);
        } while (--maxLoop > 0);
        assert.true(maxLoop > 0);
      } else if (current.classification === 'out->in') {
        // repeat
        //   ...
        // until current->intersect
        let inner: Vertex = current;
        let maxLoop = 1000;
        do {
          // current = current->prev
          inner = inner.prev;
          if (isIntersection(inner)) {
            current = inner;
            break;
          }

          // newVertex(current)
          currentContour.push(inner);
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
    arrangeSegments(dest)
      .map(arr => {
        // TODO: Handle this better
        if (arr.length === 0) return new Path({ x: 0, y: 0 }, []);
        return new Path(
          arr[0].start,
          arr.flatMap(s => s.raw())
        );
      })
      .filter(p => p.hasArea())
  );
};

export const _test = {};
