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
  CustomProperty,
  CustomPropertyDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { round } from '@diagram-craft/utils/math';
import { Angle } from '@diagram-craft/geometry/angle';
import { Box } from '@diagram-craft/geometry/box';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { ScreenVector } from '@diagram-craft/geometry/vector';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  startAngle?: number;
  endAngle?: number;
};

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      arc?: ExtraProps;
    }
  }
}

const $defaults = registerCustomNodeDefaults('arc', {
  startAngle: -40,
  endAngle: 200
});

// Custom properties ************************************************************

const propStartAngle = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Start Angle', 'custom.arc.startAngle', {
    minValue: -360,
    maxValue: 360,
    unit: '°',
    set: (value, uow) => {
      if (value === undefined) {
        node.updateCustomProps('arc', props => (props.startAngle = undefined), uow);
      } else {
        if (value >= 360 || value <= -360) return;
        while (value >= $defaults(node.editProps.custom!.arc).endAngle) {
          value -= 360;
        }
        node.updateCustomProps('arc', props => (props.startAngle = round(value!)), uow);
      }
    }
  });

const propEndAngle = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'End Angle', 'custom.arc.endAngle', {
    maxValue: 360,
    unit: '°',
    set: (value, uow) => {
      if (value === undefined) {
        node.updateCustomProps('arc', props => (props.endAngle = undefined), uow);
      } else {
        if (value >= 360 || value <= -360) return;
        while (value <= $defaults(node.editProps.custom?.arc).startAngle) {
          value += 360;
        }
        node.updateCustomProps('arc', props => (props.endAngle = round(value!)), uow);
      }
    }
  });

// NodeDefinition and Shape *****************************************************

export class ArcNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('arc', 'Arc', ArcNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<ArcNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      super.buildShape(props, shapeBuilder);

      const { start, end } = this.def.getPointsOfSignificance(props.node);
      const bounds = props.node.bounds;
      const c = Box.center(bounds);

      shapeBuilder.controlPoint(Box.fromOffset(bounds, start), (p, uow) => {
        const angle = Math.atan2(c.y - p.y, p.x - c.x);
        propStartAngle(props.node).set(Angle.toDeg(angle), uow);
        return `Start Angle: ${props.node.renderProps.custom.arc.startAngle}°`;
      });

      shapeBuilder.controlPoint(Box.fromOffset(bounds, end), (p, uow) => {
        const angle = Math.atan2(c.y - p.y, p.x - c.x);
        propEndAngle(props.node).set(Angle.toDeg(angle), uow);
        return `End Angle: ${props.node.renderProps.custom.arc.endAngle}°`;
      });
    }
  };

  getBoundingPathBuilder(node: DiagramNode) {
    const startAngle = Angle.toRad(node.renderProps.custom.arc.startAngle);
    const endAngle = Angle.toRad(node.renderProps.custom.arc.endAngle);

    const { R, start, end } = this.getPointsOfSignificance(node);

    const da = Math.abs(endAngle - startAngle);
    const largeArcFlag = da <= Math.PI || da >= 2 * Math.PI ? 0 : 1;

    return new PathListBuilder()
      .withTransform(fromUnitLCS(node.bounds))
      .moveTo(start)
      .arcTo(end, R, R, 0, largeArcFlag);
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [propStartAngle(node), propEndAngle(node)]);
  }

  private getPointsOfSignificance(node: DiagramNode) {
    const startAngle = Angle.toRad(node.renderProps.custom.arc.startAngle);
    const endAngle = Angle.toRad(node.renderProps.custom.arc.endAngle);

    const R = 0.5;
    const center = { x: 0.5, y: 0.5 };

    return {
      R,
      start: Point.add(center, ScreenVector.fromPolar(startAngle, R)),
      end: Point.add(center, ScreenVector.fromPolar(endAngle, R))
    };
  }
}
