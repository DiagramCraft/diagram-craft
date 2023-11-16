import { Direction } from '../../geometry/direction.ts';
import { MatchingAnchorPair, SnapProvider } from './snapManager.ts';
import { VERIFY_NOT_REACHED } from '../../utils/assert.ts';
import { Range } from '../../geometry/range.ts';
import { Point } from '../../geometry/point.ts';
import { Box } from '../../geometry/box.ts';
import { Line } from '../../geometry/line.ts';
import { Extent } from '../../geometry/extent.ts';
import { Guide } from '../selectionState.ts';
import { Diagram, ResolvedNodeDef } from '../../model-viewer/diagram.ts';
import { AnchorOfType, Axis } from './anchor.ts';

const forward: Partial<Record<Direction, Direction>> = {
  n: 's',
  s: 'n'
};

const backward: Partial<Record<Direction, Direction>> = {
  w: 'e',
  e: 'w'
};

export class NodeSizeSnapProvider implements SnapProvider<'size'> {
  constructor(
    private readonly diagram: Diagram,
    private readonly excludedNodeIds: string[]
  ) {}

  private get(b: Box, dir: Direction) {
    if (dir === 'e' || dir === 'w') {
      return dir === 'e' ? b.pos.x + b.size.w : b.pos.x;
    } else {
      return dir === 'n' ? b.pos.y : b.pos.y + b.size.h;
    }
  }

  private getRange(b: Box, axis: Axis) {
    if (axis === 'h') {
      return Range.create(b.pos.x, b.pos.x + b.size.w);
    } else {
      return Range.create(b.pos.y, b.pos.y + b.size.h);
    }
  }

  getAnchors(box: Box): AnchorOfType<'size'>[] {
    // TODO: The 30 lines or so is duplicated in NodeDistanceSnapProvider
    const boxHRange = this.getRange(box, 'h');
    const boxVRange = this.getRange(box, 'v');

    const center = Box.center(box);

    const result: Record<Direction, ResolvedNodeDef[]> = {
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
        Range.overlaps(this.getRange(node.bounds, 'h'), boxHRange) ||
        Range.overlaps(this.getRange(node.bounds, 'v'), boxVRange)
      ) {
        if (this.get(node.bounds, 's') < box.pos.y) {
          result.n.push(node);
        } else if (this.get(node.bounds, 'e') < box.pos.x) {
          result.w.push(node);
        } else if (node.bounds.pos.x > this.get(box, 'e')) {
          result.e.push(node);
        } else if (node.bounds.pos.y > this.get(box, 's')) {
          result.s.push(node);
        } else {
          VERIFY_NOT_REACHED();
        }
      }
    }

    const anchors: AnchorOfType<'size'>[] = [];

    for (const k of Object.keys(result)) {
      const d = k as Direction;
      if (result[d].length === 0) continue;
      result[d].sort(
        (a, b) =>
          Point.squareDistance(center, Box.center(a.bounds)) -
          Point.squareDistance(center, Box.center(b.bounds))
      );

      const dir: keyof Extent = k === 'n' || k === 's' ? 'h' : 'w';
      const axis: Axis = k === 'n' || k === 's' ? 'h' : 'v';

      const nodeDim = result[d][0].bounds.size[dir];
      const selfDim = box.size[dir];

      const diff = nodeDim - selfDim;
      anchors.push({
        type: 'size',
        axis,
        matchDirection: forward[d] ?? d,
        respectDirection: true,
        node: result[d][0],
        size: nodeDim,
        line:
          dir === 'h'
            ? Line.from(
                { x: box.pos.x, y: box.pos.y + box.size.h + diff },
                { x: box.pos.x + box.size.w, y: box.pos.y + box.size.h + diff }
              )
            : Line.from(
                { x: box.pos.x + box.size.w + diff, y: box.pos.y },
                { x: box.pos.x + box.size.w + diff, y: box.pos.y + box.size.h }
              ),
        distancePairs: []
      });
      anchors.push({
        type: 'size',
        axis,
        matchDirection: backward[d] ?? d,
        respectDirection: true,
        node: result[d][0],
        size: nodeDim,
        line:
          dir === 'h'
            ? Line.from(
                { x: box.pos.x, y: box.pos.y - diff },
                { x: box.pos.x + box.size.w, y: box.pos.y - diff }
              )
            : Line.from(
                { x: box.pos.x - diff, y: box.pos.y },
                { x: box.pos.x - diff, y: box.pos.y + box.size.h }
              ),
        distancePairs: []
      });
    }

    return anchors;
  }

  // TODO: Do we need _axis in this interface
  makeGuide(box: Box, match: MatchingAnchorPair<'size'>, _axis: Axis): Guide {
    if (match.matching.axis === 'h') {
      match.matching.distancePairs.push({
        distance: match.matching.size,
        pointA: Line.midpoint(Box.line(box, 'n')),
        pointB: Line.midpoint(Box.line(box, 's'))
      });

      match.matching.distancePairs.push({
        distance: match.matching.size,
        pointA: Line.midpoint(Box.line(match.matching.node.bounds, 'n')),
        pointB: Line.midpoint(Box.line(match.matching.node.bounds, 's'))
      });
    } else {
      match.matching.distancePairs.push({
        distance: match.matching.size,
        pointA: Line.midpoint(Box.line(box, 'e')),
        pointB: Line.midpoint(Box.line(box, 'w'))
      });

      match.matching.distancePairs.push({
        distance: match.matching.size,
        pointA: Line.midpoint(Box.line(match.matching.node.bounds, 'e')),
        pointB: Line.midpoint(Box.line(match.matching.node.bounds, 'w'))
      });
    }

    return {
      line: match.matching.line,
      matchingAnchor: match.matching,
      selfAnchor: match.self
    };
  }

  moveAnchor(anchor: AnchorOfType<'size'>, delta: Point): void {
    anchor.line = Line.move(anchor.line, delta);
  }
}
