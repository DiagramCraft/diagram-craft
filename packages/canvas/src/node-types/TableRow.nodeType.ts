import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../components/BaseNodeComponent';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';

export class TableRowNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('tableRow', 'Table Row', TableRowComponent);
    this.capabilities.fill = false;
    this.capabilities.select = false;
    this.capabilities.children = true;
  }

  layoutChildren(_node: DiagramNode, _uow: UnitOfWork) {
    // Do nothing
  }

  onChildChanged(node: DiagramNode, uow: UnitOfWork) {
    // Here, we need to unconditionally delegate the onChildChanged to the parent (Table)
    // as the row itself does not have any layout or rendering logic
    if (node.parent) {
      uow.registerOnCommitCallback('onChildChanged', node.parent, () => {
        const parentDef = node.parent!.getDefinition();
        parentDef.onChildChanged(node.parent!, uow);
      });
    }
  }
}

class TableRowComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    builder.noBoundaryNeeded();
    props.node.children.forEach(child => {
      builder.add(
        svg.g(
          { transform: Transforms.rotateBack(props.node.bounds) },
          this.makeElement(child, props)
        )
      );
    });
  }
}
