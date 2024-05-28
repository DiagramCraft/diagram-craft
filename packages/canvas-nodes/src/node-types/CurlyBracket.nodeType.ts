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
import { DeepReadonly } from '@diagram-craft/utils/types';
import { round } from '@diagram-craft/utils/math';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  size?: number;
};

declare global {
  interface NodeProps {
    shapeCurlyBracket?: ExtraProps;
  }
}

// Custom properties ************************************************************

const Size = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'size',
    label: 'Size',
    type: 'number',
    value: Size.get(node.props.shapeCurlyBracket),
    maxValue: 50,
    unit: '%',
    onChange: (value: number, uow: UnitOfWork) => Size.set(value, node, uow)
  }),

  get: (props: DeepReadonly<ExtraProps> | undefined) => props?.size ?? 50,

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= 50 || value <= 0) return;
    node.updateProps(props => (props.shapeCurlyBracket = { size: round(value) }), uow);
  }
};

// NodeDefinition and Shape *****************************************************

export class CurlyBracketNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('curlyBracket', 'CurlyBracket', CurlyBracketNodeDefinition.Shape);
    this.capabilities.fill = false;
  }

  static Shape = class extends BaseNodeComponent<CurlyBracketNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      super.buildShape(props, shapeBuilder);

      const bounds = props.node.bounds;
      const sizePct = Size.get(props.nodeProps.shapeCurlyBracket) / 100;

      shapeBuilder.controlPoint(
        Point.of(bounds.x + sizePct * bounds.w, bounds.y + bounds.h / 2),
        ({ x }, uow) => {
          const distance = Math.max(0, x - bounds.x);
          Size.set((distance / bounds.w) * 100, props.node, uow);
          return `Size: ${Size.get(props.node.props.shapeCurlyBracket)}%`;
        }
      );
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const sizePct = Size.get(def.props.shapeCurlyBracket) / 100;

    const rx = (2 * 10) / def.bounds.w;
    const ry = (2 * 10) / def.bounds.h;
    const bar = -1 + sizePct * 2;

    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));

    pathBuilder.moveTo(Point.of(1, 1));
    pathBuilder.lineTo(Point.of(bar + rx, 1));
    pathBuilder.arcTo(Point.of(bar, 1 - ry), rx, ry, 0);
    pathBuilder.lineTo(Point.of(bar, ry));
    pathBuilder.arcTo(Point.of(bar - rx, 0), rx, ry, 0, 0, 1);
    pathBuilder.lineTo(Point.of(-1, 0));

    pathBuilder.moveTo(Point.of(bar - rx, 0));
    pathBuilder.arcTo(Point.of(bar, -ry), rx, ry, 0, 0, 1);
    pathBuilder.lineTo(Point.of(bar, -1 + ry));
    pathBuilder.arcTo(Point.of(bar + rx, -1), rx, ry, 0);
    pathBuilder.lineTo(Point.of(1, -1));

    return pathBuilder;
  }

  getCustomProperties(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [Size.definition(node)];
  }

  getDefaultProps(_mode: 'picker' | 'canvas'): NodeProps {
    return {
      fill: {
        enabled: false
      }
    };
  }

  getDefaultConfig() {
    return {
      size: {
        w: 35,
        h: 100
      }
    };
  }
}
