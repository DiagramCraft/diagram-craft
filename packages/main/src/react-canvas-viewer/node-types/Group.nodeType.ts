import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';
import { NodeCapability } from '../../model/elementDefinitionRegistry.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { Box } from '../../geometry/box.ts';

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
