import { Path } from '@diagram-craft/geometry/path';
import { BaseEdgeComponent } from '@diagram-craft/canvas/components/BaseEdgeComponent';
import { LengthOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import { Vector } from '@diagram-craft/geometry/vector';
import { RawSegment } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DeepReadonly, DeepRequired } from '@diagram-craft/utils/types';
import { ShapeEdgeDefinition } from '@diagram-craft/canvas/shape/shapeEdgeDefinition';
import { EdgeCapability } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { ArrowShape } from '@diagram-craft/canvas/arrowShapes';

const blockArrowMakePath = (path: Path, props: DeepReadonly<DeepRequired<EdgeProps>>) => {
  const width = props.shapeBlockArrow?.width ?? 20;
  const arrowDepth = props.shapeBlockArrow?.arrowDepth ?? 20;
  const arrowWidth = props.shapeBlockArrow?.arrowWidth ?? 50;

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
    super('Block Arrow', 'BlockArrow', BlockArrowEdgeDefinition.Shape);
  }

  static Shape = class extends BaseEdgeComponent {
    buildShape(
      path: Path,
      shapeBuilder: ShapeBuilder,
      _edge: DiagramEdge,
      props: DeepReadonly<DeepRequired<EdgeProps>>
    ) {
      const paths = blockArrowMakePath(path, props);
      const style = this.getStyle(props);
      style.fill = props.fill.color ?? 'none';
      style.opacity = (props.effects.opacity ?? 1).toString();

      shapeBuilder.edge(paths, style, props);
    }

    protected getArrow(
      _type: 'start' | 'end',
      _edgeProps: DeepReadonly<DeepRequired<EdgeProps>>
    ): ArrowShape | undefined {
      return undefined;
    }
  };

  supports(capability: EdgeCapability): boolean {
    return !['arrows', 'line-hops'].includes(capability);
  }
}
