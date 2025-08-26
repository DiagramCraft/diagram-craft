import type { EligibleNodePredicate, MatchingMagnetPair, SnapProvider } from './snapManager';
import { Highlight } from '../selectionState';
import { MagnetOfType } from './magnet';
import type { Diagram } from '../diagram';
import { AbstractNodeSnapProvider } from './abstractNodeSnapProvider';
import { Direction } from '@diagram-craft/geometry/direction';
import { Box } from '@diagram-craft/geometry/box';
import { Point } from '@diagram-craft/geometry/point';
import { Extent } from '@diagram-craft/geometry/extent';
import { Axis } from '@diagram-craft/geometry/axis';
import { Line } from '@diagram-craft/geometry/line';

const forward: Partial<Record<Direction, Direction>> = {
  n: 's',
  s: 'n'
};

const backward: Partial<Record<Direction, Direction>> = {
  w: 'e',
  e: 'w'
};

export class NodeSizeSnapProvider extends AbstractNodeSnapProvider implements SnapProvider<'size'> {
  constructor(diagram: Diagram, eligibleNodePredicate: EligibleNodePredicate) {
    super(diagram, eligibleNodePredicate);
  }

  getMagnets(box: Box): MagnetOfType<'size'>[] {
    const center = Box.center(box);

    const result = this.getViableNodes(box);

    const magnets: MagnetOfType<'size'>[] = [];

    for (const k of Object.keys(result)) {
      const d = k as Direction;
      if (result[d].length === 0) continue;
      result[d].sort(
        (a, b) =>
          Point.squareDistance(center, Box.center(a.bounds)) -
          Point.squareDistance(center, Box.center(b.bounds))
      );

      const dir: keyof Extent = k === 'n' || k === 's' ? 'h' : 'w';
      const axis: Axis = k === 'n' || k === 's' ? 'h' : 'v';

      const nodeDim = result[d][0].bounds[dir];
      const selfDim = box[dir];

      const diff = nodeDim - selfDim;
      magnets.push({
        type: 'size',
        axis,
        matchDirection: forward[d] ?? d,
        respectDirection: true,
        node: result[d][0],
        size: nodeDim,
        line:
          dir === 'h'
            ? Line.of(
                { x: box.x, y: box.y + box.h + diff },
                { x: box.x + box.w, y: box.y + box.h + diff }
              )
            : Line.of(
                { x: box.x + box.w + diff, y: box.y },
                { x: box.x + box.w + diff, y: box.y + box.h }
              ),
        distancePairs: []
      });
      magnets.push({
        type: 'size',
        axis,
        matchDirection: backward[d] ?? d,
        respectDirection: true,
        node: result[d][0],
        size: nodeDim,
        line:
          dir === 'h'
            ? Line.of({ x: box.x, y: box.y - diff }, { x: box.x + box.w, y: box.y - diff })
            : Line.of({ x: box.x - diff, y: box.y }, { x: box.x - diff, y: box.y + box.h }),
        distancePairs: []
      });
    }

    return magnets;
  }

  highlight(box: Box, match: MatchingMagnetPair<'size'>, _axis: Axis): Highlight {
    if (match.matching.axis === 'h') {
      match.matching.distancePairs.push({
        distance: match.matching.size,
        pointA: Line.midpoint(Box.line(box, 'n')),
        pointB: Line.midpoint(Box.line(box, 's'))
      });

      match.matching.distancePairs.push({
        distance: match.matching.size,
        pointA: Line.midpoint(Box.line(match.matching.node.bounds, 'n')),
        pointB: Line.midpoint(Box.line(match.matching.node.bounds, 's'))
      });
    } else {
      match.matching.distancePairs.push({
        distance: match.matching.size,
        pointA: Line.midpoint(Box.line(box, 'e')),
        pointB: Line.midpoint(Box.line(box, 'w'))
      });

      match.matching.distancePairs.push({
        distance: match.matching.size,
        pointA: Line.midpoint(Box.line(match.matching.node.bounds, 'e')),
        pointB: Line.midpoint(Box.line(match.matching.node.bounds, 'w'))
      });
    }

    return {
      line: match.matching.line,
      matchingMagnet: match.matching,
      selfMagnet: match.self
    };
  }

  filterHighlights(highlights: Highlight[]): Highlight[] {
    return highlights;
  }
}
