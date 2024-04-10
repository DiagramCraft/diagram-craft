import { MatchingMagnetPair, SnapProvider } from './snapManager';
import { Guide } from '../selectionState';
import { Diagram } from '../diagram';
import { DistancePairWithRange, MagnetOfType } from './magnet';
import { AbstractNodeSnapProvider } from './abstractNodeSnapProvider';
import { Axis, Box, Direction, Line, Point, Range } from '@diagram-craft/geometry';

const directions: Record<
  Direction,
  {
    dir: Direction;
    oDir: Direction;
    sign: 1 | -1;
    axis: Axis;
    oAxis: Axis;
  }
> = {
  n: { dir: 'n', oDir: 's', axis: 'h', oAxis: 'v', sign: -1 },
  s: { dir: 's', oDir: 'n', axis: 'h', oAxis: 'v', sign: 1 },
  w: { dir: 'w', oDir: 'e', axis: 'v', oAxis: 'h', sign: -1 },
  e: { dir: 'e', oDir: 'w', axis: 'v', oAxis: 'h', sign: 1 }
};

export class NodeDistanceSnapProvider
  extends AbstractNodeSnapProvider
  implements SnapProvider<'distance'>
{
  constructor(diagram: Diagram, excludedNodeIds: ReadonlyArray<string>) {
    super(diagram, excludedNodeIds);
  }

  getMagnets(box: Box): MagnetOfType<'distance'>[] {
    const result = this.getViableNodes(box);

    const magnetPositions = {
      h: new Set<number>(),
      v: new Set<number>()
    };

    const baseDistanceMagnet = {
      offset: { x: 0, y: 0 },
      type: 'distance' as const
    };

    const magnets: MagnetOfType<'distance'>[] = [];

    for (const { dir, axis, sign, oDir, oAxis } of Object.values(directions)) {
      // Sort all by being closest
      // ... for north and south we want to sort with largest first
      // ... for east and south we want to sort with smallest first
      result[dir].sort((a, b) => {
        const ab = a.bounds;
        const bb = b.bounds;
        return sign * (this.get(ab, oDir) - this.get(bb, oDir));
      });

      for (let i = 0; i < result[dir].length - 1; i++) {
        const first = result[dir][i].bounds;

        const distances: DistancePairWithRange[] = [];
        for (let j = i + 1; j < result[dir].length; j++) {
          const d = sign * (this.get(result[dir][j].bounds, oDir) - this.get(first, dir));

          if (d <= 0) continue;

          const rangeA = this.getRange(first, axis);
          const rangeB = this.getRange(result[dir][j].bounds, axis);

          const intersection = Range.intersection(rangeA, rangeB);

          // This means there no intersection between the two nodes
          if (!intersection) continue;

          const mp = Range.midpoint(intersection);

          distances.push({
            distance: d,
            pointA: {
              x: axis === 'h' ? mp : this.get(first, dir),
              y: axis === 'v' ? mp : this.get(first, dir)
            },
            pointB: {
              x: axis === 'h' ? mp : this.get(result[dir][j].bounds, oDir),
              y: axis === 'v' ? mp : this.get(result[dir][j].bounds, oDir)
            },
            rangeA: rangeA,
            rangeB: rangeB
          });
        }

        for (const dp of distances) {
          const pos = this.get(first, oDir) - sign * dp.distance;
          if (magnetPositions[oAxis].has(pos)) continue;

          const intersection = Range.intersection(
            this.getRange(first, axis),
            this.getRange(box, axis)
          )!;

          magnets.push({
            ...baseDistanceMagnet,
            line:
              axis === 'v' ? Line.vertical(pos, intersection) : Line.horizontal(pos, intersection),
            axis,
            matchDirection: dir,
            respectDirection: true,
            distancePairs: [dp]
          });

          magnetPositions[oAxis].add(pos);
        }
      }
    }

    return magnets;
  }

  makeGuide(box: Box, match: MatchingMagnetPair<'distance'>, axis: Axis): Guide | undefined {
    const m = match.matching;

    const tp = Line.midpoint(match.self.line);

    const instersection = Range.intersection(
      Range.intersection(m.distancePairs[0].rangeA, m.distancePairs[0].rangeB)!,
      this.getRange(box, axis)
    );

    if (!instersection) return undefined;

    const mp = Range.midpoint(instersection!);

    // Add new distance pair from match to first node
    m.distancePairs.push({
      distance: m.distancePairs[0].distance,
      pointA: Point.add(tp, {
        x: axis === 'v' ? directions[m.matchDirection!].sign * m.distancePairs[0].distance : 0,
        y: axis === 'h' ? directions[m.matchDirection!].sign * m.distancePairs[0].distance : 0
      }),
      pointB: tp,
      rangeA: instersection!,
      rangeB: instersection!
    });

    for (const dp of m.distancePairs) {
      dp.pointA = {
        x: axis === 'h' ? mp : dp.pointA.x,
        y: axis === 'v' ? mp : dp.pointA.y
      };
      dp.pointB = {
        x: axis === 'h' ? mp : dp.pointB.x,
        y: axis === 'v' ? mp : dp.pointB.y
      };
    }

    return {
      line: match.self.line,
      matchingMagnet: match.matching,
      selfMagnet: match.self
    };
  }

  moveMagnet(magnet: MagnetOfType<'distance'>, delta: Point): void {
    magnet.line = Line.move(magnet.line, delta);
    magnet.distancePairs.forEach(dp => {
      dp.pointA = Point.add(dp.pointA, delta);
      dp.pointB = Point.add(dp.pointB, delta);
      dp.rangeA = Range.add(dp.rangeA, delta[Axis.toXY(magnet.axis)]);
      dp.rangeB = Range.add(dp.rangeB, delta[Axis.toXY(magnet.axis)]);
    });
  }
}
