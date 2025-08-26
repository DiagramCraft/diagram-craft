import type { MatchingMagnetPair, SnapProvider } from './snapManager';
import type { Highlight } from '../selectionState';
import type { Diagram } from '../diagram';
import { MagnetOfType } from './magnet';
import { Box } from '@diagram-craft/geometry/box';
import { Line } from '@diagram-craft/geometry/line';
import { Axis } from '@diagram-craft/geometry/axis';

export class GuidesSnapProvider implements SnapProvider<'guide'> {
  constructor(private readonly diagram: Diagram) {}

  getMagnets(box: Box): ReadonlyArray<MagnetOfType<'guide'>> {
    const magnets: MagnetOfType<'guide'>[] = [];
    const guides = this.diagram.guides;

    for (const guide of guides) {
      if (guide.type === 'horizontal') {
        magnets.push({
          line: Line.horizontal(guide.position, [box.x - 50, box.x + box.w + 50]),
          axis: Axis.h,
          type: 'guide'
        });
      } else if (guide.type === 'vertical') {
        magnets.push({
          line: Line.vertical(guide.position, [box.y - 50, box.y + box.h + 50]),
          axis: Axis.v,
          type: 'guide'
        });
      }
    }

    return magnets;
  }

  highlight(_box: Box, _match: MatchingMagnetPair<'guide'>, _axis: Axis): Highlight | undefined {
    return undefined;
  }

  filterHighlights(guides: Highlight[]): Highlight[] {
    return guides;
  }
}
