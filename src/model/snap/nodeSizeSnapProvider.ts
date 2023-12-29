import { Direction } from '../../geometry/direction.ts';
import { MatchingMagnetPair, SnapProvider } from './snapManager.ts';
import { Point } from '../../geometry/point.ts';
import { Box } from '../../geometry/box.ts';
import { Line } from '../../geometry/line.ts';
import { Extent } from '../../geometry/extent.ts';
import { Guide } from '../selectionState.ts';
import { MagnetOfType } from './magnet.ts';
import { Axis } from '../../geometry/axis.ts';
import { Diagram } from '../diagram.ts';
import { AbstractNodeSnapProvider } from './abstractNodeSnapProvider.ts';

const forward: Partial<Record<Direction, Direction>> = {
  n: 's',
  s: 'n'
};

const backward: Partial<Record<Direction, Direction>> = {
  w: 'e',
  e: 'w'
};

export class NodeSizeSnapProvider extends AbstractNodeSnapProvider implements SnapProvider<'size'> {
  constructor(diagram: Diagram, excludedNodeIds: ReadonlyArray<string>) {
    super(diagram, excludedNodeIds);
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

      const nodeDim = result[d][0].bounds.size[dir];
      const selfDim = box.size[dir];

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
                { x: box.pos.x, y: box.pos.y + box.size.h + diff },
                { x: box.pos.x + box.size.w, y: box.pos.y + box.size.h + diff }
              )
            : Line.of(
                { x: box.pos.x + box.size.w + diff, y: box.pos.y },
                { x: box.pos.x + box.size.w + diff, y: box.pos.y + box.size.h }
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
            ? Line.of(
                { x: box.pos.x, y: box.pos.y - diff },
                { x: box.pos.x + box.size.w, y: box.pos.y - diff }
              )
            : Line.of(
                { x: box.pos.x - diff, y: box.pos.y },
                { x: box.pos.x - diff, y: box.pos.y + box.size.h }
              ),
        distancePairs: []
      });
    }

    return magnets;
  }

  makeGuide(box: Box, match: MatchingMagnetPair<'size'>, _axis: Axis): Guide {
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

  moveMagnet(magnet: MagnetOfType<'size'>, delta: Point): void {
    magnet.line = Line.move(magnet.line, delta);
  }
}
