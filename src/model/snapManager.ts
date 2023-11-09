import { Box, Line, Point } from '../geometry/geometry.ts';
import { Anchor, Axis, LoadedDiagram, NodeHelper } from './diagram.ts';
import { Guide } from './selectionState.ts';
import { largest, smallest } from '../utils/array.ts';

type SnapResult = {
  guides: Guide[];
  adjusted: Box;
};

type MatchingAnchorPair = {
  self: Anchor;
  matching: Anchor;
};

export class SnapManager {
  private threshold = 10;

  constructor(private readonly diagram: LoadedDiagram) {}

  // TODO: This can probably be optimized to first check the bounds of the node
  //       before add all the anchors of that node
  private getNodeAnchors(excludeNodeIds: string[] = []): Anchor[] {
    const dest: Anchor[] = [];
    for (const node of this.diagram.queryNodes()) {
      if (excludeNodeIds.includes(node.id)) continue;
      for (const other of NodeHelper.anchors(node.bounds)) {
        dest.push(other);
      }
    }
    return dest;
  }

  // TODO: Need a way to get the canvas bounds
  private getCanvasAnchors(): Anchor[] {
    return [
      {
        offset: { x: 0, y: 0 },
        pos: { x: 320, y: 0 },
        axis: 'y',
        type: 'canvas'
      },
      {
        offset: { x: 0, y: 0 },
        pos: { x: 320, y: 480 },
        axis: 'y',
        type: 'canvas'
      },
      {
        offset: { x: 0, y: 0 },
        pos: { x: 0, y: 240 },
        axis: 'x',
        type: 'canvas'
      },
      {
        offset: { x: 0, y: 0 },
        pos: { x: 640, y: 240 },
        axis: 'x',
        type: 'canvas'
      }
    ];
  }

  private matchAnchors(selfAnchors: Anchor[], otherAnchors: Anchor[]): MatchingAnchorPair[] {
    const dest: MatchingAnchorPair[] = [];

    for (const other of otherAnchors) {
      for (const self of selfAnchors) {
        if (other.axis !== self.axis) continue;

        const oAxis = Axis.orthogonal(other.axis);
        if (Math.abs(other.pos[oAxis] - self.pos[oAxis]) < this.threshold) {
          dest.push({ self, matching: other });
        }
      }
    }

    return dest;
  }

  // TODO: Ideally we should find a better way to exclude the currently selected node
  //       maybe we can pass in the current selection instead of just the box (bounds)
  snap(b: Box, excludeNodeIds: string[] = []): SnapResult {
    const selfAnchors = NodeHelper.anchors(b);

    // TODO: Maybe we should also snap to the "old" location
    const matchingAnchors = this.matchAnchors(selfAnchors, [
      ...this.getNodeAnchors(excludeNodeIds),
      ...this.getCanvasAnchors()
    ]);

    const newBounds = Box.asMutableSnapshot(b);

    // Snap to the closest matching anchor in each direction
    for (const axis of Axis.axises()) {
      const oAxis = Axis.orthogonal(axis);

      // Find anchor with the closest orthogonal distance to the matching anchor line
      // i.e. optimize for snapping the least distance
      const closest = smallest(
        matchingAnchors.filter(a => a.self.axis === axis),
        (a, b) =>
          Math.abs(a.matching.pos[oAxis] - a.self.pos[oAxis]) -
          Math.abs(b.matching.pos[oAxis] - b.self.pos[oAxis])
      );

      if (closest === undefined) continue;

      newBounds.get('pos')[oAxis] = closest.matching.pos[oAxis] - closest.self.offset[oAxis];
    }

    // Readjust self anchors to the new position - post snapping
    for (const a of selfAnchors) {
      a.pos = Point.add(newBounds.get('pos'), a.offset);
    }

    // Check for guides in all four directions for each matching anchor
    // ... also draw the guide to the matching anchor that is furthest away
    const guides: Guide[] = [];
    for (const self of selfAnchors) {
      const axis = self.axis;
      const oAxis = Axis.orthogonal(axis);

      const otherAnchorsForAnchor = matchingAnchors.filter(a => a.self === self);
      if (otherAnchorsForAnchor.length === 0) continue;

      for (const dir of [-1, 1]) {
        const match = largest(
          otherAnchorsForAnchor
            .map(anchor => ({
              anchor,
              distance: Point.subtract(self.pos, anchor.matching.pos)
            }))

            // only keep items on the right side of the self anchor
            .filter(e => e.distance[axis] * dir > 0)

            // and remove anything that is not ortho-linear
            .filter(e => Math.abs(e.distance[oAxis]) < 1),
          (a, b) => {
            return Math.abs(a.distance[axis]) - Math.abs(b.distance[axis]);
          }
        )?.anchor;

        if (!match) continue;

        guides.push({
          line: Line.extend(
            Line.from(match.matching.pos, match.self.pos),
            match.self.offset[axis],
            match.self.offset[axis]
          ),
          type: match.matching.type
        });
      }
    }

    return {
      guides,
      adjusted: newBounds.getSnapshot()
    };
  }
}
