import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../components/BaseNodeComponent';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { Box } from '@diagram-craft/geometry/box';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { isNode } from '@diagram-craft/model/diagramElement';
import { renderChildren } from '../components/renderElement';
import { NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';

export class GroupNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('group', 'Group', GroupComponent);
    this.setFlags({
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenSelectParent]: true
    });
  }

  onChildChanged(node: DiagramNode, uow: UnitOfWork) {
    const childrenBounds = node.children.map(c => c.bounds);
    if (childrenBounds.length === 0) return;
    const newBounds = Box.boundingBox(childrenBounds);
    node.setBounds(newBounds, uow);

    if (node.parent && isNode(node.parent)) {
      const parentDef = node.parent.getDefinition();
      parentDef.onChildChanged(node.parent, uow);
    }
  }
}

class GroupComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    builder.add(renderChildren(this, props.node, props));
  }
}
