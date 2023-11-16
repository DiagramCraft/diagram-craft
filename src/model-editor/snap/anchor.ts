import { Box } from '../../geometry/box.ts';
import { DiagramNode } from '../../model-viewer/diagram.ts';
import { Line } from '../../geometry/line.ts';
import { Direction } from '../../geometry/direction.ts';
import { Point } from '../../geometry/point.ts';
import { Range } from '../../geometry/range.ts';

// TODO: Do we still want this? or want this here?
export type Axis = 'h' | 'v';

export const Axis = {
  orthogonal: (axis: Axis): Axis => (axis === 'h' ? 'v' : 'h'),
  axises: (): Axis[] => ['h', 'v'],
  toXY: (axis: Axis): 'x' | 'y' => (axis === 'h' ? 'x' : 'y')
};

type BaseAnchor = {
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

export type Anchor = BaseAnchor &
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

export type AnchorType = Anchor['type'];

export type AnchorOfType<T extends AnchorType> = Anchor & { type: T };

export const Anchor = {
  forNode: (node: Box, type: 'source' = 'source'): Anchor[] => {
    const center: Anchor[] = [
      {
        line: Line.horizontal(node.pos.y + node.size.h / 2, [node.pos.x, node.pos.x + node.size.w]),
        axis: 'h',
        type
      },
      {
        line: Line.vertical(node.pos.x + node.size.w / 2, [node.pos.y, node.pos.y + node.size.h]),
        axis: 'v',
        type
      }
    ];

    if (node.rotation !== 0) return center;

    center.push({
      line: Line.of(
        { x: node.pos.x, y: node.pos.y },
        { x: node.pos.x + node.size.w, y: node.pos.y }
      ),
      axis: 'h',
      type,
      matchDirection: 'n'
    });
    center.push({
      line: Line.of(
        { x: node.pos.x, y: node.pos.y + node.size.h },
        { x: node.pos.x + node.size.w, y: node.pos.y + node.size.h }
      ),
      axis: 'h',
      type,
      matchDirection: 's'
    });
    center.push({
      line: Line.of(
        { x: node.pos.x, y: node.pos.y },
        { x: node.pos.x, y: node.pos.y + node.size.h }
      ),
      axis: 'v',
      type,
      matchDirection: 'w'
    });
    center.push({
      line: Line.of(
        { x: node.pos.x + node.size.w, y: node.pos.y },
        { x: node.pos.x + node.size.w, y: node.pos.y + node.size.h }
      ),
      axis: 'v',
      type,
      matchDirection: 'e'
    });
    return center;
  }
};
