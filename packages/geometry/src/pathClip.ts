import { Point } from './point';
import { LineSegment, PathSegment } from './pathSegment';
import {
  assert,
  mustExist,
  NOT_IMPLEMENTED_YET,
  VERIFY_NOT_REACHED
} from '@diagram-craft/utils/assert';
import { Path } from './path';
import { Vector } from './vector';
import { MultiMap } from '@diagram-craft/utils/multimap';
import { isSame, mod } from '@diagram-craft/utils/math';
import { PathList } from './pathList';
import { Random } from '@diagram-craft/utils/random';
import { range, sortBy } from '@diagram-craft/utils/array';
import { newid } from '@diagram-craft/utils/id';
import { constructPathTree } from './pathUtils';

/* CORE TYPES ***************************************************************************** */

/* We first define the core data-structure which consists of a linked list (internal)
 * of Vertex objects. There are multiple types of Vertex depending on what they represent
 */

interface BaseVertex {
  type: 'simple' | 'overlap' | 'crossing' | 'transient' | 'degeneracy';
  point: Point;
  segment: PathSegment;
  label?: string;
  prev: Vertex;
  next: Vertex;
}

interface BaseIntersectionVertex extends BaseVertex {
  alpha: number;
  neighbor: Vertex;
  classification?: 'in->out' | 'out->in';
}

interface OverlapVertex extends BaseIntersectionVertex {
  type: 'overlap';
  neighbor: OverlapVertex;
  overlapId: string;
}

interface CrossingVertex extends BaseIntersectionVertex {
  type: 'crossing';
  neighbor: CrossingVertex;
}

interface DegeneracyVertex extends BaseIntersectionVertex {
  type: 'degeneracy';
  neighbor: DegeneracyVertex;
}

interface SimpleVertex extends BaseVertex {
  type: 'simple';
}

interface TransientVertex extends BaseVertex {
  type: 'transient';
}

type IntersectionVertex = OverlapVertex | CrossingVertex | DegeneracyVertex;
type Vertex = IntersectionVertex | SimpleVertex | TransientVertex;

type VertexState = 'initial' | 'pre-clip' | 'post-clip';

const isDegeneracy = (v: Vertex): v is DegeneracyVertex => v.type === 'degeneracy';
const isOverlap = (v: Vertex): v is OverlapVertex => v.type === 'overlap';
const isCrossing = (v: Vertex): v is CrossingVertex => v.type === 'crossing';
export const isIntersection = (v: Vertex): v is IntersectionVertex =>
  isOverlap(v) || isCrossing(v) || isDegeneracy(v);
function assertIntersection(v: Vertex): asserts v is IntersectionVertex {
  assert.true(isIntersection(v));
}

type VertexList = {
  path: Path;
  vertices: Vertex[];
};

export type BooleanOperation =
  | 'A union B'
  | 'A not B'
  | 'B not A'
  | 'A intersection B'
  | 'A xor B'
  | 'A divide B';

/* CORE ALGORITHM ************************************************************************* */

/*
 * This implementation is based on https://www.inf.usi.ch/hormann/papers/Greiner.1998.ECO.pdf
 */
export const applyBooleanOperation = (
  subject: PathList,
  clip: PathList,
  operation: BooleanOperation
): Array<PathList> => {
  const doApplyOperation = (operation: BooleanOperation) => {
    const vertices = getClipVertices(subject, clip);

    const relations = calculateSubShapeRelations(vertices[0], vertices[1]);
    const groups = groupSubShapes(relations);

    switch (operation) {
      case 'A union B': {
        const dest: Path[] = [];

        for (const shape of groups.nonCrossing) {
          if (!isShapeInsideOtherShape(shape, relations)) dest.push(shape.path);
        }

        for (const group of groups.crossing) {
          classifyClipVertices(group, [false, false]);
          dest.push(...clipVertices(group).all());
        }
        return [new PathList(dest)];
      }
      case 'A not B': {
        const dest: PathList[] = [];

        const disjointResult = processDisjointPathsHierarchy(subject, clip, groups, type =>
          [
            'ROOT/subject-outline',
            'ROOT/subject-hole',
            'subject-outline/clip-outline',
            'subject-outline/clip-hole',
            'subject-outline/subject-hole'
          ].includes(type)
        );
        if (disjointResult.length > 0) dest.push(new PathList(disjointResult));

        const destPath: Array<Path> = [];
        for (const group of groups.crossing) {
          classifyClipVertices(group, [false, true]);
          destPath.push(...clipVertices(group).all());
        }
        return [...dest, ...(destPath.length > 0 ? [new PathList(destPath)] : [])];
      }
      case 'B not A': {
        const dest: PathList[] = [];

        const disjointResult = processDisjointPathsHierarchy(subject, clip, groups, type =>
          [
            'ROOT/clip-outline',
            'ROOT/clip-hole',
            'clip-outline/subject-outline',
            'clip-outline/subject-hole',
            'clip-outline/clip-hole'
          ].includes(type)
        );
        if (disjointResult.length > 0) dest.push(new PathList(disjointResult));

        const destPath: Array<Path> = [];
        for (const group of groups.crossing) {
          classifyClipVertices(group, [true, false]);
          destPath.push(...clipVertices(group).all());
        }
        return [...dest, ...(destPath.length > 0 ? [new PathList(destPath)] : [])];
      }
      case 'A intersection B': {
        const dest: Path[] = [];

        for (const shape of groups.nonCrossing) {
          if (isShapeInsideOtherShape(shape, relations)) dest.push(shape.path);
        }

        for (const group of groups.crossing) {
          classifyClipVertices(group, [true, true]);
          dest.push(...clipVertices(group).all());
        }
        return dest.flatMap(e => e.segments).length > 0 ? [new PathList(dest)] : [];
      }
      case 'A xor B': {
        const cp1 = applyBooleanOperation(subject, clip, 'A not B');
        const cp2 = applyBooleanOperation(subject, clip, 'B not A');
        return [...cp1, ...cp2];
      }
      case 'A divide B': {
        return [
          ...applyBooleanOperation(subject, clip, 'A xor B'),
          ...applyBooleanOperation(subject, clip, 'A intersection B')
        ];
      }
    }
  };

  return doApplyOperation(operation)
    .map(a => a.normalize())
    .map(a => a.clone());
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
export const getClipVertices = (
  subject: PathList,
  clip: PathList
): [VertexList[], VertexList[]] => {
  const intersectionVertices = new MultiMap<PathSegment, CrossingVertex | OverlapVertex>();

  for (const p1 of subject.all()) {
    for (const p2 of clip.all()) {
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

              makeNeighbors(t1, o1);

              if (
                isSame(t1.alpha!, 0) ||
                isSame(t1.alpha!, 1) ||
                isSame(t1.neighbor!.alpha!, 0) ||
                isSame(t1.neighbor!.alpha!, 1)
              ) {
                changeVertexType(t1, 'degeneracy', 'initial');
              }

              intersectionVertices.add(thisSegment, t1);
              intersectionVertices.add(otherSegment, o1);
            } else if (intersection.type === 'overlap') {
              // TODO: Perhaps move this into Path.overlap
              if (
                Point.distance(intersection.start!, intersection.end!) <
                epsilon(thisSegment.length())
              ) {
                continue;
              }

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

              makeNeighbors(t1, o1);

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

              makeNeighbors(t2, o2);

              intersectionVertices.add(thisSegment, t2);
              intersectionVertices.add(otherSegment, o2);
            }
          }
        }
      }
    }
  }

  // Sort into the target vertex lists
  const [subjectVertices, clipVertices] = removeRedundantVertices(
    sortIntoVertexList([subject, clip], intersectionVertices)
  );

  // Fix linked list
  subjectVertices.forEach(makeLinkedList);
  clipVertices.forEach(makeLinkedList);

  assignLabels('s', subjectVertices);
  assignLabels('c', clipVertices);

  DEBUG: {
    assertVerticesAreCorrect(subjectVertices, clipVertices, 'pre-clip');
    assertConsistency(subjectVertices, clipVertices);
  }

  // Clip segments
  subjectVertices.forEach(splitSegments);
  clipVertices.forEach(splitSegments);

  DEBUG: {
    assertPathSegmentsAreConnected(subjectVertices, clipVertices);
  }

  // Clip segments
  subjectVertices.forEach(classifyDegeneracies);
  clipVertices.forEach(classifyDegeneracies);

  DEBUG: {
    assertPathSegmentsAreConnected(subjectVertices, clipVertices);
  }

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
  shapes: [Array<VertexList>, Array<VertexList>],
  type: [boolean, boolean]
) => {
  const crossings: Point[] = [];
  const doClassifyClipVertices = (
    currentShape: Array<VertexList>,
    start: boolean,
    otherShape: PathList
  ) => {
    for (let i = 0; i < currentShape.length; i += 1) {
      const vertices = currentShape[i].vertices;

      const [v0, j0] = findStartingPositionNotOnPath(vertices, otherShape);
      assert.present(v0);
      const p0 = v0.point;

      /*
        if P0 inside other polygon
          status = exit
        else
          status = entry
        end if
      */
      let status = otherShape.isInside(p0);
      if (start) status = !status;

      // for each vertex Pi of polygon do
      // ... starting at j0
      for (let J = 0; J < vertices.length; J++) {
        const j = (J + j0) % vertices.length;
        const intersection = vertices[j];

        // if Pi->intersect then
        if (isIntersection(intersection)) {
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
  doClassifyClipVertices(shapes[0], type[0], new PathList(shapes[1].map(e => e.path)));
  doClassifyClipVertices(shapes[1], type[1], new PathList(shapes[0].map(e => e.path)));

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
const clipVertices = (shapes: [Array<VertexList>, Array<VertexList>]) => {
  const [subject] = shapes;

  let unprocessedIntersectingPoints = subject.flatMap(e => e.vertices).filter(isIntersection);

  const dest: Array<Vertex[]> = [];

  const markAsProcessed = (current: Vertex) => {
    unprocessedIntersectingPoints = unprocessedIntersectingPoints.filter(
      v => v !== current && (!isIntersection(current) || v !== current.neighbor)
    );
  };

  // while unprocessed intersecting points in subject polygon
  while (unprocessedIntersectingPoints.length > 0) {
    let current = unprocessedIntersectingPoints[0];

    // newPolygon
    const currentContour: Array<Vertex> = [];
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

/* SUPPORTING THE CORE ALGORITHM ********************************************************** */

const processDisjointPathsHierarchy = (
  subject: PathList,
  clip: PathList,
  groups: ReturnType<typeof groupSubShapes>,
  includePath: (type: string) => boolean
) => {
  const disjointHierarchy = Array.from(
    constructPathTree(Array.from(groups.nonCrossing).map(e => e.path)).entries()
  ).reverse();

  const paths: Array<Path> = [];
  if (disjointHierarchy.length === 0) return paths;

  const subjectTree = constructPathTree(subject.all());
  const clipTree = constructPathTree(clip.all());

  const typeString = (p: Path) =>
    subjectTree.has(p) ? `subject-${subjectTree.get(p)?.type}` : `clip-${clipTree.get(p)?.type}`;

  for (const [path, hierarchy] of disjointHierarchy) {
    if (hierarchy.depth !== 0) continue;

    if (includePath(`ROOT/${typeString(path)}`)) {
      paths.push(path);
    }
  }

  let depth = disjointHierarchy[0][1].depth;
  while (depth >= 1) {
    for (const [path, hierarchy] of disjointHierarchy) {
      if (hierarchy.depth !== depth) continue;

      const parent = mustExist(hierarchy.parent);
      if (includePath(`${typeString(parent)}/${typeString(path)}`)) {
        paths.push(path);
      }
    }
    depth--;
  }

  return paths;
};

type SubShapeRelation = {
  subject: VertexList;
  clip: VertexList;
  subjectInClip: boolean;
  clipInSubject: boolean;
  crossing: boolean;
};

const calculateSubShapeRelations = (subjectLists: VertexList[], clipLists: VertexList[]) => {
  const entries: SubShapeRelation[] = [];

  for (const subject of subjectLists) {
    for (const clip of clipLists) {
      entries.push({
        subject,
        clip,
        subjectInClip: subject.vertices.every(
          v => clip.path.isInside(v.point) || clip.path.isOn(v.point)
        ),
        clipInSubject: clip.vertices.every(
          v => subject.path.isInside(v.point) || subject.path.isOn(v.point)
        ),
        crossing: subject.vertices.some(
          v => isIntersection(v) && clip.vertices.includes(v.neighbor)
        )
      });
    }
  }

  return entries;
};

const groupSubShapes = (entries: SubShapeRelation[]) => {
  const crossingShapes: Array<[VertexList[], VertexList[]]> = [];
  let remainingCrossings = entries.filter(a => a.crossing);
  while (remainingCrossings.length > 0) {
    const unprocessedCrossings: SubShapeRelation[] = [];
    const subjects = new Set<VertexList>();
    const clips = new Set<VertexList>();

    const first = remainingCrossings.shift()!;
    subjects.add(first.subject);
    clips.add(first.clip);

    for (let i = 0; i < remainingCrossings.length; i++) {
      const relation = remainingCrossings[i];
      if (subjects.has(relation.subject) || clips.has(relation.clip)) {
        subjects.add(relation.subject);
        clips.add(relation.clip);
      } else {
        unprocessedCrossings.push(relation);
      }
    }

    crossingShapes.push([[...subjects], [...clips]]);
    remainingCrossings = unprocessedCrossings;
  }

  const crossingShapesSet = new Set(crossingShapes.flat(2));
  const nonCrossingShapes = new Set(
    entries.flatMap(e => [e.subject, e.clip]).filter(v => !crossingShapesSet.has(v))
  );

  return {
    crossing: crossingShapes,
    nonCrossing: nonCrossingShapes
  };
};

const isShapeInsideOtherShape = (shape: VertexList, entries: SubShapeRelation[]) => {
  return entries.some(
    e => (e.subject === shape && e.subjectInClip) || (e.clip === shape && e.clipInSubject)
  );
};

const classifyDegeneracies = (vertexList: VertexList) => {
  for (const vertex of vertexList.vertices.filter(isDegeneracy)) {
    const p = vertex.point;

    const ot1 = Vector.angle(Vector.from(p, vertex.neighbor.prev.point));
    const ot2 = Vector.angle(Vector.from(p, vertex.neighbor.next.point));
    const t1 = Vector.angle(Vector.from(p, vertex.prev.point));
    const t2 = Vector.angle(Vector.from(p, vertex.next.point));

    const arr = sortBy(
      [
        { label: 'o', angle: ot1 },
        { label: 'o', angle: ot2 },
        { label: 't', angle: t1 },
        { label: 't', angle: t2 }
      ],
      e => e.angle
    ).map(e => e.label);

    // Check if any two consecutive angles belong to the same polygon (either 'o' or 't')
    // This indicates a simple intersection rather than a crossing
    if (arr[0] === arr[1] || arr[1] === arr[2] || arr[2] === arr[3]) {
      changeVertexType(vertex, 'simple');
    } else {
      changeVertexType(vertex, 'crossing');
    }
  }
};

const splitSegments = (vertexList: VertexList) => {
  const vertices = vertexList.vertices;
  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i];

    const clips: Array<IntersectionVertex> = [];
    for (let j = i + 1; j < vertices.length; j++) {
      const c = vertices[j];
      if (c.segment !== vertices[i].segment) break;

      assertIntersection(c);

      DEBUG: {
        if (clips.length > 0) {
          assert.true(clips[clips.length - 1].alpha < c.alpha, 'Alpha must be in ascending order');
        }
      }
      clips.push(c);
    }

    if (clips.length === 0) continue;

    i += clips.length - 1;
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
        // TODO: Not sure this logic is correct in all situations
        //       We should add tests
        const [a, b] = remaining.split(c.alpha / r);
        r = c.alpha;
        remaining = a;
        c.segment = b;
      }
    }

    current.segment = remaining;
  }
};

const sortIntoVertexList = (
  shapes: [PathList, PathList],
  intersectionVertices: MultiMap<PathSegment, IntersectionVertex>
): [VertexList[], VertexList[]] => {
  const result: Array<VertexList[]> = [];

  // First, sort all vertices into one set of vertices,
  // both simple and intersection vertices
  for (const shape of shapes) {
    const interimResult: VertexList[] = [];

    for (const path of shape.all()) {
      const vertices: Array<Vertex> = [];
      for (const segment of path.segments) {
        const intersections = intersectionVertices.get(segment) ?? [];
        intersections.sort((a, b) => a.alpha - b.alpha);
        vertices.push(makeVertex({ type: 'simple', point: segment.start, segment: segment }));
        vertices.push(...intersections);
      }

      interimResult.push({ path, vertices });
    }

    result.push(interimResult);
  }

  assertTwoElements(result);
  return result;
};

const removeRedundantVertices = (
  shapes: [VertexList[], VertexList[]]
): [VertexList[], VertexList[]] => {
  let results: Array<VertexList[]> = shapes;

  // Process all vertices to check for redundant vertices
  // We iterate over the pairs of vertices until no more vertices have been deleted
  const deleted = new Set<Vertex>();
  do {
    deleted.clear();

    for (const res of results) {
      for (const entry of res) {
        const vertices = entry.vertices;
        for (let i = 0; i < vertices.length; i++) {
          const first = vertices[i];
          const second = vertices[(i + 1) % vertices.length];

          if (!Point.isEqual(first.point, second.point)) continue;

          const typeSpec = `${first.type}-${second.type}`;
          switch (typeSpec) {
            case 'overlap-simple':
            case 'overlap-crossing':
            case 'overlap-degeneracy':
              deleted.add(second);

              // This means we are at the end of an overlap - we want to keep the overlap node,
              // but make sure it's segment is correct - so we copy from the following node and
              // delete it
              first.segment = second.segment;
              i++;
              break;

            case 'overlap-overlap':
              // Note: this is a special case in which we keep both the end of the first overlap
              // as well as the beginning of the next - and keep a zero length segment
              // in between. If not, we will not have four (two per shape) for each overlap - and
              // the polygon-walk algorithm will fail
              first.segment = new LineSegment(first.point, first.point);
              break;

            case 'crossing-degeneracy':
            case 'crossing-simple':
              deleted.add(second);
              i++;
              break;

            case 'crossing-overlap':
              deleted.add(first);
              break;

            case 'degeneracy-simple':
            case 'degeneracy-overlap':
            case 'degeneracy-degeneracy': {
              if (isSame((first as DegeneracyVertex).alpha, 1)) {
                deleted.add(second);
                i++;
              } else {
                deleted.add(first);
              }
              break;
            }

            case 'simple-overlap':
            case 'simple-crossing':
            case 'simple-degeneracy':
              deleted.add(first);
              break;

            default:
              VERIFY_NOT_REACHED(`Invalid type spec: ${typeSpec}`);
          }
        }
      }
    }

    // Finally remove all deleted vertices
    results = results.map(res =>
      res.map(e => ({
        path: e.path,
        vertices: e.vertices.filter(
          v => !deleted.has(v) && !(isIntersection(v) && deleted.has(v.neighbor!))
        )
      }))
    );
  } while (deleted.size > 0);

  const r = results;
  assertTwoElements(r);
  return r;
};

// TODO: This seems a bit complicated - can it be simplified
const arrangeSegments = (dest: Array<Vertex[]>) => {
  const paths: PathSegment[][] = [];

  for (const contour of dest) {
    const currentPath: PathSegment[] = [];
    for (let i = 0; i < contour.length - 1; i++) {
      const current = contour[i];
      const next = contour[i + 1];
      if (current.next === next || current.next === (next as IntersectionVertex).neighbor) {
        currentPath.push(current.segment);
      } else if (current.prev === next) {
        currentPath.push(next.segment.reverse());
      } else if (isIntersection(next) && current.prev === next.neighbor) {
        currentPath.push(next.neighbor.segment.reverse());
      } else {
        VERIFY_NOT_REACHED();
      }
    }
    paths.push(currentPath.filter(s => s.length() > 0));
  }
  return paths;
};

// This is just for debugging purposes
const assignLabels = (prefix: string, shapes: VertexList[]) => {
  shapes.forEach((vertexList, j) =>
    vertexList.vertices.forEach((e, i) => (e.label = `${prefix}_${j}_${i}`))
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

  // If there's no suitable vertex to start with, we need to try to add a new
  // vertex on one of the existing segments
  if (!p0) {
    const random = new Random();
    for (let j = 0; j < pVertices.length; j++) {
      // We prefer a couple of fixed offset, and then try 10 random offsets
      const offsets = [0.5, 0.25, 0.75, ...range(1, 10).map(() => random.nextRange(0, 1))];
      for (const o of offsets) {
        const current = pVertices[j];
        const p = current.segment.point(o);
        if (!path.isOn(p)) {
          const newVertex = makeVertex({
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

/* UTILITY FUNCTIONS ********************************************************************** */

function assertTwoElements<T>(arg: T[]): asserts arg is [T, T] {
  assert.true(arg.length === 2, 'Expected two elements');
}

const makeVertex = (v: Omit<Vertex, 'prev' | 'next'> & Partial<Pick<Vertex, 'prev' | 'next'>>) => {
  // @ts-ignore
  const ret: Vertex = { ...v };
  assertVertexIsCorrect(ret, 'initial');
  return ret;
};

const makeCrossingVertex = (
  v: Omit<CrossingVertex, 'prev' | 'next' | 'type' | 'classification' | 'neighbor'>
) => makeVertex({ type: 'crossing', ...v }) as CrossingVertex;

const makeOverlapVertex = (
  v: Omit<OverlapVertex, 'prev' | 'next' | 'type' | 'classification' | 'neighbor'>
) => makeVertex({ type: 'overlap', ...v }) as OverlapVertex;

const changeVertexType = (
  v: Vertex,
  type: BaseVertex['type'],
  state: VertexState = 'post-clip'
) => {
  interface VertexSuperSet
    extends Pick<BaseVertex, 'type'>,
      Partial<Pick<BaseIntersectionVertex, 'neighbor'>>,
      Partial<Omit<CrossingVertex, 'type' | 'neighbor'>>,
      Partial<Omit<OverlapVertex, 'type' | 'neighbor'>>,
      Partial<Omit<DegeneracyVertex, 'type' | 'neighbor'>>,
      Partial<Omit<TransientVertex, 'type'>>,
      Partial<Omit<SimpleVertex, 'type'>> {}

  const vertex = v as VertexSuperSet;
  if (isIntersection(v)) {
    const n = v.neighbor;
    const neighbor = v.neighbor as VertexSuperSet;

    if (type === 'simple') {
      vertex.type = 'simple';
      vertex.neighbor = undefined;
      vertex.alpha = undefined;

      neighbor.type = 'simple';
      neighbor.neighbor = undefined;
      neighbor.alpha = undefined;

      assertVertexIsCorrect(v, state);
      assertVertexIsCorrect(n, state);
      return;
    } else if (isCrossing(v) && type === 'degeneracy') {
      vertex.type = 'degeneracy';
      neighbor.type = 'degeneracy';

      assertVertexIsCorrect(v, state);
      assertVertexIsCorrect(n, state);
      return;
    } else if (isDegeneracy(v) && type === 'crossing') {
      vertex.type = 'crossing';
      neighbor.type = 'crossing';

      assertVertexIsCorrect(v, state);
      assertVertexIsCorrect(n, state);
      return;
    }
  }

  NOT_IMPLEMENTED_YET();
};

const makeLinkedList = (vertexList: VertexList) => {
  for (let i = 0; i < vertexList.vertices.length; i++) {
    vertexList.vertices[i].next = vertexList.vertices[mod(i + 1, vertexList.vertices.length)];
    vertexList.vertices[i].prev = vertexList.vertices[mod(i - 1, vertexList.vertices.length)];
  }
};

const makeNeighbors = (v: IntersectionVertex, neighbor: IntersectionVertex) => {
  v.neighbor = neighbor;
  neighbor.neighbor = v;
};

const epsilon = (scale: number) => Math.max(0.1, scale * 0.01);

/* INVARIANTS AND ASSERTIONS ************************************************************** */

const assertVerticesAreCorrect = (
  subject: VertexList[],
  clip: VertexList[],
  state: VertexState = 'post-clip'
) => {
  subject.forEach(vl => vl.vertices.forEach(v => assertVertexIsCorrect(v, state)));
  clip.forEach(vl => vl.vertices.forEach(v => assertVertexIsCorrect(v, state)));
};

const assertConsistency = (subject: VertexList[], clip: VertexList[]) => {
  // 1. Assert that each vertex only exists once

  const subjectVerticesSet = new Set<Vertex>();
  for (const vertexList of subject) {
    for (const vertex of vertexList.vertices) {
      assert.false(subjectVerticesSet.has(vertex));
      subjectVerticesSet.add(vertex);
    }
  }

  const clipVerticesSet = new Set<Vertex>();
  for (const vertexList of clip) {
    for (const vertex of vertexList.vertices) {
      assert.false(clipVerticesSet.has(vertex));
      clipVerticesSet.add(vertex);
    }
  }

  // 2. Assert the linked list and neighbors

  const verifyLinkedListAndNeighbor = (vertexList: VertexList, set: Set<Vertex>) => {
    for (let i = 0; i < vertexList.vertices.length; i++) {
      const current = vertexList.vertices[i];

      const next = vertexList.vertices[(i + 1) % vertexList.vertices.length];
      const prev =
        vertexList.vertices[(i + vertexList.vertices.length - 1) % vertexList.vertices.length];

      assert.true(current.next === next);
      assert.true(current.prev === prev);

      assert.true(current.prev.next === current);
      assert.true(current.next.prev === current);

      if (isIntersection(current)) {
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

  for (const vertexList of subject) {
    verifyLinkedListAndNeighbor(vertexList, clipVerticesSet);
  }

  for (const vertexList of clip) {
    verifyLinkedListAndNeighbor(vertexList, subjectVerticesSet);
  }
};

const assertPathSegmentsAreConnected = (subject: VertexList[], clip: VertexList[]) => {
  assertVerticesAreCorrect(subject, clip);

  for (const list of [subject, clip]) {
    for (const vertexList of list) {
      const vertices = vertexList.vertices;
      for (let i = 0; i < vertices.length; i++) {
        const current = vertices[i];
        const next = vertices[(i + 1) % vertices.length];
        assert.true(
          Point.isEqual(current.segment.end, next.point, epsilon(current.segment.length()))
        );
      }
    }
  }
};

const assertVertexIsCorrect = (v: Vertex, state: VertexState = 'post-clip') => {
  if (state !== 'initial') {
    if (v.type === 'overlap') {
      assert.present(v.neighbor);
      assert.present(v.alpha);
      assert.present(v.overlapId);
    }

    if (v.type === 'crossing') {
      assert.present(v.neighbor);
      assert.present(v.alpha);
    }

    assert.present(v.type);
    assert.present(v.segment);
  }

  if (state === 'post-clip') {
    assert.true(Point.isEqual(v.point, v.segment.start, epsilon(v.segment.length())));
  }
};

// @ts-ignore
const printVertex = (v: Vertex) => {
  console.log(
    `${v.type} (${v.point.x}, ${v.point.y}): (${v.segment.start.x}, ${v.segment.start.y}) -> (${v.segment.end.x}, ${v.segment.end.y})`
  );
};
