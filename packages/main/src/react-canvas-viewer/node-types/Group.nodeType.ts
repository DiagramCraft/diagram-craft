import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';
import { NodeCapability } from '../../model/elementDefinitionRegistry.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { Box } from '../../geometry/box.ts';
import { BaseShape, BaseShapeBuildProps, ShapeBuilder } from '../temp/baseShape.temp.ts';
import { isNode } from '../../model/diagramElement.ts';
import * as svg from '../../base-ui/vdom-svg.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';

export class GroupNodeDefinition extends AbstractReactNodeDefinition {
  constructor() {
    super('group', 'Group');
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

export class GroupComponent extends BaseShape {
  build(props: BaseShapeBuildProps, builder: ShapeBuilder) {
    const center = Box.center(props.node.bounds);
    builder.add(
      svg.g(
        { class: '__debug_node_group' },
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
