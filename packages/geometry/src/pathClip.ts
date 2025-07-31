import { Point } from './point';
import { LineSegment, PathSegment } from './pathSegment';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { Path } from './path';
import { Vector } from './vector';
import { MultiMap } from '@diagram-craft/utils/multimap';
import { mod } from '@diagram-craft/utils/math';
import { PathList } from './pathList';
import { Random } from '@diagram-craft/utils/random';
import { range } from '@diagram-craft/utils/array';
import { newid } from '@diagram-craft/utils/id';

type IntersectionClassification = 'in->out' | 'out->in';

type VertexType = 'vertex' | 'overlap' | 'intersection' | 'transient';

type BaseVertex = {
  type: VertexType;
  point: Point;
  segment: PathSegment;

  label?: string;

  intersect?: boolean;
  alpha?: number;
  neighbor?: Vertex;
  classification?: IntersectionClassification;

  prev: Vertex;
  next: Vertex;
};

// TODO: Remove this one
type BaseIntersectionVertex = BaseVertex & {
  alpha: number;
  classification: IntersectionClassification;
  neighbor: Vertex;
  intersect: true;
};

type OverlapVertex = BaseVertex &
  BaseIntersectionVertex & {
    type: 'overlap';
    overlapId: string;
    neighbor: OverlapVertex;
  };

type IntersectionVertex = BaseVertex &
  BaseIntersectionVertex & {
    type: 'intersection';
    neighbor: IntersectionVertex;
  };

type BasicVertex = BaseVertex & {
  type: 'vertex';
};

type TransientVertex = BaseVertex & {
  type: 'transient';
};

export type Vertex = OverlapVertex | IntersectionVertex | BasicVertex | TransientVertex;

type VertexList = Vertex[];

const isOverlap = (v: Vertex): v is OverlapVertex => v.type === 'overlap';
const isIntersection = (v: Vertex): v is IntersectionVertex => v.type === 'intersection';

const clearNeighbor = (v: Vertex) => {
  if (v.neighbor) {
    v.neighbor.neighbor = undefined;
    v.neighbor = undefined;
  }
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
  verifyVertex(ret);

  return ret;
};

const makeIntersectionVertex = (
  v: Omit<IntersectionVertex, 'prev' | 'next' | 'type' | 'classification' | 'neighbor'>
) => {
  return makeVertex({
    type: 'intersection',
    ...v
  }) as IntersectionVertex;
};

const makeOverlapVertex = (
  v: Omit<OverlapVertex, 'prev' | 'next' | 'type' | 'classification' | 'neighbor' | 'otherOverlap'>
) => {
  return makeVertex({
    type: 'overlap',
    ...v
  }) as OverlapVertex;
};

const verifyVertex = (_v: Vertex) => {};

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

    const isCrossing =
      vertices[0][0].filter(v => isIntersection(v) || isOverlap(v)).length > 0 &&
      vertices[1][0].filter(v => isIntersection(v) || isOverlap(v)).length > 0;

    // TODO: this assumes there's only one path in each compound path
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
        return [clipVertices(vertices)];
      case 'A not B':
        if (!isCrossing) {
          if (aContainedInB) return [];
          else if (bContainedInA) {
            return [new PathList([...a.all(), ...b.all()])];
          } else return [a];
        }

        classifyClipVertices(vertices, [a, b], [false, true]);
        return [clipVertices(vertices)];
      case 'B not A':
        if (!isCrossing) {
          if (bContainedInA) return [];
          else if (aContainedInB) {
            return [new PathList([...b.all(), ...a.all()])];
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

  return doApplyOperation(operation, a, b)
    .map(a => a.normalize())
    .map(a => a.clone());
};

const clipSegments = (vertices: Vertex[]) => {
  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i];

    const clips: Array<OverlapVertex | IntersectionVertex> = [];
    for (let j = i + 1; j < vertices.length; j++) {
      if (vertices[j].segment !== vertices[i].segment) break;
      DEBUG: {
        assert.true(isOverlap(vertices[j]) || isIntersection(vertices[j]));

        if (clips.length > 0) {
          assert.true(
            clips[clips.length - 1].alpha <
              (vertices[j] as OverlapVertex | IntersectionVertex).alpha!,
            'Alpha must be in ascending order'
          );
        }
      }
      clips.push(vertices[j] as OverlapVertex | IntersectionVertex);
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
  intersectionVertices: MultiMap<PathSegment, IntersectionVertex | OverlapVertex>
) => {
  const dest: VertexList[] = [];
  for (const path of pathList.all()) {
    const vertexList: VertexList = [];
    dest.push(vertexList);

    for (const segment of path.segments) {
      const intersectionsOnSegment = intersectionVertices.get(segment) ?? [];
      intersectionsOnSegment.sort((a, b) => a.alpha! - b.alpha!);

      vertexList.push(
        makeVertex({
          type: 'vertex',
          point: segment.start,
          segment: segment
        })
      );

      vertexList.push(...intersectionsOnSegment);
    }
  }

  return dest;
};

const linkVertices = (subjectVertices: VertexList[], clipVertices: VertexList[]) => {
  for (const subjectVertexList of subjectVertices) {
    for (const subject of subjectVertexList) {
      subject.intersect = false;
      subject.neighbor = undefined;
    }
  }
  for (const clipVertexList of clipVertices) {
    for (const clip of clipVertexList) {
      clip.intersect = false;
      clip.neighbor = undefined;
    }
  }

  for (const subjectVertexList of subjectVertices) {
    for (const clipVertexList of clipVertices) {
      for (let i = 0; i < subjectVertexList.length; i++) {
        for (let j = 0; j < clipVertexList.length; j++) {
          const subject = subjectVertexList[i];
          const clip = clipVertexList[j];

          // If the alpha is 1, it means this vertex is on segment, in this
          // case there's always a corresponding vertex with alpha 0 - and we keep
          // the later. In case this is of type overlap, we keep both alpha=1 and alpha=0
          if (subject.alpha === 1 && !isOverlap(subject)) continue;
          if (clip.alpha === 1 && !isOverlap(clip)) continue;

          // We only match vertex with the same intersection type
          if (subject.type !== clip.type) continue;

          // In case we are looking at an overlap, make sure both subject and clip overlap
          // is the same
          if (isOverlap(subject) && isOverlap(clip)) {
            if (subject.overlapId !== clip.overlapId) continue;
          }

          if (Point.isEqual(subject.point, clip.point)) {
            // Make sure any previous linkage is cleared
            clearNeighbor(subject);
            clearNeighbor(clip);

            // @ts-ignore
            subject.intersect = true;
            // @ts-ignore
            subject.neighbor = clip;
            // @ts-ignore
            clip.intersect = true;
            // @ts-ignore
            clip.neighbor = subject;

            verifyVertex(subject);
            verifyVertex(clip);
          }
        }
      }
    }
  }
};

// NOTE: At this point, the vertices are part of a linked list
const removeDuplicatePoints = (vertices: Vertex[]) => {
  const vertexSet = new Set<Vertex>(vertices);

  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i];
    if (!vertexSet.has(current)) continue;

    let maxLoop = 10000;
    let offset = 1;
    do {
      const next = vertices[mod(i + offset++, vertices.length)];
      if (current.segment !== next.segment) break;
      if (next === current) break;
      if (!Point.isEqual(current.point, next.point)) break;

      if (current.intersect && !next.intersect) {
        vertexSet.delete(next);
      } else if (!current.intersect && next.intersect) {
        vertexSet.delete(current);
      } else if (current.intersect && next.intersect) {
        // Check intersection types
        if (current.type === next.type) {
          vertexSet.delete(next);
        } else if (current.type === 'overlap') {
          vertexSet.delete(next);
        } else {
          vertexSet.delete(current);
        }
      } else {
        vertexSet.delete(next);
      }
    } while (--maxLoop > 0);
  }

  // Remove all elements from vertices that are not part of vertexSet
  const dest = vertices.filter(v => vertexSet.has(v));
  vertices.splice(0, vertices.length, ...dest);

  makeLinkedList(vertices);
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
  const label = (v: Vertex) => `${v.label}_${v.intersect ? '*' : '_'}`;

  const l1 = vertices.map(v => label(v));
  const l2 = vertices.map(v => (v.intersect ? '  |  ' : ' '.repeat(5)));

  const l4 = vertices.map(v => (v.intersect ? label(v.neighbor!) : ' '.repeat(5)));
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
    const alpha = vertices.map(v => (v.intersect ? v.alpha!.toFixed(3) : ' '.repeat(5)));
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
  const intersectionVertices = new MultiMap<PathSegment, IntersectionVertex | OverlapVertex>();

  for (const p1 of cp1.all()) {
    for (const p2 of cp2.all()) {
      for (const thisSegment of p1.segments) {
        for (const otherSegment of p2.segments) {
          const intersections =
            thisSegment.intersectionsWith(otherSegment, { includeOverlaps: true }) ?? [];

          for (const intersection of intersections) {
            if (intersection.type === 'intersection') {
              const t1 = makeIntersectionVertex({
                point: intersection.point,
                segment: thisSegment,
                alpha: thisSegment.projectPoint(intersection.point).t,
                intersect: true
              });

              const o1 = makeIntersectionVertex({
                point: intersection.point,
                segment: otherSegment,
                alpha: otherSegment.projectPoint(intersection.point).t,
                intersect: true
              });

              t1.neighbor = o1;
              o1.neighbor = t1;

              intersectionVertices.add(thisSegment, t1);
              intersectionVertices.add(otherSegment, o1);
            } else if (intersection.type === 'overlap') {
              const overlapId = newid();

              const t1 = makeOverlapVertex({
                point: intersection.start!,
                segment: thisSegment,
                alpha: thisSegment.projectPoint(intersection.start!).t,
                intersect: true,
                overlapId
              });

              const o1 = makeOverlapVertex({
                point: intersection.start!,
                segment: otherSegment,
                alpha: otherSegment.projectPoint(intersection.start!).t,
                intersect: true,
                overlapId
              });

              t1.neighbor = o1;
              o1.neighbor = t1;

              intersectionVertices.add(thisSegment, t1);
              intersectionVertices.add(otherSegment, o1);

              const t2 = makeOverlapVertex({
                point: intersection.end!,
                segment: thisSegment,
                alpha: thisSegment.projectPoint(intersection.end!).t,
                intersect: true,
                overlapId
              });

              const o2 = makeOverlapVertex({
                point: intersection.end!,
                segment: otherSegment,
                alpha: otherSegment.projectPoint(intersection.end!).t,
                intersect: true,
                overlapId
              });

              t2.neighbor = o2;
              o2.neighbor = t2;

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

  // Fix linked list
  subjectVertices.forEach(vertexList => makeLinkedList(vertexList));
  clipVertices.forEach(vertexList => makeLinkedList(vertexList));

  // This is just for debugging purposes
  subjectVertices.forEach((vertexList, j) =>
    vertexList.forEach((e, i) => (e.label = `s_${j}_${i}`))
  );
  clipVertices.forEach((vertexList, j) => vertexList.forEach((e, i) => (e.label = `c_${j}_${i}`)));

  // Remove duplicate points'
  subjectVertices.forEach(vertexList => removeDuplicatePoints(vertexList));
  clipVertices.forEach(vertexList => removeDuplicatePoints(vertexList));

  linkVertices(subjectVertices, clipVertices);

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

const findValidPreviousVertex = (v: Vertex) => {
  assert.present(v);
  let prev = v.prev;
  if (prev.segment.length() === 0) {
    prev = prev.prev;
  }
  return prev;
};

const isDegeneracy = (v: Vertex) =>
  v.intersect &&
  (v.alpha === 0 || v.alpha === 1 || v.neighbor!.alpha === 0 || v.neighbor!.alpha === 1);

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
          const newVertex: Vertex = {
            point: p,
            segment: new LineSegment(p, p),
            next: current.next,
            prev: current,
            alpha: 0,
            intersect: false,
            type: 'transient'
          };
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
        if (intersection.intersect) {
          // TODO: Why is this check really needed
          if (intersection.segment.length() === 0 && intersection.type !== 'overlap') {
            // @ts-ignore
            intersection.intersect = false;
            intersection.neighbor!.intersect = false;
            continue;
          }

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
              intersection.intersect = false;
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

      if (current.classification === 'in->out') {
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
      } else if (current.classification === 'out->in') {
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

export const _test = {
  removeDuplicatePoints: removeDuplicatePoints
};
