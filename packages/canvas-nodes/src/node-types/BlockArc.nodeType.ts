import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  CustomPropertyDefinition,
  NumberCustomPropertyType
} from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { round } from '@diagram-craft/utils/math';
import { Angle } from '@diagram-craft/geometry/angle';
import { Box } from '@diagram-craft/geometry/box';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { ScreenVector } from '@diagram-craft/geometry/vector';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  innerRadius?: number;
  startAngle?: number;
  endAngle?: number;
};

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      blockArc?: ExtraProps;
    }
  }
}

const $defaults = registerCustomNodeDefaults('blockArc', {
  innerRadius: 70,
  startAngle: -40,
  endAngle: 200
});

// Custom properties ************************************************************

const InnerRadius = {
  definition: (node: DiagramNode): NumberCustomPropertyType => ({
    id: 'innerRadius',
    label: 'Inner Radius',
    type: 'number',
    value: node.renderProps.custom.blockArc.innerRadius,
    maxValue: 99,
    unit: '%',
    isSet: node.storedProps.custom?.blockArc?.innerRadius !== undefined,
    onChange: (value: number | undefined, uow: UnitOfWork) => InnerRadius.set(value, node, uow)
  }),

  set: (value: number | undefined, node: DiagramNode, uow: UnitOfWork) => {
    if (value === undefined) {
      node.updateCustomProps('blockArc', props => (props.innerRadius = undefined), uow);
    } else {
      if (value >= 99 || value <= 0) return;
      node.updateCustomProps('blockArc', props => (props.innerRadius = round(value)), uow);
    }
  }
};

const StartAngle = {
  definition: (node: DiagramNode): NumberCustomPropertyType => ({
    id: 'startAngle',
    label: 'Start Angle',
    type: 'number',
    value: node.renderProps.custom.blockArc.startAngle,
    maxValue: 360,
    unit: '°',
    isSet: node.storedProps.custom?.blockArc?.startAngle !== undefined,
    onChange: (value: number | undefined, uow: UnitOfWork) => StartAngle.set(value, node, uow)
  }),

  set: (value: number | undefined, node: DiagramNode, uow: UnitOfWork) => {
    if (value === undefined) {
      node.updateCustomProps('blockArc', props => (props.startAngle = undefined), uow);
    } else {
      if (value >= 360 || value <= -360) return;
      if (value >= $defaults(node.editProps.custom!.blockArc).endAngle) {
        StartAngle.set(value - 360, node, uow);
        return;
      }
      node.updateCustomProps('blockArc', props => (props.startAngle = round(value)), uow);
    }
  }
};

const EndAngle = {
  definition: (node: DiagramNode): NumberCustomPropertyType => ({
    id: 'endAngle',
    label: 'End Angle',
    type: 'number',
    value: node.renderProps.custom.blockArc.endAngle,
    maxValue: 360,
    unit: '°',
    isSet: node.storedProps.custom?.blockArc?.endAngle !== undefined,
    onChange: (value: number | undefined, uow: UnitOfWork) => EndAngle.set(value, node, uow)
  }),

  set: (value: number | undefined, node: DiagramNode, uow: UnitOfWork) => {
    if (value === undefined) {
      node.updateCustomProps('blockArc', props => (props.endAngle = undefined), uow);
    } else {
      if (value >= 360 || value <= -360) return;
      if (value <= $defaults(node.editProps.custom?.blockArc).startAngle) {
        EndAngle.set(value + 360, node, uow);
        return;
      }
      node.updateCustomProps('blockArc', props => (props.endAngle = round(value)), uow);
    }
  }
};

// NodeDefinition and Shape *****************************************************

export class BlockArcNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('blockArc', 'BlockArc', BlockArcNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<BlockArcNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      super.buildShape(props, shapeBuilder);

      const { start, end, startInner } = this.def.getPointsOfSignificance(props.node);
      const bounds = props.node.bounds;
      const c = Box.center(bounds);

      shapeBuilder.controlPoint(Box.fromOffset(bounds, startInner), (p, uow) => {
        const distance = Point.distance(c, p);
        const radius = Point.distance(c, Box.fromOffset(bounds, start));

        InnerRadius.set((distance / radius) * 100, props.node, uow);
        return `Inner Radius: ${props.node.renderProps.custom.blockArc.innerRadius}%`;
      });

      shapeBuilder.controlPoint(Box.fromOffset(bounds, start), (p, uow) => {
        const angle = Math.atan2(c.y - p.y, p.x - c.x);
        StartAngle.set(Angle.toDeg(angle), props.node, uow);
        return `Start Angle: ${props.node.renderProps.custom.blockArc.startAngle}°`;
      });

      shapeBuilder.controlPoint(Box.fromOffset(bounds, end), (p, uow) => {
        const angle = Math.atan2(c.y - p.y, p.x - c.x);
        EndAngle.set(Angle.toDeg(angle), props.node, uow);
        return `End Angle: ${props.node.renderProps.custom.blockArc.endAngle}°`;
      });
    }
  };

  getBoundingPathBuilder(node: DiagramNode) {
    const startAngle = Angle.toRad(node.renderProps.custom.blockArc.startAngle);
    const endAngle = Angle.toRad(node.renderProps.custom.blockArc.endAngle);

    const { R, r, start, end, startInner, endInner } = this.getPointsOfSignificance(node);

    const da = Math.abs(endAngle - startAngle);
    const largeArcFlag = da <= Math.PI || da >= 2 * Math.PI ? 0 : 1;

    return new PathListBuilder()
      .withTransform(fromUnitLCS(node.bounds))
      .moveTo(start)
      .lineTo(startInner)
      .arcTo(endInner, r, r, 0, largeArcFlag)
      .lineTo(end)
      .arcTo(start, R, R, 0, largeArcFlag, 1);
  }

  getCustomPropertyDefinitions(node: DiagramNode): CustomPropertyDefinition {
    return [InnerRadius.definition(node), StartAngle.definition(node), EndAngle.definition(node)];
  }

  private getPointsOfSignificance(node: DiagramNode) {
    const innerRadius = node.renderProps.custom.blockArc.innerRadius;
    const startAngle = Angle.toRad(node.renderProps.custom.blockArc.startAngle);
    const endAngle = Angle.toRad(node.renderProps.custom.blockArc.endAngle);

    const R = 0.5;
    const r = R * (innerRadius / 100);
    const center = { x: 0.5, y: 0.5 };

    return {
      R,
      r,
      start: Point.add(center, ScreenVector.fromPolar(startAngle, R)),
      end: Point.add(center, ScreenVector.fromPolar(endAngle, R)),
      startInner: Point.add(center, ScreenVector.fromPolar(startAngle, r)),
      endInner: Point.add(center, ScreenVector.fromPolar(endAngle, r))
    };
  }
}
