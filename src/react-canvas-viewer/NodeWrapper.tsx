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

  let offset = 0;
  if (props.node.props.effects?.reflection) {
    const pathBounds = props.path.bounds();
    const postY = pathBounds.y + pathBounds.h - (props.node.bounds.y + props.node.bounds.h);
    offset = pathBounds.h + postY;
  }

  return (
    <g style={{ filter: props.style?.filter }}>
      {props.node.props.effects?.reflection && (
        <g
          transform={`rotate(${180} ${center.x} ${center.y}) translate(0 -${offset})`}
          mask="url(#reflection-mask)"
          style={{
            filter: 'url(#reflection-filter)',
            pointerEvents: 'none'
          }}
        >
          {props.children}
        </g>
      )}
      {props.children}
    </g>
  );
};
