import {
  Anchor,
  AnchorOfType,
  Axis,
  DistancePair,
  LoadedDiagram,
  ResolvedNodeDef
} from '../diagram.ts';
import { Box, Direction, Line, Point, Vector } from '../../geometry/geometry.ts';
import { Range } from '../../geometry/range.ts';
import { VERIFY_NOT_REACHED } from '../../utils/assert.ts';
import { Guide } from '../selectionState.ts';
import { MatchingAnchorPair, SnapProvider } from './snapManager.ts';

export class NodeDistanceSnapProvider implements SnapProvider<'distance'> {
  constructor(
    private readonly diagram: LoadedDiagram,
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
      return Range.create(b.pos.x, b.pos.x + b.size.w)!;
    } else {
      return Range.create(b.pos.y, b.pos.y + b.size.h)!;
    }
  }

  private getMidpoint(a: Box, b: Box, axis: Axis) {
    const intersection = Range.intersection(this.getRange(a, axis), this.getRange(b, axis));
    if (!intersection) return undefined;
    return Range.midpoint(intersection);
  }

  getAnchors(box: Box): Anchor[] {
    const result: Record<Direction, { node: ResolvedNodeDef }[]> = {
      n: [],
      w: [],
      e: [],
      s: []
    };

    for (const node of this.diagram.queryNodes()) {
      if (this.excludedNodeIds.includes(node.id)) continue;
      if (Box.intersects(node.bounds, box)) continue;
      if (node.bounds.rotation !== 0) continue;

      if (
        Range.overlaps(this.getRange(node.bounds, 'h'), this.getRange(box, 'h')) ||
        Range.overlaps(this.getRange(node.bounds, 'v'), this.getRange(box, 'v'))
      ) {
        if (this.get(node.bounds, 's') < box.pos.y) {
          result.n.push({ node });
        } else if (this.get(node.bounds, 'e') < box.pos.x) {
          result.w.push({ node });
        } else if (node.bounds.pos.x > this.get(box, 'e')) {
          result.e.push({ node });
        } else if (node.bounds.pos.y > this.get(box, 's')) {
          result.s.push({ node });
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

    const anchors: Anchor[] = [];

    const directions: {
      dir: Direction;
      oDir: Direction;
      sign: 1 | -1;
      axis: Axis;
      oAxis: Axis;
    }[] = [
      { dir: 'n', oDir: 's', axis: 'h', oAxis: 'v', sign: -1 },
      { dir: 's', oDir: 'n', axis: 'h', oAxis: 'v', sign: 1 },
      { dir: 'w', oDir: 'e', axis: 'v', oAxis: 'h', sign: -1 },
      { dir: 'e', oDir: 'w', axis: 'v', oAxis: 'h', sign: 1 }
    ];

    for (const { dir, axis, sign, oDir, oAxis } of directions) {
      // Sort all by being closest
      // ... for north and south we want to sort with largest first
      // ... for east and south we want to sort with smallest first
      result[dir].sort((a, b) => {
        const ab = a.node.bounds;
        const bb = b.node.bounds;
        return sign * (this.get(ab, oDir) - this.get(bb, oDir));
      });

      for (let i = 0; i < result[dir].length - 1; i++) {
        const first = result[dir][i].node.bounds;

        const distances: DistancePair[] = [];
        for (let j = i + 1; j < result[dir].length; j++) {
          const d = sign * (this.get(result[dir][j].node.bounds, oDir) - this.get(first, dir));

          if (d <= 0) continue;

          const rangeA = this.getRange(first, axis);
          const rangeB = this.getRange(result[dir][j].node.bounds, axis);

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
              x: axis === 'h' ? mp : this.get(result[dir][j].node.bounds, oDir),
              y: axis === 'v' ? mp : this.get(result[dir][j].node.bounds, oDir)
            },
            rangeA: rangeA,
            rangeB: rangeB
          });
        }

        for (const dp of distances) {
          const pos = this.get(first, oDir) - sign * dp.distance;
          if (anchorPositions[oAxis].has(pos)) continue;

          const anchorPos = {
            x: axis === 'h' ? this.getMidpoint(first, box, axis)! : pos,
            y: axis === 'v' ? this.getMidpoint(first, box, axis)! : pos
          };
          anchors.push({
            ...baseDistanceAnchor,
            pos: anchorPos,
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

  makeGuide(box: Box, match: MatchingAnchorPair<'distance'>, axis: Axis): Guide {
    const m = match.matching;

    const tp = Point.add(
      match.matching.pos,
      Vector.from(m.distancePairs[0].pointA, m.distancePairs[0].pointB)
    );

    const instersection = Range.intersection(
      Range.intersection(m.distancePairs[0].rangeA, m.distancePairs[0].rangeB)!,
      this.getRange(box, axis)
    );

    const mp = Range.midpoint(instersection!);

    m.distancePairs.push({
      distance: m.distancePairs[0].distance,
      pointA: match.matching.pos,
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

    const from = {
      x: axis === 'h' ? match.self.pos.x - match.self.offset.x : match.self.pos.x,
      y: axis === 'v' ? match.self.pos.y - match.self.offset.y : match.self.pos.y
    };

    const to = {
      x: axis === 'h' ? match.self.pos.x + match.self.offset.x : match.self.pos.x,
      y: axis === 'v' ? match.self.pos.y + match.self.offset.y : match.self.pos.y
    };

    return {
      line: Line.from(from, to),
      type: match.matching.type,
      matchingAnchor: match.matching,
      selfAnchor: match.self
    };
  }

  moveAnchor(anchor: AnchorOfType<'distance'>, delta: Point): void {
    anchor.pos = Point.add(anchor.pos, delta);
    anchor.distancePairs.forEach(dp => {
      dp.pointA = Point.add(dp.pointA, delta);
      dp.pointB = Point.add(dp.pointB, delta);
      dp.rangeA = Range.add(dp.rangeA, delta[Axis.toXY(anchor.axis)]);
      dp.rangeB = Range.add(dp.rangeB, delta[Axis.toXY(anchor.axis)]);
    });
  }
}
