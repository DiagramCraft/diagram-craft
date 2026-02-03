import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder, fromUnitLCS } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Anchor } from '@diagram-craft/model/anchor';
import {
  CustomProperty,
  CustomPropertyDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Box } from '@diagram-craft/geometry/box';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  doubleBorder?: boolean;
  doubleBorderGap?: number;
};

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      circle?: ExtraProps;
    }
  }
}

registerCustomNodeDefaults('circle', {
  doubleBorder: false,
  doubleBorderGap: 5
});

// Custom properties ************************************************************

const propDoubleBorder = (node: DiagramNode) =>
  CustomProperty.node.boolean(node, 'Double Border', 'custom.circle.doubleBorder');

const propDoubleBorderGap = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Double Border Gap', 'custom.circle.doubleBorderGap', {
    minValue: 1,
    maxValue: 50,
    unit: 'px'
  });

// NodeDefinition and Shape *****************************************************

export class CircleNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('circle', 'Circle', CircleComponent);
  }

  getShapeAnchors(_def: DiagramNode): Anchor[] {
    return [
      { start: _p(0.5, 0), id: '1', type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      { start: _p(1, 0.5), id: '2', type: 'point', isPrimary: true, normal: 0 },
      { start: _p(0.5, 1), id: '3', type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { start: _p(0, 0.5), id: '4', type: 'point', isPrimary: true, normal: Math.PI },
      { start: _p(0.5, 0.5), clip: true, id: 'c', type: 'center' }
    ];
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const b = new PathListBuilder().withTransform(fromUnitLCS(def.bounds));
    b.moveTo(_p(0.5, 0));
    b.arcTo(_p(1, 0.5), 0.5, 0.5, 0, 0, 1);
    b.arcTo(_p(0.5, 1), 0.5, 0.5, 0, 0, 1);
    b.arcTo(_p(0, 0.5), 0.5, 0.5, 0, 0, 1);
    b.arcTo(_p(0.5, 0), 0.5, 0.5, 0, 0, 1);
    return b;
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [propDoubleBorder(node), propDoubleBorderGap(node)]);
  }
}

class CircleComponent extends BaseNodeComponent<CircleNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary.all());

    const doubleBorder = props.nodeProps.custom.circle.doubleBorder;
    if (doubleBorder) {
      const gap = props.nodeProps.custom.circle.doubleBorderGap;
      const innerBounds = Box.grow(props.node.bounds, -gap);
      const cx = innerBounds.x + innerBounds.w / 2;
      const cy = innerBounds.y + innerBounds.h / 2;
      const rx = innerBounds.w / 2;
      const ry = innerBounds.h / 2;

      const innerCircle = new PathListBuilder()
        .moveTo({ x: cx + rx, y: cy })
        .arcTo({ x: cx - rx, y: cy }, rx, ry, 0, 0, 0)
        .arcTo({ x: cx + rx, y: cy }, rx, ry, 0, 0, 0)
        .close();

      shapeBuilder.path(innerCircle.getPaths().all(), undefined, {
        style: { fill: 'none' }
      });
    }

    shapeBuilder.text(this);
  }
}
