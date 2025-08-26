import type { MatchingMagnetPair, SnapProvider } from './snapManager';
import type { Guide } from '../selectionState';
import type { Diagram } from '../diagram';
import { MagnetOfType } from './magnet';
import { Box } from '@diagram-craft/geometry/box';
import { Line } from '@diagram-craft/geometry/line';
import { Axis } from '@diagram-craft/geometry/axis';
import { Point } from '@diagram-craft/geometry/point';

export class GuidesSnapProvider implements SnapProvider<'guides'> {
  constructor(private readonly diagram: Diagram) {}

  getMagnets(box: Box): ReadonlyArray<MagnetOfType<'guides'>> {
    const magnets: MagnetOfType<'guides'>[] = [];
    const guides = this.diagram.guides;

    for (const guide of guides) {
      if (guide.type === 'horizontal') {
        // Create a horizontal magnet line that spans the box area
        magnets.push({
          line: Line.horizontal(guide.position, [box.x - 50, box.x + box.w + 50]),
          axis: Axis.h,
          type: 'guides'
        });
      } else if (guide.type === 'vertical') {
        // Create a vertical magnet line that spans the box area
        magnets.push({
          line: Line.vertical(guide.position, [box.y - 50, box.y + box.h + 50]),
          axis: Axis.v,
          type: 'guides'
        });
      }
    }

    return magnets;
  }

  makeGuide(_box: Box, _match: MatchingMagnetPair<'guides'>, _axis: Axis): Guide | undefined {
    return undefined;
  }

  moveMagnet(magnet: MagnetOfType<'guides'>, delta: Point): void {
    magnet.line = Line.move(magnet.line, delta);
  }

  consolidate(guides: Guide[]): Guide[] {
    // For guides, we don't need much consolidation as they are user-placed
    // Just return them as-is
    return guides;
  }
}
