import React from 'react';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { Node } from '../Node.tsx';
import { Edge } from '../Edge.tsx';
import { Modifiers } from '../../base-ui/drag/dragDropManager.ts';
import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';
import { NodeCapability } from '../../model/elementDefinitionRegistry.ts';
import { Angle } from '../../geometry/angle.ts';
import { Box } from '../../geometry/box.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { ApplicationTriggers } from '../../react-canvas-editor/EditableCanvas.tsx';
import { isNode } from '../../model/diagramElement.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { Tool } from '../../react-canvas-editor/tools/types.ts';

export const Group = (props: Props) => {
  const center = Box.center(props.node.bounds);
  return props.node.children.map(child => (
    <g
      key={child.id}
      transform={`rotate(${-Angle.toDeg(props.node.bounds.r)} ${center.x} ${center.y})`}
    >
      {isNode(child) ? (
        <Node
          def={child}
          diagram={props.node.diagram}
          tool={props.tool}
          onDoubleClick={props.childProps.onDoubleClick}
          onMouseDown={props.childProps.onMouseDown}
          applicationTriggers={props.childProps.applicationTriggers}
        />
      ) : (
        <Edge
          def={child as DiagramEdge}
          diagram={props.node.diagram}
          tool={props.tool}
          onDoubleClick={props.childProps.onDoubleClick ?? (() => {})}
          onMouseDown={props.childProps.onMouseDown}
          applicationTriggers={props.childProps.applicationTriggers}
        />
      )}
    </g>
  ));
};

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

type Props = {
  node: DiagramNode;
  isSelected: boolean;
  isSingleSelected: boolean;
  nodeProps: NodeProps;
  tool: Tool | undefined;
  childProps: {
    onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
    onDoubleClick?: (id: string, coord: Point) => void;
    applicationTriggers: ApplicationTriggers;
  };
} & Omit<React.SVGProps<SVGRectElement>, 'onMouseDown' | 'onDoubleClick'>;
