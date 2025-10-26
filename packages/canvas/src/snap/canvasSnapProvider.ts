import type { MatchingMagnetPair, SnapMarker, SnapProvider } from './snapManager';
import type { Diagram } from '@diagram-craft/model/diagram';
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
    const { w, h } = this.diagram.bounds;
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

  mark(_box: Box, match: MatchingMagnetPair<'canvas'>, _axis: Axis): SnapMarker {
    return {
      // Since the canvas magnets are the full height/width, we simply highlight
      // by returning this magnet line as a whole
      line: match.matching.line,
      matchingMagnet: match.matching,
      selfMagnet: match.self
    };
  }

  filterMarkers(marks: SnapMarker[]): SnapMarker[] {
    return marks;
  }
}
