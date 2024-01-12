import React from 'react';
import { DiagramNode } from '../model/diagramNode.ts';
import { Box } from '../geometry/box.ts';
import { Path } from '../geometry/path.ts';

export const NodeWrapper = (
  props: {
    children: React.ReactNode;
    node: DiagramNode;
    path: Path;
  } & Omit<React.SVGProps<SVGPathElement>, 'path'>
) => {
  const center = Box.center(props.node.bounds);
  return (
    <g style={{ filter: props.style?.filter }}>
      {props.children}
      {props.node.props.effects?.reflection && (
        <g
          transform={`rotate(180 ${center.x} ${center.y}) translate(0 -${props.node.bounds.h})`}
          mask="url(#reflection-mask)"
          style={{ filter: 'url(#reflection-filter)', pointerEvents: 'none' }}
        >
          {props.children}
        </g>
      )}
    </g>
  );
};
