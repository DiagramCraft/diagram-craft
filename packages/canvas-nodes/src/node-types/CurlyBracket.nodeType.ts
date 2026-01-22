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
import { round } from '@diagram-craft/utils/math';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Box } from '@diagram-craft/geometry/box';
import { Anchor } from '@diagram-craft/model/anchor';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  size?: number;
};

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      curlyBracket?: ExtraProps;
    }
  }
}

registerCustomNodeDefaults('curlyBracket', { size: 50 });

// Custom properties ************************************************************

const propSize = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Size', 'custom.curlyBracket.size', {
    maxValue: 50,
    unit: '%',
    format: round,
    validate: v => v > 0 && v < 50
  });

// NodeDefinition and Shape *****************************************************

const RADIUS = 10;

export class CurlyBracketNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('curlyBracket', 'CurlyBracket', CurlyBracketNodeDefinition.Shape);
    this.capabilities.fill = false;
    this.capabilities['anchors-configurable'] = false;
  }

  static Shape = class extends BaseNodeComponent<CurlyBracketNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      super.buildShape(props, shapeBuilder);

      const sizePct = props.nodeProps.custom.curlyBracket.size / 100;

      const bounds = props.node.bounds;
      shapeBuilder.controlPoint(Box.fromOffset(bounds, _p(sizePct, 0.5)), ({ x }, uow) => {
        propSize(props.node).set((Math.max(0, x - bounds.x) / bounds.w) * 100, uow);
        return `Size: ${props.node.renderProps.custom.curlyBracket.size}%`;
      });
    }
  };

  getShapeAnchors(_node: DiagramNode): Anchor[] {
    return [{ id: '1', type: 'point', start: _p(0, 0.5) }];
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const sizePct = node.renderProps.custom.curlyBracket.size / 100;

    const rx = RADIUS / node.bounds.w;
    const ry = RADIUS / node.bounds.h;
    const bar = sizePct;

    return new PathListBuilder()
      .withTransform(fromUnitLCS(node.bounds))
      .moveTo(_p(1, 1))
      .lineTo(_p(bar + rx, 1))
      .arcTo(_p(bar, 1 - ry), rx, ry, 0, 0, 1)
      .lineTo(_p(bar, 0.5 + ry))
      .arcTo(_p(bar - rx, 0.5), rx, ry, 0)
      .lineTo(_p(0, 0.5))

      .moveTo(_p(bar - rx, 0.5))
      .arcTo(_p(bar, 0.5 - ry), rx, ry)
      .lineTo(_p(bar, ry))
      .arcTo(_p(bar + rx, 0), rx, ry, 0, 0, 1)
      .lineTo(_p(1, 0));
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [propSize(node)]);
  }
}
