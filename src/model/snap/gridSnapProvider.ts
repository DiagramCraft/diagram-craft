import { Box, Line, Point } from '../../geometry/geometry.ts';
import { AnchorOfType, Axis } from '../diagram.ts';
import { Guide } from '../selectionState.ts';
import { MatchingAnchorPair, SnapProvider } from './snapManager.ts';

export class GridSnapProvider implements SnapProvider<'grid'> {
  private grid: { x: number; y: number };

  constructor() {
    this.grid = {
      x: 20,
      y: 40
    };
  }

  getAnchors(box: Box): AnchorOfType<'grid'>[] {
    const anchors: AnchorOfType<'grid'>[] = [];

    const minX = Math.floor(box.pos.x / this.grid.x);
    const maxX = Math.ceil((box.pos.x + box.size.w) / this.grid.x);
    const minY = Math.floor(box.pos.y / this.grid.y);
    const maxY = Math.ceil((box.pos.y + box.size.h) / this.grid.y);

    for (let x = minX; x <= maxX; x++) {
      anchors.push({
        line: Line.from(
          { x: x * this.grid.x, y: minY * this.grid.y },
          { x: x * this.grid.x, y: maxY * this.grid.y }
        ),
        axis: 'v',
        type: 'grid'
      });
    }

    for (let y = minY; y <= maxY; y++) {
      anchors.push({
        line: Line.from(
          { x: minX * this.grid.x, y: y * this.grid.y },
          { x: maxX * this.grid.x, y: y * this.grid.y }
        ),
        axis: 'h',
        type: 'grid'
      });
    }

    return anchors;
  }

  makeGuide(box: Box, match: MatchingAnchorPair<'grid'>, _axis: Axis): Guide {
    return {
      line: Line.isHorizontal(match.matching.line)
        ? Line.from(
            { x: box.pos.x, y: match.matching.line.from.y },
            { x: box.pos.x + box.size.w, y: match.matching.line.from.y }
          )
        : Line.from(
            { x: match.matching.line.from.x, y: box.pos.y },
            { x: match.matching.line.from.x, y: box.pos.y + box.size.h }
          ),
      matchingAnchor: match.matching,
      selfAnchor: match.self
    };
  }

  moveAnchor(anchor: AnchorOfType<'grid'>, delta: Point): void {
    anchor.line = Line.move(anchor.line, delta);
  }
}
