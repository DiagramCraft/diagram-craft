import React from 'react';
import { propsUtils } from '../utils/propsUtils.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';

declare global {
  interface NodeProps {
    genericPath?: {
      path: string;
    };
  }
}

export const GenericPath = (props: Props) => {
  const path = new GenericPathNodeDefinition().getBoundingPathBuilder(props.node).getPath();
  const svgPath = path.asSvgPath();

  return (
    <>
      <path
        d={svgPath}
        x={props.node.bounds.x}
        y={props.node.bounds.y}
        width={props.node.bounds.w}
        height={props.node.bounds.h}
        {...propsUtils.filterSvgProperties(props)}
      />
    </>
  );
};

export class GenericPathNodeDefinition extends AbstractReactNodeDefinition {
  constructor(name = 'generic-path', displayName = 'Path') {
    super(name, displayName);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    return PathBuilder.fromString(
      def.props.genericPath?.path ?? 'M -1 1, L 1 1, L 1 -1, L -1 -1, L -1 1',
      unitCoordinateSystem(def.bounds)
    );
  }
}

type Props = {
  node: DiagramNode;
  isSelected: boolean;
  isSingleSelected: boolean;
  nodeProps: NodeProps;
} & React.SVGProps<SVGRectElement>;
