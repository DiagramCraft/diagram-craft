import { Anchor, AnchorOfType, Axis, LoadedDiagram, NodeHelper } from '../diagram.ts';
import { Box, Line, OLine, Point } from '../../geometry/geometry.ts';
import { Guide } from '../selectionState.ts';
import { MatchingAnchorPair, SnapProvider } from './snapManager.ts';

const N = Infinity;
const minX = (...bs: Box[]) => bs.reduce((p, b) => Math.min(p, b.pos.x, b.pos.x + b.size.w), N);
const maxX = (...bs: Box[]) => bs.reduce((p, b) => Math.max(p, b.pos.x, b.pos.x + b.size.w), 0);
const minY = (...bs: Box[]) => bs.reduce((p, b) => Math.min(p, b.pos.y, b.pos.y + b.size.h), N);
const maxY = (...bs: Box[]) => bs.reduce((p, b) => Math.max(p, b.pos.y, b.pos.y + b.size.h), 0);

export class NodeSnapProvider implements SnapProvider<'node'> {
  constructor(
    private readonly diagram: LoadedDiagram,
    private readonly excludedNodeIds: string[]
  ) {}

  // TODO: This can probably be optimized to first check the bounds of the node
  //       before add all the anchors of that node
  // TODO: We should only generate one per position (furthest away)
  getAnchors(_box: Box): Anchor[] {
    const positions: { h: Record<number, Anchor>; v: Record<number, Anchor> } = { h: {}, v: {} };

    for (const node of this.diagram.queryNodes()) {
      if (this.excludedNodeIds.includes(node.id)) continue;
      for (const other of NodeHelper.anchors(node.bounds)) {
        other.type = 'node';
        (other as AnchorOfType<'node'>).node = node;

        if (Line.isHorizontal(other.line)) {
          other.line = OLine.fromRange({ y: other.line.to.y }, [0, this.diagram.dimensions.w]);
          positions.h[other.line.from.y] = other;
        } else {
          other.line = OLine.fromRange({ x: other.line.to.x }, [0, this.diagram.dimensions.h]);
          positions.v[other.line.from.x] = other;
        }
      }
    }
    return [...Object.values(positions.h), ...Object.values(positions.v)];
  }

  makeGuide(box: Box, match: MatchingAnchorPair<'node'>, _axis: Axis): Guide {
    const mBox = match.matching.node.bounds;
    return {
      line: Line.isHorizontal(match.matching.line)
        ? OLine.fromRange({ y: match.matching.line.from.y }, [minX(mBox, box), maxX(mBox, box)])
        : OLine.fromRange({ x: match.matching.line.from.x }, [minY(mBox, box), maxY(mBox, box)]),
      type: match.matching.type,
      matchingAnchor: match.matching,
      selfAnchor: match.self
    };
  }

  moveAnchor(anchor: AnchorOfType<'node'>, delta: Point): void {
    anchor.line = Line.move(anchor.line, delta);
  }
}
