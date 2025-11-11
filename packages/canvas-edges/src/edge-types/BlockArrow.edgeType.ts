import { Path } from '@diagram-craft/geometry/path';
import { BaseEdgeComponent } from '@diagram-craft/canvas/components/BaseEdgeComponent';
import { LengthOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import { Vector } from '@diagram-craft/geometry/vector';
import { RawSegment } from '@diagram-craft/geometry/pathListBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DeepReadonly, DeepRequired } from '@diagram-craft/utils/types';
import { ShapeEdgeDefinition } from '@diagram-craft/canvas/shape/shapeEdgeDefinition';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramEdge, EdgePropsForRendering } from '@diagram-craft/model/diagramEdge';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { ArrowShape } from '@diagram-craft/canvas/arrowShapes';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { round } from '@diagram-craft/utils/math';
import { registerCustomEdgeDefaults } from '@diagram-craft/model/diagramDefaults';
import type { EdgeCapability } from '@diagram-craft/model/edgeDefinition';

// EdgeProps extension for custom props *****************************************

type ExtraProps = {
  arrowDepth?: number;
  arrowWidth?: number;
  width?: number;
};

declare global {
  namespace DiagramCraft {
    interface CustomEdgeProps {
      blockArrow?: ExtraProps;
    }
  }
}

const $defaults = registerCustomEdgeDefaults('blockArrow', {
  arrowDepth: 20,
  arrowWidth: 50,
  width: 20
});

// Custom properties ************************************************************

const ArrowDepth = {
  definition: (edge: DiagramEdge): CustomPropertyDefinition => ({
    id: 'arrowDepth',
    label: 'Arrow Depth',
    type: 'number',
    value: round(edge.renderProps.custom.blockArrow.arrowDepth),
    unit: 'px',
    isSet: edge.storedProps.custom?.blockArrow?.arrowDepth !== undefined,
    onChange: (value: number | undefined, uow: UnitOfWork) => ArrowDepth.set(value, edge, uow)
  }),

  set: (value: number | undefined, edge: DiagramEdge, uow: UnitOfWork) => {
    if (value === undefined) {
      edge.updateCustomProps('blockArrow', props => (props.arrowDepth = undefined), uow);
    } else {
      if (value <= 0) return;
      edge.updateCustomProps('blockArrow', props => (props.arrowDepth = round(value)), uow);
    }
  }
};

const ArrowWidth = {
  definition: (edge: DiagramEdge): CustomPropertyDefinition => ({
    id: 'arrowWidth',
    label: 'Arrow Width',
    type: 'number',
    value: round(edge.renderProps.custom.blockArrow.arrowWidth),
    unit: 'px',
    isSet: edge.storedProps.custom?.blockArrow?.arrowWidth !== undefined,
    onChange: (value: number | undefined, uow: UnitOfWork) => ArrowWidth.set(value, edge, uow)
  }),

  set: (value: number | undefined, edge: DiagramEdge, uow: UnitOfWork) => {
    if (value === undefined) {
      edge.updateCustomProps('blockArrow', props => (props.arrowWidth = undefined), uow);
    } else {
      if (value <= 0) return;
      edge.updateCustomProps('blockArrow', props => (props.arrowWidth = round(value)), uow);
    }
  }
};

const Width = {
  definition: (edge: DiagramEdge): CustomPropertyDefinition => ({
    id: 'width',
    label: 'Width',
    type: 'number',
    value: round(edge.renderProps.custom.blockArrow.width),
    unit: 'px',
    isSet: edge.storedProps.custom?.blockArrow?.width !== undefined,
    onChange: (value: number | undefined, uow: UnitOfWork) => Width.set(value, edge, uow)
  }),

  set: (value: number | undefined, edge: DiagramEdge, uow: UnitOfWork) => {
    if (value === undefined) {
      edge.updateCustomProps('blockArrow', props => (props.width = undefined), uow);
    } else {
      if (value <= 0 || value >= round($defaults(edge.editProps.custom?.blockArrow).arrowWidth))
        return;
      edge.updateCustomProps('blockArrow', props => (props.width = round(value)), uow);
    }
  }
};

// EdgeDefinition and Shape *****************************************************

export class BlockArrowEdgeDefinition extends ShapeEdgeDefinition {
  constructor() {
    super('Block Arrow', 'BlockArrow', BlockArrowEdgeDefinition.Shape);
  }

  static Shape = class extends BaseEdgeComponent {
    buildShape(
      path: Path,
      shapeBuilder: ShapeBuilder,
      edge: DiagramEdge,
      props: EdgePropsForRendering
    ) {
      const width = round(props.custom.blockArrow.width);
      const arrowDepth = round(props.custom.blockArrow.arrowDepth);
      const arrowWidth = round(props.custom.blockArrow.arrowWidth);

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

      const paths = [
        Path.join(
          start,
          shortened1,
          new Path(shortened1.end, arrowShapeSegments),
          shortened2.reverse()
        )
      ];

      shapeBuilder.edge(paths, props);

      shapeBuilder.controlPoint(shortened1.end, (pos, uow) => {
        const pointOnPath = path.projectPoint(pos);
        const distance = Point.distance(pointOnPath.point, pos);

        const newWidth = round(distance * 2);

        Width.set(newWidth, edge, uow);

        return `Width: ${newWidth}px`;
      });

      shapeBuilder.controlPoint(
        Point.add(shortened1.end, Vector.scale(normal, arrowWidthOffset)),
        (pos, uow) => {
          const point = path.end;
          const tangent = Vector.normalize(path.tangentAt({ pathD: path.length() }));

          const newPos = Point.rotate(pos, -Vector.angle(tangent));
          const newReference = Point.rotate(point, -Vector.angle(tangent));

          const dx = Math.abs(newPos.x - newReference.x);
          const dy = Math.abs(newPos.y - newReference.y) * 2;

          const newArrowWidth = round(dy);
          const newArrowDepth = round(dx);

          if (newArrowDepth >= path.length())
            return `Arrow Width: ${arrowWidth}px, Arrow Depth: ${arrowDepth}px`;

          ArrowWidth.set(newArrowWidth, edge, uow);
          ArrowDepth.set(newArrowDepth, edge, uow);

          return `Arrow Width: ${newArrowWidth}px, Arrow Depth: ${newArrowDepth}px`;
        }
      );
    }

    // Note: Override getArrow to return undefined to disable arrows
    protected getArrow(
      _type: 'start' | 'end',
      _edgeProps: DeepReadonly<DeepRequired<DiagramCraft.EdgeProps>>
    ): ArrowShape | undefined {
      return undefined;
    }
  };

  supports(capability: EdgeCapability): boolean {
    return !['arrows', 'line-hops'].includes(capability);
  }

  getCustomPropertyDefinitions(edge: DiagramEdge): Array<CustomPropertyDefinition> {
    return [Width.definition(edge), ArrowWidth.definition(edge), ArrowDepth.definition(edge)];
  }
}
