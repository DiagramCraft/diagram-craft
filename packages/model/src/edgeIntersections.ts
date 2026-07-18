import { Point } from '@diagram-craft/geometry/point';
import type { DiagramEdge } from './diagramEdge';
import type { Diagram } from './diagram';
import { isEdge } from './diagramElement';

export type Intersection = {
  point: Point;
  type: 'above' | 'below';
};

export const intersectionListIsSame = (a: Intersection[], b: Intersection[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Point.isEqual(a[i]!.point, b[i]!.point)) return false;
    if (a[i]!.type !== b[i]!.type) return false;
  }
  return true;
};

/**
 * Computes line-hop intersections between `edge` and every other visible edge in `diagram`.
 *
 * Edges encountered before `edge` in `diagram.visibleElements()` are reported as type 'above',
 * edges encountered after as 'below' - this determines which edge gets the line-hop drawn in its
 * path when the two edges cross.
 */
export const recalculateIntersections = (edge: DiagramEdge, diagram: Diagram): Intersection[] => {
  let currentEdgeHasBeenSeen = false;
  const path = edge.path();
  const intersections: Intersection[] = [];
  for (const other of diagram.visibleElements()) {
    if (!isEdge(other)) continue;

    if (other === edge) {
      currentEdgeHasBeenSeen = true;
      continue;
    }

    // TODO: There's opportunity to optimize this by using the bounding box, but
    //       this requires the bounds() method to be more accurate

    const otherPath = other.path();
    const intersectionsWithOther = path.intersections(otherPath);
    intersections.push(
      ...intersectionsWithOther.map(e => ({
        point: e.point,
        type: currentEdgeHasBeenSeen ? ('below' as const) : ('above' as const)
      }))
    );
  }

  return intersections;
};
