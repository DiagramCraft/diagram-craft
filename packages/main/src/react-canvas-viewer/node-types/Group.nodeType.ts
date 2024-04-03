import { AbstractReactNodeDefinition, ReactNodeDefinition } from '../reactNodeDefinition.ts';
import { NodeCapability } from '../../model/elementDefinitionRegistry.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { Box } from '../../geometry/box.ts';
import {
  BaseShape,
  BaseShapeBuildProps,
  BaseShapeProps,
  ShapeBuilder
} from '../temp/baseShape.temp.ts';
import { VNode } from '../../base-ui/vdom.ts';
import { isNode } from '../../model/diagramElement.ts';
import { EdgeComponent } from '../EdgeComponent.temp.ts';
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

const rotateBack = (center: Point, angle: number, child: VNode) => {
  return svg.g(
    { class: '__debug_rotate_back', transform: `rotate(${-angle} ${center.x} ${center.y})` },
    child
  );
};

export class GroupComponent extends BaseShape {
  build(props: BaseShapeBuildProps, builder: ShapeBuilder) {
    const center = Box.center(props.node.bounds);
    builder.add(
      svg.g(
        { class: '__debug_node_group' },
        ...props.node.children.map(child =>
          rotateBack(
            center,
            props.node.bounds.r,
            isNode(child) ? this.makeNode(child, props) : this.makeEdge(child as DiagramEdge, props)
          )
        )
      )
    );
  }

  private makeEdge(child: DiagramEdge, props: BaseShapeBuildProps) {
    // TODO: Better id
    return this.subComponent('edge', () => new EdgeComponent(), {
      def: child,
      diagram: child.diagram,
      tool: props.tool,
      onDoubleClick: props.childProps.onDoubleClick ?? (() => {}),
      onMouseDown: props.childProps.onMouseDown,
      applicationTriggers: props.childProps.applicationTriggers,
      actionMap: props.actionMap
    });
  }

  private makeNode(child: DiagramNode, props: BaseShapeBuildProps) {
    const nodeProps: BaseShapeProps = {
      def: child as DiagramNode,
      applicationTriggers: props.childProps.applicationTriggers,
      diagram: child.diagram,
      tool: props.tool,
      onMouseDown: props.childProps.onMouseDown,
      onDoubleClick: props.childProps.onDoubleClick ?? (() => {}),
      actionMap: props.actionMap
    };

    // TODO: Better id
    return this.subComponent(
      'node',
      (props.node.diagram.nodeDefinitions.get(child.nodeType) as ReactNodeDefinition).component!,
      nodeProps
    );
  }
}
