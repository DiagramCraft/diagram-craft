import { Anchor, AnchorOfType, Axis, LoadedDiagram, NodeHelper } from '../diagram.ts';
import { Box, Line, OLine, Point } from '../../geometry/geometry.ts';
import { Guide } from '../selectionState.ts';
import { MatchingAnchorPair, SnapProvider } from './snapManager.ts';
import { unique } from '../../utils/array.ts';

const N = Infinity;
const minX = (...bs: Box[]) => bs.reduce((p, b) => Math.min(p, b.pos.x, b.pos.x + b.size.w), N);
const maxX = (...bs: Box[]) => bs.reduce((p, b) => Math.max(p, b.pos.x, b.pos.x + b.size.w), 0);
const minY = (...bs: Box[]) => bs.reduce((p, b) => Math.min(p, b.pos.y, b.pos.y + b.size.h), N);
const maxY = (...bs: Box[]) => bs.reduce((p, b) => Math.max(p, b.pos.y, b.pos.y + b.size.h), 0);

type AnchorWithDistance = [Anchor, number];

const compareFn = (a: AnchorWithDistance, b: AnchorWithDistance) => b[1] - a[1];

export class NodeSnapProvider implements SnapProvider<'node'> {
  constructor(
    private readonly diagram: LoadedDiagram,
    private readonly excludedNodeIds: string[]
  ) {}

  // TODO: This can probably be optimized to first check the bounds of the node
  //       before add all the anchors of that node
  getAnchors(box: Box): Anchor[] {
    const dest: { h: AnchorWithDistance[]; v: AnchorWithDistance[] } = { h: [], v: [] };
    const center = Box.center(box);

    for (const node of this.diagram.queryNodes()) {
      if (this.excludedNodeIds.includes(node.id)) continue;
      for (const other of NodeHelper.anchors(node.bounds)) {
        other.type = 'node';
        (other as AnchorOfType<'node'>).node = node;

        if (Line.isHorizontal(other.line)) {
          other.line = OLine.fromRange({ y: other.line.to.y }, [0, this.diagram.dimensions.w]);
          dest.h.push([other, Point.squareDistance(center, Box.center(node.bounds))]);
        } else {
          other.line = OLine.fromRange({ x: other.line.to.x }, [0, this.diagram.dimensions.h]);
          dest.v.push([other, Point.squareDistance(center, Box.center(node.bounds))]);
        }
      }
    }

    dest.h = unique(dest.h.sort(compareFn), e => e[0].line.from.y);
    dest.v = unique(dest.v.sort(compareFn), e => e[0].line.from.x);

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
