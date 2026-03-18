import { LayoutCapableShapeNodeDefinition } from '@diagram-craft/canvas/shape/layoutCapableShapeNodeDefinition';
import { CustomPropertyDefinition, NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { renderChildren } from '@diagram-craft/canvas/components/renderElement';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { CanvasDomHelper } from '@diagram-craft/canvas/utils/canvasDomHelper';
import { resolveCssColor } from '@diagram-craft/utils/dom';
import {
  getStereotypeIconTextProps,
  renderStereotypeIcon,
  UML_STEREOTYPE_ICON_OPTIONS,
  UmlStereotypeIcon
} from '@diagram-craft/stencil-uml/common/stereotypeIcon';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlRect?: {
        stereotypeIcon?: UmlStereotypeIcon;
        icon?: string;
      };
    }
  }
}

registerCustomNodeDefaults('umlRect', {
  stereotypeIcon: 'empty',
  icon: ''
});

export class UMLRectNodeDefinition extends LayoutCapableShapeNodeDefinition {
  constructor() {
    super('umlRect', 'UML Rect', UMLRectComponent);

    this.setFlags({
      [NodeFlags.StyleFill]: true,
      [NodeFlags.StyleRounding]: true,
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenTransformScaleX]: false,
      [NodeFlags.ChildrenTransformScaleY]: false,
      [NodeFlags.ChildrenSelectParent]: false
    });
  }

  getCustomPropertyDefinitions(def: DiagramNode): CustomPropertyDefinition {
    return new CustomPropertyDefinition(p => [
      p.select(def, 'Stereotype Icon', 'custom.umlRect.stereotypeIcon', UML_STEREOTYPE_ICON_OPTIONS),
      p.icon(def, 'Custom Icon', 'custom.umlRect.icon')
    ]);
  }
}

export class UMLRectComponent extends BaseNodeComponent<UMLRectNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    builder.boundaryPath(boundary.all());

    const stereotypeIcon = props.nodeProps.custom.umlRect.stereotypeIcon ?? 'empty';
    const customIcon = props.nodeProps.custom.umlRect.icon ?? '';
    const diagramElement = CanvasDomHelper.diagramElement(props.node.diagram);
    const icon = renderStereotypeIcon(props.node.bounds, stereotypeIcon, props.nodeProps, 0, {
      customIcon,
      resolvedColor: resolveCssColor(props.nodeProps.stroke.color, [diagramElement, document.body])
    });
    if (icon) {
      builder.add(icon);
    }

    builder.text(
      this,
      '1',
      props.node.getText(),
      getStereotypeIconTextProps(props.nodeProps.text, stereotypeIcon),
      props.node.bounds
    );

    if (this.def.shouldRenderChildren(props.node)) {
      builder.add(renderChildren(this, props.node, props));
    }
  }
}
