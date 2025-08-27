import type { MatchingMagnetPair, SnapProvider } from './snapManager';
import type { Highlight } from '../selectionState';
import type { Diagram } from '../diagram';
import type { MagnetOfType } from './magnet';
import { Box } from '@diagram-craft/geometry/box';
import { Line } from '@diagram-craft/geometry/line';
import { Axis } from '@diagram-craft/geometry/axis';

/**
 * Snap provider that provides canvas center line magnets for alignment
 *
 * This provider creates two magnets representing the vertical and horizontal center lines
 * of the entire canvas/diagram area.
 */
export class CanvasSnapProvider implements SnapProvider<'canvas'> {
  constructor(private readonly diagram: Diagram) {}

  getMagnets(_box: Box): ReadonlyArray<MagnetOfType<'canvas'>> {
    const { w, h } = this.diagram.canvas;
    return [
      {
        line: Line.vertical(w / 2, [0, h]),
        axis: Axis.v,
        type: 'canvas'
      },
      {
        line: Line.horizontal(h / 2, [0, w]),
        axis: Axis.h,
        type: 'canvas'
      }
    ];
  }

  highlight(_box: Box, match: MatchingMagnetPair<'canvas'>, _axis: Axis): Highlight {
    return {
      // Since the canvas magnets are the full height/width, we simply highlight
      // by returning this magnet line as a whole
      line: match.matching.line,
      matchingMagnet: match.matching,
      selfMagnet: match.self
    };
  }

  filterHighlights(highlights: Highlight[]): Highlight[] {
    return highlights;
  }
}
