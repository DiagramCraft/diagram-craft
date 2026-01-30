import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  CustomProperty,
  CustomPropertyDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
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
    interface CustomNodePropsExtensions {
      cube?: ExtraProps;
    }
  }
}

registerCustomNodeDefaults('cube', { size: 10 });

// Custom properties ************************************************************

const propSize = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Size', 'custom.cube.size', {
    maxValue: 50,
    unit: 'px',
    format: round,
    validate: v => v > 0 && v < 50
  });

// NodeDefinition and Shape *****************************************************

export class CubeNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('cube', 'Cube', CubeNodeDefinition.Shape);
    this.capabilities['style.rounding'] = false;
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
          propSize(props.node).set(Math.max(0, bounds.x + bounds.w - x), uow);
          return `Size: ${props.node.renderProps.custom.cube.size}px`;
        }
      );
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const sizePct = def.renderProps.custom.cube.size / Math.min(def.bounds.w, def.bounds.h);

    const lcs = new LocalCoordinateSystem(Box.withoutRotation(def.bounds), [0, 1], [0, 1], false);
    return new PathListBuilder()
      .withTransform(lcs.toGlobalTransforms)
      .moveTo(0, sizePct)
      .lineTo(sizePct, 0)
      .lineTo(1, 0)
      .lineTo(1, 1 - sizePct)
      .lineTo(1 - sizePct, 1)
      .lineTo(0, 1)
      .close();
  }

  getCustomPropertyDefinitions(node: DiagramNode): CustomPropertyDefinition {
    return new CustomPropertyDefinition(() => [propSize(node)]);
  }
}
