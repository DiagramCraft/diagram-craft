import { BaseShapeBuildShapeProps } from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import {
  UMLClassComponent,
  UMLClassNodeDefinition
} from '@diagram-craft/stencil-uml/class/UMLClass.nodeType';

const TEMPLATE_BOX_W = 70;
const TEMPLATE_BOX_H = 24;

export class UMLClassTemplateNodeDefinition extends UMLClassNodeDefinition {
  constructor() {
    super('umlClassTemplate', 'UML Class Template', UMLClassTemplateComponent);
  }
}

export class UMLClassTemplateComponent extends UMLClassComponent {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    super.buildShape(props, builder);

    const nodeProps = props.nodeProps;
    const bounds = props.node.bounds;

    // Template binding box: dashed rectangle at top-right corner, overlapping the class border
    const templateX = bounds.x + bounds.w - TEMPLATE_BOX_W / 2;
    const templateY = bounds.y - TEMPLATE_BOX_H / 2;

    builder.add(
      svg.rect({
        'x': templateX,
        'y': templateY,
        'width': TEMPLATE_BOX_W,
        'height': TEMPLATE_BOX_H,
        'fill': nodeProps.fill.color,
        'stroke': nodeProps.stroke.color,
        'stroke-width': nodeProps.stroke.width,
        'stroke-dasharray':
          'calc(5 * var(--stroke-dash-zoom, 1)), calc(3 * var(--stroke-dash-zoom, 1))'
      })
    );

    builder.text(this, 'template', props.node.getText('template'), nodeProps.text, {
      x: templateX,
      y: templateY,
      w: TEMPLATE_BOX_W,
      h: TEMPLATE_BOX_H,
      r: 0
    });
  }
}
