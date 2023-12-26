import { Box } from '../../geometry/box.ts';
import { Line } from '../../geometry/line.ts';
import { Direction } from '../../geometry/direction.ts';
import { Point } from '../../geometry/point.ts';
import { Range } from '../../geometry/range.ts';
import { Axis } from '../../geometry/axis.ts';
import { DiagramNode } from '../diagramNode.ts';

type BaseMagnet = {
  line: Line;
  axis: Axis;
  matchDirection?: Direction;
  respectDirection?: boolean;
};

export type DistancePair = {
  // TODO: This is a bit redundant as the distance will be the same for all pairs
  distance: number;

  pointA: Point;
  pointB: Point;
};

export type DistancePairWithRange = DistancePair & {
  rangeA: Range;
  rangeB: Range;
};

export type Magnet = BaseMagnet &
  (
    | {
        type: 'source' | 'canvas' | 'grid';
      }
    | {
        type: 'size';
        size: number;
        node: DiagramNode;
        distancePairs: DistancePair[];
      }
    | {
        type: 'node';
        node: DiagramNode;
      }
    | {
        type: 'distance';
        distancePairs: DistancePairWithRange[];
      }
  );

export type MagnetType = Magnet['type'];

export type MagnetOfType<T extends MagnetType> = Magnet & { type: T };

export const Magnet = {
  forNode: (node: Box, type: 'source' = 'source'): Magnet[] => {
    const center: Magnet[] = [
      {
        line: Line.horizontal(node.pos.y + node.size.h / 2, [node.pos.x, node.pos.x + node.size.w]),
        axis: Axis.h,
        type
      },
      {
        line: Line.vertical(node.pos.x + node.size.w / 2, [node.pos.y, node.pos.y + node.size.h]),
        axis: Axis.v,
        type
      }
    ];

    if (node.rotation !== 0) return center;

    center.push({
      line: Line.of(
        { x: node.pos.x, y: node.pos.y },
        { x: node.pos.x + node.size.w, y: node.pos.y }
      ),
      axis: Axis.h,
      type,
      matchDirection: 'n'
    });
    center.push({
      line: Line.of(
        { x: node.pos.x, y: node.pos.y + node.size.h },
        { x: node.pos.x + node.size.w, y: node.pos.y + node.size.h }
      ),
      axis: Axis.h,
      type,
      matchDirection: 's'
    });
    center.push({
      line: Line.of(
        { x: node.pos.x, y: node.pos.y },
        { x: node.pos.x, y: node.pos.y + node.size.h }
      ),
      axis: Axis.v,
      type,
      matchDirection: 'w'
    });
    center.push({
      line: Line.of(
        { x: node.pos.x + node.size.w, y: node.pos.y },
        { x: node.pos.x + node.size.w, y: node.pos.y + node.size.h }
      ),
      axis: Axis.v,
      type,
      matchDirection: 'e'
    });
    return center;
  }
};
