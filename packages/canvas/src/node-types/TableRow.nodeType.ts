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
