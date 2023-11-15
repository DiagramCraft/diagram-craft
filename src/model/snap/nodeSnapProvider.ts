import { AnchorOfType, Axis, LoadedDiagram, NodeHelper } from '../diagram.ts';
import { Line, OLine } from '../../geometry/line.ts';
import { Guide } from '../selectionState.ts';
import { MatchingAnchorPair, SnapProvider } from './snapManager.ts';
import { unique } from '../../utils/array.ts';
import { Range } from '../../geometry/range.ts';
import { Point } from '../../geometry/point.ts';
import { Box } from '../../geometry/box.ts';

const N = Infinity;
const minX = (...bs: Box[]) => bs.reduce((p, b) => Math.min(p, b.pos.x, b.pos.x + b.size.w), N);
const maxX = (...bs: Box[]) => bs.reduce((p, b) => Math.max(p, b.pos.x, b.pos.x + b.size.w), 0);
const minY = (...bs: Box[]) => bs.reduce((p, b) => Math.min(p, b.pos.y, b.pos.y + b.size.h), N);
const maxY = (...bs: Box[]) => bs.reduce((p, b) => Math.max(p, b.pos.y, b.pos.y + b.size.h), 0);

type AnchorWithDistance = [AnchorOfType<'node'>, number];

const compareFn = (a: AnchorWithDistance, b: AnchorWithDistance) => b[1] - a[1];

export class NodeSnapProvider implements SnapProvider<'node'> {
  constructor(
    private readonly diagram: LoadedDiagram,
    private readonly excludedNodeIds: string[]
  ) {}

  private getRange(b: Box, axis: Axis) {
    if (axis === 'h') {
      return Range.create(b.pos.x, b.pos.x + b.size.w);
    } else {
      return Range.create(b.pos.y, b.pos.y + b.size.h);
    }
  }

  getAnchors(box: Box): AnchorOfType<'node'>[] {
    const dest: { h: AnchorWithDistance[]; v: AnchorWithDistance[] } = { h: [], v: [] };
    const center = Box.center(box);

    const boxHRange = this.getRange(box, 'h');
    const boxVRange = this.getRange(box, 'v');

    for (const node of this.diagram.queryNodes()) {
      if (this.excludedNodeIds.includes(node.id)) continue;
      for (const other of NodeHelper.anchors(node.bounds)) {
        // TODO: We should be able to filter out even more here
        //       by considering the direction of the anchor line
        if (
          !Range.overlaps(this.getRange(node.bounds, 'h'), boxHRange) &&
          !Range.overlaps(this.getRange(node.bounds, 'v'), boxVRange)
        ) {
          continue;
        }

        other.type = 'node';
        (other as AnchorOfType<'node'>).node = node;

        if (Line.isHorizontal(other.line)) {
          other.line = Line.from(
            { x: 0, y: other.line.to.y },
            { x: this.diagram.dimensions.w, y: other.line.to.y }
          );
          dest.h.push([
            other as AnchorOfType<'node'>,
            Point.squareDistance(center, Box.center(node.bounds))
          ]);
        } else {
          other.line = Line.from(
            { x: other.line.to.x, y: 0 },
            { x: other.line.to.x, y: this.diagram.dimensions.h }
          );
          dest.v.push([
            other as AnchorOfType<'node'>,
            Point.squareDistance(center, Box.center(node.bounds))
          ]);
        }
      }
    }

    if (dest.h.length > 1) dest.h = unique(dest.h.sort(compareFn), e => e[0].line.from.y);
    if (dest.v.length > 1) dest.v = unique(dest.v.sort(compareFn), e => e[0].line.from.x);

    return [...dest.h.map(e => e[0]), ...dest.v.map(e => e[0])];
  }

  makeGuide(box: Box, match: MatchingAnchorPair<'node'>, _axis: Axis): Guide {
    const mBox = match.matching.node.bounds;
    return {
      line: Line.isHorizontal(match.matching.line)
        ? OLine.fromRange({ y: match.matching.line.from.y }, [minX(mBox, box), maxX(mBox, box)])
        : OLine.fromRange({ x: match.matching.line.from.x }, [minY(mBox, box), maxY(mBox, box)]),
      matchingAnchor: match.matching,
      selfAnchor: match.self
    };
  }

  moveAnchor(anchor: AnchorOfType<'node'>, delta: Point): void {
    anchor.line = Line.move(anchor.line, delta);
  }
}
