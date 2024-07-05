import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { round } from '@diagram-craft/utils/math';
import { Angle } from '@diagram-craft/geometry/angle';
import { Box } from '@diagram-craft/geometry/box';
import { pointInBounds } from '@diagram-craft/canvas/pointInBounds';
import { registerNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Anchor } from '@diagram-craft/model/anchor';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  innerRadius?: number;
  startAngle?: number;
  endAngle?: number;
};

declare global {
  interface NodeProps {
    shapeBlockArc?: ExtraProps;
  }
}

const $defaults = registerNodeDefaults('shapeBlockArc', {
  innerRadius: 70,
  startAngle: -40,
  endAngle: 200
});

// Custom properties ************************************************************

const InnerRadius = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'innerRadius',
    label: 'Inner Radius',
    type: 'number',
    value: node.renderProps.shapeBlockArc.innerRadius,
    maxValue: 99,
    unit: '%',
    onChange: (value: number, uow: UnitOfWork) => InnerRadius.set(value, node, uow)
  }),

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= 99 || value <= 0) return;
    node.updateProps(
      props => (props.shapeBlockArc = { ...props.shapeBlockArc, innerRadius: round(value) }),
      uow
    );
  }
};

const StartAngle = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'startAngle',
    label: 'Start Angle',
    type: 'number',
    value: node.renderProps.shapeBlockArc.startAngle,
    maxValue: 360,
    unit: '°',
    onChange: (value: number, uow: UnitOfWork) => StartAngle.set(value, node, uow)
  }),

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= 360 || value <= -360) return;
    if (value >= $defaults(node.editProps.shapeBlockArc).endAngle) {
      StartAngle.set(value - 360, node, uow);
      return;
    }
    node.updateProps(
      props => (props.shapeBlockArc = { ...props.shapeBlockArc, startAngle: round(value) }),
      uow
    );
  }
};

const EndAngle = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'endAngle',
    label: 'End Angle',
    type: 'number',
    value: node.renderProps.shapeBlockArc.endAngle,
    maxValue: 360,
    unit: '°',
    onChange: (value: number, uow: UnitOfWork) => EndAngle.set(value, node, uow)
  }),

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= 360 || value <= -360) return;
    if (value <= $defaults(node.editProps.shapeBlockArc).startAngle) {
      EndAngle.set(value + 360, node, uow);
      return;
    }
    node.updateProps(
      props => (props.shapeBlockArc = { ...props.shapeBlockArc, endAngle: round(value) }),
      uow
    );
  }
};

// NodeDefinition and Shape *****************************************************

export class BlockArcNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('blockArc', 'BlockArc', BlockArcNodeDefinition.Shape);
  }

  getAnchors(_def: DiagramNode): Anchor[] {
    return [
      { start: Point.of(0.5, 0), id: '1', type: 'point' },
      { start: Point.of(1, 0.5), id: '2', type: 'point' },
      { start: Point.of(0.5, 1), id: '3', type: 'point' },
      { start: Point.of(0, 0.5), id: '4', type: 'point' }
    ];
  }

  static Shape = class extends BaseNodeComponent<BlockArcNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      super.buildShape(props, shapeBuilder);

      const bounds = props.node.bounds;

      const innerRadius = props.nodeProps.shapeBlockArc.innerRadius;
      const startAngle = Angle.toRad(props.nodeProps.shapeBlockArc.startAngle);
      const endAngle = Angle.toRad(props.nodeProps.shapeBlockArc.endAngle);

      const startInnerX = (innerRadius / 100) * Math.cos(startAngle);
      const startInnerY = (innerRadius / 100) * Math.sin(startAngle);

      const startX = Math.cos(startAngle);
      const startY = Math.sin(startAngle);

      const endX = Math.cos(endAngle);
      const endY = Math.sin(endAngle);

      shapeBuilder.controlPoint(
        pointInBounds(Point.of(startInnerX, startInnerY), bounds),
        (p, uow) => {
          const distance = Point.distance(Box.center(bounds), p);
          const radius = Point.distance(
            Box.center(bounds),
            pointInBounds(Point.of(startX, startY), bounds)
          );

          InnerRadius.set((distance / radius) * 100, props.node, uow);
          return `Inner Radius: ${props.node.renderProps.shapeBlockArc.innerRadius}%`;
        }
      );

      shapeBuilder.controlPoint(pointInBounds(Point.of(startX, startY), bounds), (p, uow) => {
        const angle = Math.atan2(Box.center(bounds).y - p.y, p.x - Box.center(bounds).x);
        StartAngle.set(Angle.toDeg(angle), props.node, uow);
        return `Start Angle: ${props.node.renderProps.shapeBlockArc.startAngle}°`;
      });

      shapeBuilder.controlPoint(pointInBounds(Point.of(endX, endY), bounds), (p, uow) => {
        const angle = Math.atan2(Box.center(bounds).y - p.y, p.x - Box.center(bounds).x);
        EndAngle.set(Angle.toDeg(angle), props.node, uow);
        return `End Angle: ${props.node.renderProps.shapeBlockArc.endAngle}°`;
      });
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const innerRadius = def.renderProps.shapeBlockArc.innerRadius;
    const startAngle = Angle.toRad(def.renderProps.shapeBlockArc.startAngle);
    const endAngle = Angle.toRad(def.renderProps.shapeBlockArc.endAngle);

    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));

    const startX = Math.cos(startAngle);
    const startY = Math.sin(startAngle);
    pathBuilder.moveTo(Point.of(startX, startY));

    const endX = Math.cos(endAngle);
    const endY = Math.sin(endAngle);

    const da = Math.abs(endAngle - startAngle);
    const largeArcFlag = da <= Math.PI || da >= 2 * Math.PI ? 0 : 1;

    pathBuilder.arcTo(Point.of(endX, endY), 1, 1, 0, largeArcFlag);

    const endInnerX = (innerRadius / 100) * Math.cos(endAngle);
    const endInnerY = (innerRadius / 100) * Math.sin(endAngle);
    pathBuilder.lineTo(Point.of(endInnerX, endInnerY));

    const startInnerX = (innerRadius / 100) * Math.cos(startAngle);
    const startInnerY = (innerRadius / 100) * Math.sin(startAngle);
    pathBuilder.arcTo(
      Point.of(startInnerX, startInnerY),
      innerRadius / 100,
      innerRadius / 100,
      0,
      largeArcFlag,
      1
    );

    pathBuilder.close();

    return pathBuilder;
  }

  getCustomProperties(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [InnerRadius.definition(node), StartAngle.definition(node), EndAngle.definition(node)];
  }
}
