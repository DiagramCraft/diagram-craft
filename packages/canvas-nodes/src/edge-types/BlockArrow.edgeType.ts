import { Path } from '@diagram-craft/geometry/path';
import {
  BaseEdgeComponent,
  EdgeComponentProps
} from '@diagram-craft/canvas/components/BaseEdgeComponent';
import { LengthOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import { Vector } from '@diagram-craft/geometry/vector';
import { RawSegment } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DeepReadonly, DeepRequired } from '@diagram-craft/utils/types';
import { ShapeEdgeDefinition } from '@diagram-craft/canvas/shape/shapeEdgeDefinition';

const blockArrowMakePath = (path: Path, props: EdgeComponentProps) => {
  const width = props.def.propsForRendering.shapeBlockArrow?.width ?? 20;
  const arrowDepth = props.def.propsForRendering.shapeBlockArrow?.arrowDepth ?? 20;
  const arrowWidth = props.def.propsForRendering.shapeBlockArrow?.arrowWidth ?? 50;

  const offset1 = path.offset(width / 2);
  const offset2 = path.offset(-width / 2);

  // Join the start of both paths
  const start = new Path(offset2.start, [['L', offset1.start.x, offset1.start.y]]);

  // Add arrow shape
  const len1 = offset1.length();
  const [shortened1] = offset1.split(
    LengthOffsetOnPath.toTimeOffsetOnSegment({ pathD: len1 - arrowDepth }, offset1)
  );

  const len2 = offset2.length();
  const [shortened2] = offset2.split(
    LengthOffsetOnPath.toTimeOffsetOnSegment({ pathD: len2 - arrowDepth }, offset2)
  );

  const normal = Vector.tangentToNormal(offset1.tangentAt({ pathD: len1 - arrowDepth }));

  const arrowWidthOffset = (arrowWidth - width) / 2;
  const arrowShapeSegments: RawSegment[] = [
    [
      'L',
      Point.add(shortened1.end, Vector.scale(normal, arrowWidthOffset)).x,
      Point.add(shortened1.end, Vector.scale(normal, arrowWidthOffset)).y
    ],
    ['L', path.end.x, path.end.y],
    [
      'L',
      Point.add(shortened2.end, Vector.scale(normal, -arrowWidthOffset)).x,
      Point.add(shortened2.end, Vector.scale(normal, -arrowWidthOffset)).y
    ],
    ['L', shortened2.end.x, shortened2.end.y]
  ];

  return [
    Path.join(start, shortened1, new Path(shortened1.end, arrowShapeSegments), shortened2.reverse())
  ];
};

export class BlockArrowEdgeDefinition extends ShapeEdgeDefinition {
  constructor() {
    super('Block Arrow', 'BlockArrow', BlockArrowEdgeType);
  }
}

export class BlockArrowEdgeType extends BaseEdgeComponent {
  getPaths(path: Path, props: EdgeComponentProps) {
    return blockArrowMakePath(path, props);
  }

  processStyle(
    style: Partial<CSSStyleDeclaration>,
    edgeProps: DeepReadonly<DeepRequired<EdgeProps>>
  ): DeepReadonly<DeepRequired<EdgeProps>> {
    const p = super.processStyle(style, edgeProps);
    style.fill = p.fill.color ?? 'none';
    style.opacity = (p.effects.opacity ?? 1).toString();
    return {
      ...p,
      arrow: {
        start: { type: 'NONE', size: 0 },
        end: { type: 'NONE', size: 0 }
      }
    };
  }
}
