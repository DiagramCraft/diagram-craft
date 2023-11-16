import { Box } from '../../geometry/box.ts';
import { ResolvedEdgeDef, ResolvedNodeDef } from '../../model-viewer/diagram.ts';
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

export const NodeHelper = {
  edges: (node: ResolvedNodeDef): ResolvedEdgeDef[] => {
    return [
      ...Object.values(node.edges ?? {}).flatMap(e => e),
      ...node.children.flatMap(c => NodeHelper.edges(c))
    ];
  }
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
        node: ResolvedNodeDef;
        distancePairs: DistancePair[];
      }
    | {
        type: 'node';
        node: ResolvedNodeDef;
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
        line: {
          from: { x: node.pos.x, y: node.pos.y + node.size.h / 2 },
          to: { x: node.pos.x + node.size.w, y: node.pos.y + node.size.h / 2 }
        },
        axis: 'h',
        type
      },
      {
        line: {
          from: { x: node.pos.x + node.size.w / 2, y: node.pos.y },
          to: { x: node.pos.x + node.size.w / 2, y: node.pos.y + node.size.h }
        },
        axis: 'v',
        type
      }
    ];

    if (node.rotation !== 0) return center;

    center.push({
      line: {
        from: { x: node.pos.x, y: node.pos.y },
        to: { x: node.pos.x + node.size.w, y: node.pos.y }
      },
      axis: 'h',
      type,
      matchDirection: 'n'
    });
    center.push({
      line: {
        from: { x: node.pos.x, y: node.pos.y + node.size.h },
        to: { x: node.pos.x + node.size.w, y: node.pos.y + node.size.h }
      },
      axis: 'h',
      type,
      matchDirection: 's'
    });
    center.push({
      line: {
        from: { x: node.pos.x, y: node.pos.y },
        to: { x: node.pos.x, y: node.pos.y + node.size.h }
      },
      axis: 'v',
      type,
      matchDirection: 'w'
    });
    center.push({
      line: {
        from: { x: node.pos.x + node.size.w, y: node.pos.y },
        to: { x: node.pos.x + node.size.w, y: node.pos.y + node.size.h }
      },
      axis: 'v',
      type,
      matchDirection: 'e'
    });
    return center;
  }
};
