import { BaseShapeBuildShapeProps } from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { Extent } from '@diagram-craft/geometry/extent';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import {
  UMLPackageComponent,
  UMLPackageNodeDefinition
} from '@diagram-craft/stencil-uml/package/UMLPackage.nodeType';

const DEFAULT_TEMPLATE_BOX_W = 70;
const DEFAULT_TEMPLATE_BOX_H = 24;

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlPackageTemplate?: { templateW?: number; templateH?: number };
    }
  }
}

registerCustomNodeDefaults('umlPackageTemplate', {
  templateW: DEFAULT_TEMPLATE_BOX_W,
  templateH: DEFAULT_TEMPLATE_BOX_H
});

export class UMLPackageTemplateNodeDefinition extends UMLPackageNodeDefinition {
  constructor() {
    super('umlPackageTemplate', 'UML Package Template', UMLPackageTemplateComponent);
  }
}

export class UMLPackageTemplateComponent extends UMLPackageComponent {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    super.buildShape(props, builder);

    const nodeProps = props.nodeProps;
    const bounds = props.node.bounds;
    const tabH = this.def.getTabH(props.node);

    const templateW = nodeProps.custom.umlPackageTemplate.templateW ?? DEFAULT_TEMPLATE_BOX_W;
    const templateH = nodeProps.custom.umlPackageTemplate.templateH ?? DEFAULT_TEMPLATE_BOX_H;

    // Dashed template box centered on the top-right corner of the body
    const templateX = bounds.x + bounds.w - templateW / 2;
    const templateY = bounds.y + tabH - templateH / 2;

    builder.add(
      svg.rect({
        'x': templateX,
        'y': templateY,
        'width': templateW,
        'height': templateH,
        'fill': nodeProps.fill.color,
        'stroke': nodeProps.stroke.color,
        'stroke-width': nodeProps.stroke.width,
        'stroke-dasharray': '5,3'
      })
    );

    builder.text(
      this,
      'template',
      props.node.getText('template'),
      nodeProps.text,
      { x: templateX, y: templateY, w: templateW, h: templateH, r: 0 },
      (size: Extent) =>
        UnitOfWork.execute(props.node.diagram, uow => {
          uow.metadata.nonDirty = true;
          props.node.updateCustomProps(
            'umlPackageTemplate',
            p => {
              p.templateW = size.w;
              p.templateH = size.h;
            },
            uow
          );
        })
    );
  }
}
