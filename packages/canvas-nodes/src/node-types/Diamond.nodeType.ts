import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
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
      diamond?: ExtraProps;
    }
  }
}

registerCustomNodeDefaults('diamond', {
  doubleBorder: false,
  doubleBorderGap: 5
});

// Custom properties ************************************************************

const propDoubleBorder = (node: DiagramNode) =>
  CustomProperty.node.boolean(node, 'Double Border', 'custom.diamond.doubleBorder');

const propDoubleBorderGap = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Double Border Gap', 'custom.diamond.doubleBorderGap', {
    minValue: 1,
    maxValue: 50,
    unit: 'px'
  });

// NodeDefinition and Shape *****************************************************

export class DiamondNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('diamond', 'Diamond', DiamondComponent);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    return new PathListBuilder()
      .withTransform(fromUnitLCS(def.bounds))
      .moveTo(_p(0.5, 0))
      .lineTo(_p(1, 0.5))
      .lineTo(_p(0.5, 1))
      .lineTo(_p(0, 0.5))
      .lineTo(_p(0.5, 0));
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [propDoubleBorder(node), propDoubleBorderGap(node)]);
  }
}

class DiamondComponent extends BaseNodeComponent<DiamondNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary.all());

    const doubleBorder = props.nodeProps.custom.diamond.doubleBorder;
    if (doubleBorder) {
      const gap = props.nodeProps.custom.diamond.doubleBorderGap;
      const bounds = props.node.bounds;
      const w = bounds.w;
      const h = bounds.h;

      // For a diamond, the perpendicular distance from center to edge is:
      // d = (w * h) / (2 * sqrt(w^2 + h^2))
      // To offset inward by gap, we scale the diamond by factor: (d - gap) / d
      const d = (w * h) / (2 * Math.sqrt(w * w + h * h));
      const scale = Math.max(0, (d - gap) / d);

      const innerW = w * scale;
      const innerH = h * scale;
      const cx = bounds.x + w / 2;
      const cy = bounds.y + h / 2;

      const innerBounds = {
        x: cx - innerW / 2,
        y: cy - innerH / 2,
        w: innerW,
        h: innerH,
        r: bounds.r
      };

      const innerDiamond = new PathListBuilder()
        .withTransform(fromUnitLCS(innerBounds))
        .moveTo(_p(0.5, 0))
        .lineTo(_p(1, 0.5))
        .lineTo(_p(0.5, 1))
        .lineTo(_p(0, 0.5))
        .lineTo(_p(0.5, 0))
        .close();

      shapeBuilder.path(innerDiamond.getPaths().all(), undefined, {
        style: { fill: 'none' }
      });
    }

    shapeBuilder.text(this);
  }
}
