import type { MatchingMagnetPair, SnapProvider } from './snapManager';
import type { Highlight } from '@diagram-craft/model/selection';
import type { Diagram } from '@diagram-craft/model/diagram';
import { MagnetOfType } from './magnet';
import { Box } from '@diagram-craft/geometry/box';
import { Line } from '@diagram-craft/geometry/line';
import { Axis } from '@diagram-craft/geometry/axis';
import { Point } from '@diagram-craft/geometry/point';
import { Range } from '@diagram-craft/geometry/range';

const DEFAULT_GRID_SIZE = 10;

/**
 * Snap provider that creates grid line magnets for alignment
 *
 * This provider generates magnetic lines at regular grid intervals that elements
 * can snap to for precise alignment. It creates both vertical and horizontal
 * grid lines in the area around the element being snapped.
 *
 * The grid lines are generated based on the diagram's grid size setting.
 */
export class GridSnapProvider implements SnapProvider<'grid'> {
  private readonly gridSize: number;

  constructor(diagram: Diagram) {
    this.gridSize = diagram.props.grid?.size ?? DEFAULT_GRID_SIZE;
  }

  /**
   * Snap a point to the nearest grid intersection
   * @param point - The point to snap
   * @param grid - The grid size (spacing between grid lines)
   * @returns Point snapped to the nearest grid intersection
   */
  static snapPoint(point: Point, grid: number): Point {
    return Point.of(Math.round(point.x / grid) * grid, Math.round(point.y / grid) * grid);
  }

  getMagnets(box: Box) {
    const magnets: MagnetOfType<'grid'>[] = [];

    const minX = Math.floor(box.x / this.gridSize);
    const maxX = Math.ceil((box.x + box.w) / this.gridSize);
    const minY = Math.floor(box.y / this.gridSize);
    const maxY = Math.ceil((box.y + box.h) / this.gridSize);

    for (let x = minX; x <= maxX; x++) {
      magnets.push({
        line: Line.vertical(
          x * this.gridSize,
          Range.of(minY * this.gridSize, maxY * this.gridSize)
        ),
        axis: Axis.v,
        type: 'grid'
      });
    }

    for (let y = minY; y <= maxY; y++) {
      magnets.push({
        line: Line.horizontal(
          y * this.gridSize,
          Range.of(minX * this.gridSize, maxX * this.gridSize)
        ),
        axis: Axis.h,
        type: 'grid'
      });
    }

    return magnets;
  }

  /**
   * Create a highlight for a grid snap
   * Shows a grid line extending across the width/height of the snapped element
   */
  highlight(box: Box, match: MatchingMagnetPair<'grid'>, _axis: Axis): Highlight {
    return {
      line: Line.isHorizontal(match.matching.line)
        ? Line.horizontal(match.matching.line.from.y, Range.of(box.x, box.x + box.w))
        : Line.vertical(match.matching.line.from.x, Range.of(box.y, box.y + box.h)),
      matchingMagnet: match.matching,
      selfMagnet: match.self
    };
  }

  /**
   * Filter/consolidate grid highlights
   * If center lines are snapping, hide edge line highlights on the same axis
   * This prevents visual clutter when both center and edge snap to the same grid
   */
  filterHighlights(guides: Highlight[]) {
    let result = [...guides] as Array<Highlight & { selfMagnet: MagnetOfType<'source'> }>;

    if (result.find(c => c.selfMagnet.subtype === 'center' && c.selfMagnet.axis === 'h')) {
      result = result.filter(
        c => !(c.selfMagnet.subtype !== 'center' && c.selfMagnet.axis === 'h')
      );
    }

    if (result.find(c => c.selfMagnet.subtype === 'center' && c.selfMagnet.axis === 'v')) {
      result = result.filter(
        c => !(c.selfMagnet.subtype !== 'center' && c.selfMagnet.axis === 'v')
      );
    }

    return result;
  }
}
