import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { round } from '@diagram-craft/utils/math';
import { LocalCoordinateSystem } from '@diagram-craft/geometry/lcs';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Box } from '@diagram-craft/geometry/box';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  size?: number;
};

declare global {
  namespace DiagramCraft {
    interface CustomNodeProps {
      cube?: ExtraProps;
    }
  }
}

registerCustomNodeDefaults('cube', { size: 10 });

// Custom properties ************************************************************

const Size = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'size',
    label: 'Size',
    type: 'number',
    value: node.renderProps.custom.cube.size,
    maxValue: 50,
    unit: 'px',
    isSet: node.storedProps.custom?.cube?.size !== undefined,
    onChange: (value: number | undefined, uow: UnitOfWork) => Size.set(value, node, uow)
  }),

  set: (value: number | undefined, node: DiagramNode, uow: UnitOfWork) => {
    if (value === undefined) {
      node.updateCustomProps('cube', props => (props.size = undefined), uow);
    } else {
      if (value >= 50 || value <= 0) return;
      node.updateCustomProps('cube', props => (props.size = round(value)), uow);
    }
  }
};

// NodeDefinition and Shape *****************************************************

export class CubeNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('cube', 'Cube', CubeNodeDefinition.Shape);
    this.capabilities.rounding = false;
  }

  static Shape = class extends BaseNodeComponent<CubeNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const size = props.nodeProps.custom.cube.size;
      const sizePct = size / Math.min(props.node.bounds.w, props.node.bounds.h);

      const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
      shapeBuilder.boundaryPath(boundary.all());

      const bounds = props.node.bounds;

      const lcs = new LocalCoordinateSystem(
        Box.withoutRotation(props.node.bounds),
        [0, 1],
        [0, 1],
        false
      );

      // Inner box
      const inner = new PathListBuilder().withTransform(lcs.toGlobalTransforms);
      inner.moveTo(Point.of(0, sizePct));
      inner.lineTo(Point.of(1 - sizePct, sizePct));
      inner.lineTo(Point.of(1 - sizePct, 1));
      inner.lineTo(Point.of(0, 1));
      inner.close();
      shapeBuilder.path(inner.getPaths().all());

      // Top
      const top = new PathListBuilder().withTransform(lcs.toGlobalTransforms);
      top.moveTo(Point.of(sizePct, 0));
      top.lineTo(Point.of(1, 0));
      top.lineTo(Point.of(1 - sizePct, sizePct));
      top.lineTo(Point.of(0, sizePct));
      top.close();
      shapeBuilder.path(top.getPaths().all());

      shapeBuilder.text(this, '1', props.node.getText(), props.nodeProps.text, {
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
          return `Size: ${props.node.renderProps.custom.cube.size}px`;
        }
      );
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const sizePct = def.renderProps.custom.cube.size / Math.min(def.bounds.w, def.bounds.h);

    const lcs = new LocalCoordinateSystem(Box.withoutRotation(def.bounds), [0, 1], [0, 1], false);
    const pathBuilder = new PathListBuilder().withTransform(lcs.toGlobalTransforms);

    pathBuilder.moveTo(Point.of(0, sizePct));
    pathBuilder.lineTo(Point.of(sizePct, 0));
    pathBuilder.lineTo(Point.of(1, 0));
    pathBuilder.lineTo(Point.of(1, 1 - sizePct));
    pathBuilder.lineTo(Point.of(1 - sizePct, 1));
    pathBuilder.lineTo(Point.of(0, 1));
    pathBuilder.close();

    return pathBuilder;
  }

  getCustomPropertyDefinitions(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [Size.definition(node)];
  }
}
