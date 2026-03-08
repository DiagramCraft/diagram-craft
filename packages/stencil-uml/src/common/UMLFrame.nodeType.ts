import { LayoutCapableShapeNodeDefinition } from '@diagram-craft/canvas/shape/layoutCapableShapeNodeDefinition';
import {
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { renderChildren } from '@diagram-craft/canvas/components/renderElement';
import { Extent } from '@diagram-craft/geometry/extent';
import { _p } from '@diagram-craft/geometry/point';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { round } from '@diagram-craft/utils/math';

const DEFAULT_LABEL_H = 20;
const DEFAULT_LABEL_W = 80;
const MAX_LABEL_W_FRACTION = 0.8;
const MIN_LABEL_W = 20;
const LABEL_CUT = 8;

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlFrame?: {
        labelH?: number;
        labelW?: number;
      };
    }
  }
}

registerCustomNodeDefaults('umlFrame', {
  labelH: DEFAULT_LABEL_H,
  labelW: DEFAULT_LABEL_W
});

export class UMLFrameNodeDefinition extends LayoutCapableShapeNodeDefinition {
  constructor() {
    super('umlFrame', 'UML Frame', UMLFrameComponent);

    this.setFlags({
      [NodeFlags.StyleFill]: true,
      [NodeFlags.StyleRounding]: false,
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenTransformScaleX]: false,
      [NodeFlags.ChildrenTransformScaleY]: false,
      [NodeFlags.ChildrenSelectParent]: false
    });
  }

  getCustomPropertyDefinitions(_def: DiagramNode): CustomPropertyDefinition {
    return new CustomPropertyDefinition(_ => []);
  }
}

export class UMLFrameComponent extends BaseNodeComponent<UMLFrameNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const nodeProps = props.nodeProps;
    const bounds = props.node.bounds;

    const labelH = props.nodeProps.custom.umlFrame.labelH ?? DEFAULT_LABEL_H;
    const labelW = props.nodeProps.custom.umlFrame.labelW ?? DEFAULT_LABEL_W;
    const maxLabelW = bounds.w * MAX_LABEL_W_FRACTION;
    const cut = LABEL_CUT;

    // Invisible boundary path for hit testing / selection
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    builder.boundaryPath(boundary.all());

    // Label box inner border: right edge → diagonal cut → bottom edge
    // The top and left edges are shared with the outer rectangle border
    builder.add(
      svg.path({
        'd': [
          `M ${bounds.x + labelW} ${bounds.y}`,
          `L ${bounds.x + labelW} ${bounds.y + labelH - cut}`,
          `L ${bounds.x + labelW - cut} ${bounds.y + labelH}`,
          `L ${bounds.x} ${bounds.y + labelH}`
        ].join(' '),
        'fill': 'none',
        'stroke': nodeProps.stroke.color,
        'stroke-width': nodeProps.stroke.width
      })
    );

    // Label text inside the pentagon
    builder.text(
      this,
      '1',
      props.node.getText(),
      nodeProps.text,
      { x: bounds.x, y: bounds.y, w: labelW, h: labelH, r: 0 },
      (size: Extent) =>
        UnitOfWork.execute(props.node.diagram, uow => {
          uow.metadata.nonDirty = true;
          props.node.updateCustomProps('umlFrame', p => (p.labelH = size.h), uow);
        })
    );

    // Control point on the top edge to drag-adjust the label width
    builder.controlPoint(_p(bounds.x + labelW, bounds.y), (p, uow) => {
      const newLabelW = Math.max(MIN_LABEL_W, Math.min(p.x - bounds.x, maxLabelW));
      props.node.updateCustomProps('umlFrame', cp => (cp.labelW = newLabelW), uow);
      return `Label width: ${round(props.node.renderProps.custom.umlFrame.labelW ?? DEFAULT_LABEL_W)}px`;
    });

    // Render children
    if (this.def.shouldRenderChildren(props.node)) {
      builder.add(renderChildren(this, props.node, props));
    }
  }
}
