import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildProps,
  pointInBounds
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DeepReadonly } from '@diagram-craft/utils/types';
import { round } from '@diagram-craft/utils/math';
import { Angle } from '@diagram-craft/geometry/angle';
import { Box } from '@diagram-craft/geometry/box';

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

// Custom properties ************************************************************

const InnerRadius = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'innerRadius',
    label: 'Inner Radius',
    type: 'number',
    value: InnerRadius.get(node.props.shapeBlockArc),
    maxValue: 99,
    unit: '%',
    onChange: (value: number, uow: UnitOfWork) => InnerRadius.set(value, node, uow)
  }),

  get: (props: DeepReadonly<ExtraProps> | undefined) => props?.innerRadius ?? 70,

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
    value: StartAngle.get(node.props.shapeBlockArc),
    maxValue: 360,
    unit: '°',
    onChange: (value: number, uow: UnitOfWork) => StartAngle.set(value, node, uow)
  }),

  get: (props: DeepReadonly<ExtraProps> | undefined) => props?.startAngle ?? -40,

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= 360 || value <= -360) return;
    if (value >= EndAngle.get(node.propsForEditing.shapeBlockArc)) {
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
    value: EndAngle.get(node.props.shapeBlockArc),
    maxValue: 360,
    unit: '°',
    onChange: (value: number, uow: UnitOfWork) => EndAngle.set(value, node, uow)
  }),

  get: (props: DeepReadonly<ExtraProps> | undefined) => props?.endAngle ?? 200,

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= 360 || value <= -360) return;
    if (value <= StartAngle.get(node.propsForEditing.shapeBlockArc)) {
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

  static Shape = class extends BaseNodeComponent<BlockArcNodeDefinition> {
    buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
      super.buildShape(props, shapeBuilder);

      const bounds = props.node.bounds;

      const innerRadius = InnerRadius.get(props.nodeProps.shapeBlockArc);
      const startAngle = Angle.toRad(StartAngle.get(props.nodeProps.shapeBlockArc));
      const endAngle = Angle.toRad(EndAngle.get(props.nodeProps.shapeBlockArc));

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
          return `Inner Radius: ${InnerRadius.get(props.node.props.shapeBlockArc)}%`;
        }
      );

      shapeBuilder.controlPoint(pointInBounds(Point.of(startX, startY), bounds), (p, uow) => {
        const angle = Math.atan2(Box.center(bounds).y - p.y, p.x - Box.center(bounds).x);
        StartAngle.set(Angle.toDeg(angle), props.node, uow);
        return `Start Angle: ${StartAngle.get(props.node.props.shapeBlockArc)}°`;
      });

      shapeBuilder.controlPoint(pointInBounds(Point.of(endX, endY), bounds), (p, uow) => {
        const angle = Math.atan2(Box.center(bounds).y - p.y, p.x - Box.center(bounds).x);
        EndAngle.set(Angle.toDeg(angle), props.node, uow);
        return `End Angle: ${EndAngle.get(props.node.props.shapeBlockArc)}°`;
      });
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const innerRadius = InnerRadius.get(def.props.shapeBlockArc);
    const startAngle = Angle.toRad(StartAngle.get(def.props.shapeBlockArc));
    const endAngle = Angle.toRad(EndAngle.get(def.props.shapeBlockArc));

    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));

    const startX = Math.cos(startAngle);
    const startY = Math.sin(startAngle);
    pathBuilder.moveTo(Point.of(startX, startY));

    const endX = Math.cos(endAngle);
    const endY = Math.sin(endAngle);

    const da = Math.abs(endAngle - startAngle);
    const largeArcFlag = da <= Math.PI || da >= 2 * Math.PI ? 0 : 1;

    pathBuilder.arcTo(Point.of(endX, endY), 1 / 2, 1 / 2, 0, largeArcFlag);

    const endInnerX = (innerRadius / 100) * Math.cos(endAngle);
    const endInnerY = (innerRadius / 100) * Math.sin(endAngle);
    pathBuilder.lineTo(Point.of(endInnerX, endInnerY));

    const startInnerX = (innerRadius / 100) * Math.cos(startAngle);
    const startInnerY = (innerRadius / 100) * Math.sin(startAngle);
    pathBuilder.arcTo(
      Point.of(startInnerX, startInnerY),
      innerRadius / 200,
      innerRadius / 200,
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
