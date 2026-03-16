import { LayoutCapableShapeNodeDefinition } from '@diagram-craft/canvas/shape/layoutCapableShapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { renderChildren } from '@diagram-craft/canvas/components/renderElement';
import { Anchor } from '@diagram-craft/model/anchor';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { _p } from '@diagram-craft/geometry/point';

export class UMLPortNodeDefinition extends LayoutCapableShapeNodeDefinition {
  constructor() {
    super('umlPort', 'UML Port', UMLPortComponent);

    this.setFlags({
      [NodeFlags.StyleFill]: true,
      [NodeFlags.StyleRounding]: false,
      [NodeFlags.AnchorsBoundary]: false,
      [NodeFlags.AnchorsConfigurable]: false,
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenTransformScaleX]: false,
      [NodeFlags.ChildrenTransformScaleY]: false,
      [NodeFlags.ChildrenSelectParent]: false
    });
  }

  getShapeAnchors(_node: DiagramNode): Anchor[] {
    return [{ id: 'c', start: _p(0.5, 0.5), clip: true, type: 'center' }];
  }

  getCustomPropertyDefinitions(_def: DiagramNode): CustomPropertyDefinition {
    return new CustomPropertyDefinition(_ => []);
  }
}

export class UMLPortComponent extends BaseNodeComponent<UMLPortNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    builder.boundaryPath(boundary.all());

    if (this.def.shouldRenderChildren(props.node)) {
      builder.add(renderChildren(this, props.node, props));
    }
  }
}
