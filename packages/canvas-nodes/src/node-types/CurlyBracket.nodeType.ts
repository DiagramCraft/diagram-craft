import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { round } from '@diagram-craft/utils/math';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Box } from '@diagram-craft/geometry/box';
import { Anchor } from '@diagram-craft/model/anchor';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  size?: number;
};

declare global {
  interface CustomNodeProps {
    curlyBracket?: ExtraProps;
  }
}

registerCustomNodeDefaults('curlyBracket', { size: 50 });

// Custom properties ************************************************************

const Size = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'size',
    label: 'Size',
    type: 'number',
    value: node.renderProps.custom.curlyBracket.size,
    maxValue: 50,
    unit: '%',
    isSet: node.editProps.custom?.curlyBracket?.size !== undefined,
    onChange: (value: number | undefined, uow: UnitOfWork) => Size.set(value, node, uow)
  }),

  set: (value: number | undefined, node: DiagramNode, uow: UnitOfWork) => {
    if (value === undefined) {
      node.updateCustomProps('curlyBracket', props => (props.size = undefined), uow);
    } else {
      if (value >= 50 || value <= 0) return;
      node.updateCustomProps('curlyBracket', props => (props.size = round(value)), uow);
    }
  }
};

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
        const distance = Math.max(0, x - bounds.x);
        Size.set((distance / bounds.w) * 100, props.node, uow);
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

    return new PathBuilder(unitCoordinateSystem(node.bounds))
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

  getCustomPropertyDefinitions(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [Size.definition(node)];
  }
}
