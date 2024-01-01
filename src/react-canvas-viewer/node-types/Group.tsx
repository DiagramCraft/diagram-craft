import React from 'react';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { Node } from '../Node.tsx';
import { Edge } from '../Edge.tsx';
import { Modifiers } from '../../base-ui/drag/dragDropManager.ts';

export const Group = (props: Props) => {
  return props.node.children.map(child =>
    child.type === 'node' ? (
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
    )
  );
};

Group.getBoundingPath = (def: DiagramNode) => {
  const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
  pathBuilder.moveTo(Point.of(-1, 1));
  pathBuilder.lineTo(Point.of(1, 1));
  pathBuilder.lineTo(Point.of(1, -1));
  pathBuilder.lineTo(Point.of(-1, -1));
  pathBuilder.lineTo(Point.of(-1, 1));

  return pathBuilder;
};

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
