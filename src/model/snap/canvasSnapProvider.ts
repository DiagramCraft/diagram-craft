import { Box, Line, Point } from '../../geometry/geometry.ts';
import { Anchor, AnchorOfType, Axis } from '../diagram.ts';
import { Guide } from '../selectionState.ts';
import { MatchingAnchorPair, SnapProvider } from './snapManager.ts';

export class CanvasSnapProvider implements SnapProvider<'canvas'> {
  getAnchors(_box: Box): Anchor[] {
    return [
      {
        offset: { x: 0, y: 0 },
        pos: { x: 320, y: 0 },
        axis: 'v',
        type: 'canvas'
      },
      {
        offset: { x: 0, y: 0 },
        pos: { x: 320, y: 480 },
        axis: 'v',
        type: 'canvas'
      },
      {
        offset: { x: 0, y: 0 },
        pos: { x: 0, y: 240 },
        axis: 'h',
        type: 'canvas'
      },
      {
        offset: { x: 0, y: 0 },
        pos: { x: 640, y: 240 },
        axis: 'h',
        type: 'canvas'
      }
    ];
  }

  makeGuide(_box: Box, match: MatchingAnchorPair<'canvas'>, axis: Axis): Guide {
    return {
      line: Line.extend(
        Line.from(match.matching.pos, match.self.pos),
        match.self.offset[Axis.toXY(axis)],
        match.self.offset[Axis.toXY(axis)]
      ),
      type: match.matching.type,
      matchingAnchor: match.matching,
      selfAnchor: match.self
    };
  }

  moveAnchor(anchor: AnchorOfType<'canvas'>, delta: Point): void {
    anchor.pos = Point.add(anchor.pos, delta);
  }
}
