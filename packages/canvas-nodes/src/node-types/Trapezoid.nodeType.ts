import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';

declare global {
  interface CustomNodeProps {
    trapezoid?: {
      slantLeft?: number;
      slantRight?: number;
    };
  }
}

registerCustomNodeDefaults('trapezoid', { slantLeft: 5, slantRight: 5 });

const slantLeftPropDef = (def: DiagramNode): CustomPropertyDefinition & { type: 'number' } => ({
  id: 'slantLeft',
  type: 'number',
  label: 'Slant (left)',
  value: def.renderProps.custom.trapezoid.slantLeft,
  maxValue: 60,
  unit: 'px',
  isSet: def.storedProps.custom?.trapezoid?.slantLeft !== undefined,
  onChange: (value: number | undefined, uow: UnitOfWork) => {
    if (value === undefined) {
      def.updateCustomProps('trapezoid', props => (props.slantLeft = undefined), uow);
    } else {
      if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;
      def.updateCustomProps('trapezoid', props => (props.slantLeft = value), uow);
    }
  }
});

const slantRightPropDef = (def: DiagramNode): CustomPropertyDefinition & { type: 'number' } => ({
  id: 'slantRight',
  type: 'number',
  label: 'Slant (right)',
  value: def.renderProps.custom.trapezoid.slantRight,
  maxValue: 60,
  unit: 'px',
  isSet: def.storedProps.custom?.trapezoid?.slantRight !== undefined,
  onChange: (value: number | undefined, uow: UnitOfWork) => {
    if (value === undefined) {
      def.updateCustomProps('trapezoid', props => (props.slantRight = undefined), uow);
    } else {
      if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;
      def.updateCustomProps('trapezoid', props => (props.slantRight = value), uow);
    }
  }
});

export class TrapezoidNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('trapezoid', 'Trapezoid', TrapezoidComponent);
  }

  getCustomPropertyDefinitions(def: DiagramNode) {
    return [slantLeftPropDef(def), slantRightPropDef(def)];
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const { slantLeft, slantRight } = node.renderProps.custom.trapezoid;

    const slantLeftPct = slantLeft / node.bounds.w;
    const slantRightPct = slantRight / node.bounds.w;

    return new PathListBuilder(unitCoordinateSystem(node.bounds))
      .moveTo(_p(slantLeftPct, 0))
      .lineTo(_p(1 - slantRightPct, 0))
      .lineTo(_p(1, 1))
      .lineTo(_p(0, 1))
      .lineTo(_p(slantLeftPct, 0));
  }
}

class TrapezoidComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    shapeBuilder.boundaryPath(
      new TrapezoidNodeDefinition().getBoundingPathBuilder(props.node).getPaths().all()
    );

    shapeBuilder.text(this);

    const { slantLeft, slantRight } = props.nodeProps.custom.trapezoid;

    shapeBuilder.controlPoint(
      _p(props.node.bounds.x + slantLeft, props.node.bounds.y),
      ({ x }, uow) => {
        const distance = Math.max(0, x - props.node.bounds.x);
        slantLeftPropDef(props.node).onChange(distance, uow);
        return `Slant: ${props.node.renderProps.custom.trapezoid.slantLeft}px`;
      }
    );

    shapeBuilder.controlPoint(
      _p(props.node.bounds.x + props.node.bounds.w - slantRight, props.node.bounds.y),
      ({ x }, uow) => {
        const distance = Math.max(0, props.node.bounds.x + props.node.bounds.w - x);
        slantRightPropDef(props.node).onChange(distance, uow);
        return `Slant: ${props.node.renderProps.custom.trapezoid.slantRight}px`;
      }
    );
  }
}
