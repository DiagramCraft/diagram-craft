import { Box, Line, Point } from '../../geometry/geometry.ts';
import { AnchorOfType, Axis, LoadedDiagram } from '../diagram.ts';
import { Guide } from '../selectionState.ts';
import { MatchingAnchorPair, SnapProvider } from './snapManager.ts';

export class CanvasSnapProvider implements SnapProvider<'canvas'> {
  constructor(private readonly diagram: LoadedDiagram) {}

  getAnchors(_box: Box): AnchorOfType<'canvas'>[] {
    const { w, h } = this.diagram.dimensions;
    return [
      {
        line: Line.from({ x: w / 2, y: 0 }, { x: w / 2, y: h }),
        axis: 'v',
        type: 'canvas'
      },
      {
        line: Line.from({ x: 0, y: h / 2 }, { x: w, y: h / 2 }),
        axis: 'h',
        type: 'canvas'
      }
    ];
  }

  makeGuide(_box: Box, match: MatchingAnchorPair<'canvas'>, _axis: Axis): Guide {
    return {
      line: match.matching.line,
      matchingAnchor: match.matching,
      selfAnchor: match.self
    };
  }

  moveAnchor(anchor: AnchorOfType<'canvas'>, delta: Point): void {
    anchor.line = Line.move(anchor.line, delta);
  }
}
