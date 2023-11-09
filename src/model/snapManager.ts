import { Box, Direction, Line, Point } from '../geometry/geometry.ts';
import { Anchor, Axis, LoadedDiagram, NodeHelper, ResolvedNodeDef } from './diagram.ts';
import { Guide } from './selectionState.ts';
import { largest, smallest } from '../utils/array.ts';
import { Range } from '../geometry/range.ts';
import { VERIFY_NOT_REACHED } from '../utils/assert.ts';

type SnapResult = {
  guides: Guide[];
  adjusted: Box;
  anchors: Anchor[];
};

type MatchingAnchorPair = {
  self: Anchor;
  matching: Anchor;
};

interface SnapProvider {
  getAnchors(box: Box): Anchor[];
}

class CanvasSnapProvider implements SnapProvider {
  getAnchors(_box: Box): Anchor[] {
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
}

class NodeSnapProvider implements SnapProvider {
  constructor(
    private readonly diagram: LoadedDiagram,
    private readonly excludedNodeIds: string[]
  ) {}

  // TODO: This can probably be optimized to first check the bounds of the node
  //       before add all the anchors of that node
  getAnchors(_box: Box): Anchor[] {
    const dest: Anchor[] = [];
    for (const node of this.diagram.queryNodes()) {
      if (this.excludedNodeIds.includes(node.id)) continue;
      for (const other of NodeHelper.anchors(node.bounds)) {
        dest.push(other);
      }
    }
    return dest;
  }
}

class NodeDistanceSnapProvider implements SnapProvider {
  constructor(
    private readonly diagram: LoadedDiagram,
    private readonly excludedNodeIds: string[]
  ) {}

  private get(b: Box, dir: 'e' | 'w' | 'n' | 's') {
    if (dir === 'e' || dir === 'w') {
      return dir === 'e' ? b.pos.x + b.size.w : b.pos.x;
    } else {
      return dir === 'n' ? b.pos.y : b.pos.y + b.size.h;
    }
  }

  private getRange(b: Box, axis: Axis) {
    if (axis === 'x') {
      return Range.create(b.pos.x, b.pos.x + b.size.w)!;
    } else {
      return Range.create(b.pos.y, b.pos.y + b.size.h)!;
    }
  }

  private getMidpoint(a: Box, b: Box, axis: Axis) {
    return Range.midpoint(Range.intersection(this.getRange(a, axis), this.getRange(b, axis))!);
  }

  getAnchors(box: Box): Anchor[] {
    const result: Record<Direction, { node: ResolvedNodeDef }[]> = {
      n: [],
      w: [],
      e: [],
      s: []
    };

    for (const node of this.diagram.queryNodes()) {
      if (this.excludedNodeIds.includes(node.id)) continue;
      if (Box.intersects(node.bounds, box)) continue;
      if (node.bounds.rotation !== 0) continue;

      if (
        Range.overlaps(this.getRange(node.bounds, 'x'), this.getRange(box, 'x')) ||
        Range.overlaps(this.getRange(node.bounds, 'y'), this.getRange(box, 'y'))
      ) {
        if (this.get(node.bounds, 's') < box.pos.y) {
          result.n.push({ node });
        } else if (this.get(node.bounds, 'e') < box.pos.x) {
          result.w.push({ node });
        } else if (node.bounds.pos.x > this.get(box, 'e')) {
          result.e.push({ node });
        } else if (node.bounds.pos.y > this.get(box, 's')) {
          result.s.push({ node });
        } else {
          VERIFY_NOT_REACHED();
        }
      }
    }

    const anchorPositions = {
      x: new Set<number>(),
      y: new Set<number>()
    };

    const baseDistanceAnchor = {
      offset: { x: 0, y: 0 },
      type: 'distance' as const
    };

    const anchors: Anchor[] = [];

    const directions: {
      dir: Direction;
      oDir: Direction;
      sign: 1 | -1;
      axis: Axis;
      oAxis: Axis;
    }[] = [
      { dir: 'n', oDir: 's', axis: 'x', oAxis: 'y', sign: -1 },
      { dir: 's', oDir: 'n', axis: 'x', oAxis: 'y', sign: 1 },
      { dir: 'w', oDir: 'e', axis: 'y', oAxis: 'x', sign: -1 },
      { dir: 'e', oDir: 'w', axis: 'y', oAxis: 'x', sign: 1 }
    ];

    for (const { dir, axis, sign, oDir, oAxis } of directions) {
      // Sort all by being closest
      // ... for north and south we want to sort with largest first
      // ... for east and south we want to sort with smallest first
      result[dir].sort((a, b) => {
        const ab = a.node.bounds;
        const bb = b.node.bounds;
        return sign * (this.get(ab, oDir) - this.get(bb, oDir));
      });

      for (let i = 0; i < result[dir].length - 1; i++) {
        const first = result[dir][i].node.bounds;

        const distances: number[] = [];
        for (let j = i + 1; j < result[dir].length; j++) {
          const d = sign * (this.get(result[dir][j].node.bounds, oDir) - this.get(first, dir));
          if (d > 0) distances.push(d);
        }

        for (const d of distances) {
          const pos = this.get(first, oDir) - sign * d;
          if (anchorPositions[oAxis].has(pos)) continue;

          anchors.push({
            ...baseDistanceAnchor,
            pos: {
              x: axis === 'x' ? this.getMidpoint(first, box, axis) : pos,
              y: axis === 'y' ? this.getMidpoint(first, box, axis) : pos
            },
            axis,
            matchDirection: dir
          });

          anchorPositions[oAxis].add(pos);
        }
      }
    }

    return anchors;
  }
}

export class SnapManager {
  private threshold = 10;

  constructor(private readonly diagram: LoadedDiagram) {}

  private matchAnchors(selfAnchors: Anchor[], otherAnchors: Anchor[]): MatchingAnchorPair[] {
    const dest: MatchingAnchorPair[] = [];

    for (const other of otherAnchors) {
      for (const self of selfAnchors) {
        if (other.axis !== self.axis) continue;

        if (other.matchDirection && other.matchDirection !== self.matchDirection) continue;

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
    const snapProviders = [
      //new NodeSnapProvider(this.diagram, excludeNodeIds),
      new NodeDistanceSnapProvider(this.diagram, excludeNodeIds)
      //new CanvasSnapProvider()
    ];

    const anchorsToMatchAgainst = snapProviders.flatMap(e => e.getAnchors(b));

    const matchingAnchors = this.matchAnchors(selfAnchors, anchorsToMatchAgainst);

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
      anchors: anchorsToMatchAgainst,
      adjusted: newBounds.getSnapshot()
    };
  }
}
