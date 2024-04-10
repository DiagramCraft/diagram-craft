import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { NodeCapability } from '@diagram-craft/model';
import { DiagramNode } from '@diagram-craft/model';
import { UnitOfWork } from '@diagram-craft/model';
import { BaseShape, BaseShapeBuildProps } from '../shape/BaseShape';
import { isNode } from '@diagram-craft/model';
import * as svg from '../component/vdom-svg';
import { DiagramEdge } from '@diagram-craft/model';
import { Box, PathBuilder, Point, unitCoordinateSystem } from '@diagram-craft/geometry';
import { ShapeBuilder } from '../shape/ShapeBuilder';

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
    const center = Box.center(props.node.bounds);
    builder.add(
      svg.g(
        {},
        ...props.node.children.map(child =>
          this.rotateBack(
            center,
            props.node.bounds.r,
            isNode(child) ? this.makeNode(child, props) : this.makeEdge(child as DiagramEdge, props)
          )
        )
      )
    );
  }
}
