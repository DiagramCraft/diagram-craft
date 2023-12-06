import { MatchingMagnetPair, SnapProvider } from './snapManager.ts';
import { Point } from '../../geometry/point.ts';
import { Line } from '../../geometry/line.ts';
import { Box } from '../../geometry/box.ts';
import { Guide } from '../selectionState.ts';
import { Diagram } from '../../model-viewer/diagram.ts';
import { MagnetOfType } from './magnet.ts';
import { Axis } from '../../geometry/axis.ts';

export class GridSnapProvider implements SnapProvider<'grid'> {
  constructor(private readonly diagram: Diagram) {}

  getMagnets(box: Box): MagnetOfType<'grid'>[] {
    const magnets: MagnetOfType<'grid'>[] = [];
    const grid = this.diagram.grid;

    const minX = Math.floor(box.pos.x / grid.x);
    const maxX = Math.ceil((box.pos.x + box.size.w) / grid.x);
    const minY = Math.floor(box.pos.y / grid.y);
    const maxY = Math.ceil((box.pos.y + box.size.h) / grid.y);

    for (let x = minX; x <= maxX; x++) {
      magnets.push({
        line: Line.of({ x: x * grid.x, y: minY * grid.y }, { x: x * grid.x, y: maxY * grid.y }),
        axis: 'v',
        type: 'grid'
      });
    }

    for (let y = minY; y <= maxY; y++) {
      magnets.push({
        line: Line.of({ x: minX * grid.x, y: y * grid.y }, { x: maxX * grid.x, y: y * grid.y }),
        axis: 'h',
        type: 'grid'
      });
    }

    return magnets;
  }

  makeGuide(box: Box, match: MatchingMagnetPair<'grid'>, _axis: Axis): Guide {
    return {
      line: Line.isHorizontal(match.matching.line)
        ? Line.of(
            { x: box.pos.x, y: match.matching.line.from.y },
            { x: box.pos.x + box.size.w, y: match.matching.line.from.y }
          )
        : Line.of(
            { x: match.matching.line.from.x, y: box.pos.y },
            { x: match.matching.line.from.x, y: box.pos.y + box.size.h }
          ),
      matchingMagnet: match.matching,
      selfMagnet: match.self
    };
  }

  Magnet(magnet: MagnetOfType<'grid'>, delta: Point): void {
    magnet.line = Line.move(magnet.line, delta);
  }
}
