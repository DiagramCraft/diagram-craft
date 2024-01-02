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

export const Group = (props: Props) => {
  const center = Box.center(props.node.bounds);
  return props.node.children.map(child => (
    <g transform={`rotate(${-Angle.toDeg(props.node.bounds.rotation)} ${center.x} ${center.y})`}>
      {child.type === 'node' ? (
        <Node
          key={child.id}
          def={child}
          diagram={props.node.diagram}
          onDoubleClick={props.childProps.onDoubleClick}
          onMouseDown={props.childProps.onMouseDown}
          onMouseLeave={props.childProps.onMouseLeave}
          onMouseEnter={props.childProps.onMouseEnter}
        />
      ) : (
        <Edge
          key={child.id}
          def={child}
          diagram={props.node.diagram}
          onDoubleClick={props.childProps.onDoubleClick ?? (() => {})}
          onMouseDown={props.childProps.onMouseDown}
          onMouseLeave={props.childProps.onMouseLeave}
          onMouseEnter={props.childProps.onMouseEnter}
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
}

type Props = {
  node: DiagramNode;
  isSelected: boolean;
  isSingleSelected: boolean;
  nodeProps: NodeProps;
  childProps: {
    onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
    onMouseEnter: (id: string) => void;
    onMouseLeave: (id: string) => void;
    onDoubleClick?: (id: string, coord: Point) => void;
  };
} & Omit<
  React.SVGProps<SVGRectElement>,
  'onMouseEnter' | 'onMouseDown' | 'onMouseLeave' | 'onDoubleClick'
>;
