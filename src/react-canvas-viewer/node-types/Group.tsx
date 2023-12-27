import React from 'react';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';

export const Group = (_props: Props) => {
  return null;
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
} & React.SVGProps<SVGRectElement>;
