import { Direction } from '../../geometry/direction.ts';
import { Range } from '../../geometry/range.ts';
import { VERIFY_NOT_REACHED } from '../../utils/assert.ts';
import { MatchingAnchorPair, SnapProvider } from './snapManager.ts';
import { Point } from '../../geometry/point.ts';
import { Box } from '../../geometry/box.ts';
import { Line, OLine } from '../../geometry/line.ts';
import { Guide } from '../selectionState.ts';
import { Diagram, ResolvedNodeDef } from '../../model-viewer/diagram.ts';
import { AnchorOfType, Axis, DistancePairWithRange } from './anchor.ts';

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

export class NodeDistanceSnapProvider implements SnapProvider<'distance'> {
  constructor(
    private readonly diagram: Diagram,
    private readonly excludedNodeIds: string[]
  ) {}

  private get(b: Box, dir: Direction) {
    if (dir === 'e' || dir === 'w') {
      return dir === 'e' ? b.pos.x + b.size.w : b.pos.x;
    } else {
      return dir === 'n' ? b.pos.y : b.pos.y + b.size.h;
    }
  }

  private getRange(b: Box, axis: Axis) {
    if (axis === 'h') {
      return Range.create(b.pos.x, b.pos.x + b.size.w);
    } else {
      return Range.create(b.pos.y, b.pos.y + b.size.h);
    }
  }

  getAnchors(box: Box): AnchorOfType<'distance'>[] {
    const boxHRange = this.getRange(box, 'h');
    const boxVRange = this.getRange(box, 'v');

    const result: Record<Direction, ResolvedNodeDef[]> = {
      n: [],
      w: [],
      e: [],
      s: []
    };

    // TODO: This part is done very similarly in other providers - maybe introduce some
    //       sort of context object to do this only once
    for (const node of this.diagram.queryNodes()) {
      if (this.excludedNodeIds.includes(node.id)) continue;
      if (Box.intersects(node.bounds, box)) continue;
      if (node.bounds.rotation !== 0) continue;

      if (
        Range.overlaps(this.getRange(node.bounds, 'h'), boxHRange) ||
        Range.overlaps(this.getRange(node.bounds, 'v'), boxVRange)
      ) {
        if (this.get(node.bounds, 's') < box.pos.y) {
          result.n.push(node);
        } else if (this.get(node.bounds, 'e') < box.pos.x) {
          result.w.push(node);
        } else if (node.bounds.pos.x > this.get(box, 'e')) {
          result.e.push(node);
        } else if (node.bounds.pos.y > this.get(box, 's')) {
          result.s.push(node);
        } else {
          VERIFY_NOT_REACHED();
        }
      }
    }

    const anchorPositions = {
      h: new Set<number>(),
      v: new Set<number>()
    };

    const baseDistanceAnchor = {
      offset: { x: 0, y: 0 },
      type: 'distance' as const
    };

    const anchors: AnchorOfType<'distance'>[] = [];

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
          if (anchorPositions[oAxis].has(pos)) continue;

          const intersection = Range.intersection(
            this.getRange(first, axis),
            this.getRange(box, axis)
          )!;

          anchors.push({
            ...baseDistanceAnchor,
            line:
              axis === 'v'
                ? OLine.fromRange({ x: pos }, intersection)
                : OLine.fromRange({ y: pos }, intersection),
            axis,
            matchDirection: dir,
            respectDirection: true,
            distancePairs: [dp]
          });

          anchorPositions[oAxis].add(pos);
        }
      }
    }

    return anchors;
  }

  makeGuide(box: Box, match: MatchingAnchorPair<'distance'>, axis: Axis): Guide | undefined {
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
      matchingAnchor: match.matching,
      selfAnchor: match.self
    };
  }

  moveAnchor(anchor: AnchorOfType<'distance'>, delta: Point): void {
    anchor.line = Line.move(anchor.line, delta);
    anchor.distancePairs.forEach(dp => {
      dp.pointA = Point.add(dp.pointA, delta);
      dp.pointB = Point.add(dp.pointB, delta);
      dp.rangeA = Range.add(dp.rangeA, delta[Axis.toXY(anchor.axis)]);
      dp.rangeB = Range.add(dp.rangeB, delta[Axis.toXY(anchor.axis)]);
    });
  }
}
