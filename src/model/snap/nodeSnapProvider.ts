import { Anchor, AnchorOfType, Axis, LoadedDiagram, NodeHelper } from '../diagram.ts';
import { Box, Line, Point } from '../../geometry/geometry.ts';
import { Guide } from '../selectionState.ts';
import { MatchingAnchorPair, SnapProvider } from './snapManager.ts';

export class NodeSnapProvider implements SnapProvider<'node'> {
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

  makeGuide(_box: Box, match: MatchingAnchorPair<'node'>, axis: Axis): Guide {
    return {
      line: Line.extend(
        Line.from(match.matching.pos, match.self.pos),
        match.matching.offset[Axis.toXY(axis)],
        match.self.offset[Axis.toXY(axis)]
      ),
      type: match.matching.type,
      matchingAnchor: match.matching,
      selfAnchor: match.self
    };
  }

  moveAnchor(anchor: AnchorOfType<'node'>, delta: Point): void {
    anchor.pos = Point.add(anchor.pos, delta);
  }
}
