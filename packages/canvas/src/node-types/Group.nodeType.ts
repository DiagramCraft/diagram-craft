import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { BaseShape, BaseShapeBuildProps } from '../shape/BaseShape';
import * as svg from '../component/vdom-svg';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { NodeCapability } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { isNode } from '@diagram-craft/model/diagramElement';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { Transforms } from '../component/vdom-svg';

export class GroupNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('group', 'Group', () => new GroupComponent(this));
  }

  supports(capability: NodeCapability): boolean {
    return ['children'].includes(capability);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
    pathBuilder.moveTo(Point.of(-1, 1));
    pathBuilder.lineTo(Point.of(1, 1));
    pathBuilder.lineTo(Point.of(1, -1));
    pathBuilder.lineTo(Point.of(-1, -1));
    pathBuilder.lineTo(Point.of(-1, 1));

    return pathBuilder;
  }

  onChildChanged(node: DiagramNode, uow: UnitOfWork) {
    const childrenBounds = node.children.map(c => c.bounds);
    if (childrenBounds.length === 0) return;
    const newBounds = Box.boundingBox(childrenBounds);
    node.setBounds(newBounds, uow);

    if (node.parent) {
      const parentDef = node.parent.getDefinition();
      parentDef.onChildChanged(node.parent, uow);
    }
  }
}

class GroupComponent extends BaseShape {
  buildShape(props: BaseShapeBuildProps, builder: ShapeBuilder) {
    builder.add(
      svg.g(
        {},
        ...props.node.children.map(child =>
          svg.g(
            {
              transform: Transforms.rotateBack(props.node.bounds)
            },
            isNode(child) ? this.makeNode(child, props) : this.makeEdge(child as DiagramEdge, props)
          )
        )
      )
    );
  }
}
