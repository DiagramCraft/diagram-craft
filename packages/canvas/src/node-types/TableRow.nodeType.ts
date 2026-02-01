import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../components/BaseNodeComponent';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { isNode } from '@diagram-craft/model/diagramElement';
import { NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';
import { renderChildren } from '@diagram-craft/canvas/components/renderElement';

export class TableRowNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('tableRow', 'Table Row', TableRowComponent);
    this.setFlags({
      [NodeFlags.StyleFill]: false,
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenCanConvertToContainer]: false,
      [NodeFlags.ChildrenManagedByParent]: true
    });
  }

  layoutChildren(_node: DiagramNode, _uow: UnitOfWork) {
    // Do nothing
  }

  onChildChanged(node: DiagramNode, uow: UnitOfWork) {
    // Here, we need to unconditionally delegate the onChildChanged to the parent (Table)
    // as the row itself does not have any layout or rendering logic
    const parent = node.parent;
    if (parent && isNode(parent)) {
      uow.on('before', 'commit', `onChildChanged/${parent.id}`, () => {
        const parentDef = parent.getDefinition();
        parentDef.onChildChanged(parent, uow);
      });
    }
  }
}

class TableRowComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    builder.noBoundaryNeeded();
    builder.add(renderChildren(this, props.node, props));
  }
}
