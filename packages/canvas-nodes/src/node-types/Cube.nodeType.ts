import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DeepReadonly } from '@diagram-craft/utils/types';
import { round } from '@diagram-craft/utils/math';
import { LocalCoordinateSystem } from '@diagram-craft/geometry/lcs';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  size?: number;
};

declare global {
  interface NodeProps {
    shapeCube?: ExtraProps;
  }
}

// Custom properties ************************************************************

const Size = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'size',
    label: 'Size',
    type: 'number',
    value: Size.get(node.props.shapeCube),
    maxValue: 50,
    unit: 'px',
    onChange: (value: number, uow: UnitOfWork) => Size.set(value, node, uow)
  }),

  get: (props: DeepReadonly<ExtraProps> | undefined) => props?.size ?? 10,

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= 50 || value <= 0) return;
    node.updateProps(props => (props.shapeCube = { size: round(value) }), uow);
  }
};

// NodeDefinition and Shape *****************************************************

export class CubeNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('cube', 'Cube', CubeNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<CubeNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const size = Size.get(props.nodeProps.shapeCube);
      const sizePct = size / Math.min(props.node.bounds.w, props.node.bounds.h);

      const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
      shapeBuilder.boundaryPath(boundary.all());

      const bounds = props.node.bounds;

      const lcs = new LocalCoordinateSystem(props.node.bounds, [0, 1], [0, 1], false);

      // Inner box
      const inner = new PathBuilder(p => lcs.toGlobal(p));
      inner.moveTo(Point.of(0, sizePct));
      inner.lineTo(Point.of(1 - sizePct, sizePct));
      inner.lineTo(Point.of(1 - sizePct, 1));
      inner.lineTo(Point.of(0, 1));
      inner.close();
      shapeBuilder.path(inner.getPaths().all());

      // Top
      const top = new PathBuilder(p => lcs.toGlobal(p));
      top.moveTo(Point.of(sizePct, 0));
      top.lineTo(Point.of(1, 0));
      top.lineTo(Point.of(1 - sizePct, sizePct));
      top.lineTo(Point.of(0, sizePct));
      top.close();
      shapeBuilder.path(top.getPaths().all());

      shapeBuilder.text(this, '1', props.nodeProps.text, {
        x: props.node.bounds.x,
        y: props.node.bounds.y + size,
        w: props.node.bounds.w,
        h: props.node.bounds.h - size,
        r: props.node.bounds.r
      });

      shapeBuilder.controlPoint(
        Point.of(bounds.x + (1 - sizePct) * bounds.w, bounds.y + sizePct * bounds.h),
        ({ x }, uow) => {
          const distance = Math.max(0, bounds.x + bounds.w - x);
          Size.set(distance, props.node, uow);
          return `Size: ${Size.get(props.node.props.shapeCube)}px`;
        }
      );
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const sizePct = Size.get(def.props.shapeCube) / Math.min(def.bounds.w, def.bounds.h);

    const lcs = new LocalCoordinateSystem(def.bounds, [0, 1], [0, 1], false);
    const pathBuilder = new PathBuilder(p => lcs.toGlobal(p));

    pathBuilder.moveTo(Point.of(0, sizePct));
    pathBuilder.lineTo(Point.of(sizePct, 0));
    pathBuilder.lineTo(Point.of(1, 0));
    pathBuilder.lineTo(Point.of(1, 1 - sizePct));
    pathBuilder.lineTo(Point.of(1 - sizePct, 1));
    pathBuilder.lineTo(Point.of(0, 1));
    pathBuilder.close();

    return pathBuilder;
  }

  getCustomProperties(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [Size.definition(node)];
  }
}
