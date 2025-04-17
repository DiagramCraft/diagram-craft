import { CompoundPath } from './pathBuilder';
import { Point } from './point';
import { PathSegment } from './pathSegment';
import { assert, VERIFY_NOT_REACHED, VerifyNotReached } from '@diagram-craft/utils/assert';
import { Path } from './path';

type VertexType = 'in->out' | 'out->in';

type Vertex = {
  point: Point;
  segment: PathSegment;
  alpha: number;

  prev: Vertex;
  next: Vertex;
} & (
  | { intersect: true; neighbor: Vertex; type?: VertexType }
  | { intersect: false; neighbor?: never; type?: VertexType }
);

// @ts-expect-error placeholder value to handle partial contstruction
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
 * The implementation is based on https://www.inf.usi.ch/hormann/papers/Greiner.1998.ECO.pdf
 */

export const applyBooleanOperation = (
  a: CompoundPath,
  b: CompoundPath,
  operation: BooleanOperation
): CompoundPath[] => {
  const vertices = getClipVertices(a, b);

  switch (operation) {
    case 'A union B':
      classifyClipVertices(vertices, [a, b], [false, false]);
      return [clipVertices(vertices)];
    case 'A not B':
      classifyClipVertices(vertices, [a, b], [false, true]);
      return [clipVertices(vertices)];
    case 'B not A':
      classifyClipVertices(vertices, [a, b], [true, false]);
      return [clipVertices(vertices)];
    case 'A intersection B':
      classifyClipVertices(vertices, [a, b], [true, true]);
      return [clipVertices(vertices)];
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
    default:
      throw new VerifyNotReached();
  }
};

const clipSegments = (vertices: Vertex[]) => {
  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i];

    const clips: Vertex[] = [];
    for (let j = i + 1; j < vertices.length; j++) {
      if (!vertices[j].intersect) break;
      clips.push(vertices[j]);
    }

    if (clips.length === 0) continue;

    clips.reverse();

    let remaining = current.segment;

    for (const c of clips) {
      const clipped = current.segment.split(c.alpha);
      remaining = clipped[0];
      c.segment = clipped[1];
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

const sortIntoVertexList = (p: CompoundPath, intersectionVertices: Map<PathSegment, Vertex[]>) => {
  const dest: Vertex[] = [];
  for (const s of p.singularPath().segments) {
    dest.push({
      point: s.start,
      segment: s,
      alpha: 0,
      intersect: false,
      prev: SENTINEL_VERTEX,
      next: SENTINEL_VERTEX
    });
    dest.push(...(intersectionVertices.get(s) ?? []).sort((a, b) => a.alpha - b.alpha));
  }
  return dest;
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

  const intersectionVertices: Map<PathSegment, Vertex[]> = new Map();

  for (const s of cp1.singularPath().segments) {
    for (const c of cp2.singularPath().segments) {
      const intersections = s.intersectionsWith(c) ?? [];
      for (const intersection of intersections) {
        const p1 = s.projectPoint(intersection);
        const i1: Vertex = {
          point: intersection,
          segment: s,
          alpha: p1.t,
          intersect: true,
          prev: SENTINEL_VERTEX,
          next: SENTINEL_VERTEX,
          neighbor: SENTINEL_VERTEX
        };

        const p2 = c.projectPoint(intersection);
        const i2: Vertex = {
          point: intersection,
          segment: c,
          alpha: p2.t,
          intersect: true,
          prev: SENTINEL_VERTEX,
          next: SENTINEL_VERTEX,
          neighbor: SENTINEL_VERTEX
        };

        i1.neighbor = i2;
        i2.neighbor = i1;

        if (!intersectionVertices.has(s)) intersectionVertices.set(s, []);
        if (!intersectionVertices.has(c)) intersectionVertices.set(c, []);

        intersectionVertices.get(s)!.push(i1);
        intersectionVertices.get(c)!.push(i2);
      }
    }
  }

  // Sort into the target vertex lists
  const subjectVertices = sortIntoVertexList(cp1, intersectionVertices);
  const clipVertices = sortIntoVertexList(cp2, intersectionVertices);

  // Fix linked list
  makeLinkedList(subjectVertices);
  makeLinkedList(clipVertices);

  // Clip segments
  clipSegments(subjectVertices);
  clipSegments(clipVertices);

  return [subjectVertices, clipVertices];
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
  intersections: [Array<Vertex>, Array<Vertex>],
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
    for (const intersection of intersections[i]) {
      // if Pi->intersect then
      if (intersection.intersect) {
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

      assert.false(maxLoop === 0);
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
