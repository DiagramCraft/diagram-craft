import { LayoutCapableShapeNodeDefinition } from '@diagram-craft/canvas/shape/layoutCapableShapeNodeDefinition';
import { CustomPropertyDefinition, NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { renderChildren } from '@diagram-craft/canvas/components/renderElement';

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

  getCustomPropertyDefinitions(_def: DiagramNode): CustomPropertyDefinition {
    return new CustomPropertyDefinition(_ => []);
  }
}

export class UMLRectComponent extends BaseNodeComponent<UMLRectNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    builder.boundaryPath(boundary.all());

    builder.text(this, '1', props.node.getText(), props.nodeProps.text, props.node.bounds);

    if (this.def.shouldRenderChildren(props.node)) {
      builder.add(renderChildren(this, props.node, props));
    }
  }
}
