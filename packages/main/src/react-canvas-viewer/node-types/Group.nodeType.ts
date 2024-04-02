import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';
import { NodeCapability } from '../../model/elementDefinitionRegistry.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { Box } from '../../geometry/box.ts';
import { BaseShape, BaseShapeProps } from '../temp/baseShape.temp.ts';
import { s, VNode } from '../../base-ui/vdom.ts';
import { isNode } from '../../model/diagramElement.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { EdgeComponent } from '../EdgeComponent.temp.ts';

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

const rotateBack = (center: Point, angle: number, child: VNode) => {
  return s(
    'g',
    {
      attrs: {
        transform: `rotate(${-angle} ${center.x} ${center.y})`
      }
    },
    child
  );
};

// TODO: Implement
// @ts-ignore
const node = (child: DiagramNode, props: BaseShapeProps): VNode => {};

const edge = (child: DiagramEdge, props: BaseShapeProps): VNode => {
  const ec = new EdgeComponent();
  return ec.render({
    def: child,
    diagram: child.diagram,
    tool: props.tool,
    onDoubleClick: props.childProps.onDoubleClick ?? (() => {}),
    onMouseDown: props.childProps.onMouseDown,
    applicationTriggers: props.childProps.applicationTriggers,
    actionMap: props.actionMap
  });
};

export class GroupComponent extends BaseShape {
  render(props: BaseShapeProps): VNode {
    const center = Box.center(props.node.bounds);
    return s(
      'g',
      {},
      ...props.node.children.map(child =>
        rotateBack(
          center,
          props.node.bounds.r,
          isNode(child) ? node(child, props) : edge(child as DiagramEdge, props)
        )
      )
    );
  }
}
