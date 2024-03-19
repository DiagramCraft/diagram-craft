import React from 'react';
import { DiagramNode } from '../model/diagramNode.ts';
import { Box } from '../geometry/box.ts';
import { Path } from '../geometry/path.ts';
import { Angle } from '../geometry/angle.ts';

export const NodeWrapper = (
  props: {
    children: React.ReactNode;
    node: DiagramNode;
    path: Path;
  } & Omit<React.SVGProps<SVGPathElement>, 'path'>
) => {
  const center = Box.center(props.node.bounds);

  let pathBounds: Box | undefined = undefined;
  if (props.node.props.effects?.reflection) {
    const path = props.node.diagram.nodeDefinitions
      .get(props.node.nodeType)
      .getBoundingPath(props.node);

    pathBounds = path.bounds();
  }

  return (
    <>
      <g style={{ filter: props.style?.filter }}>
        <linearGradient
          id={`reflection-grad-${props.node.id}`}
          y2="1"
          x2="0"
          gradientUnits="objectBoundingBox"
          gradientTransform={`rotate(${-Angle.toDeg(props.node.bounds.r)} 0.5 0.5)`}
        >
          <stop offset="0.65" stopColor="white" stopOpacity="0" />
          <stop
            offset="1"
            stopColor="white"
            stopOpacity={props.node.props.effects?.reflectionStrength}
          />
        </linearGradient>

        <mask id={`reflection-mask-${props.node.id}`} maskContentUnits="objectBoundingBox">
          <rect width="1" height="1" fill={`url(#reflection-grad-${props.node.id})`} />
        </mask>

        {props.node.props.effects?.reflection && (
          <g
            transform={`
            rotate(${-Angle.toDeg(props.node.bounds.r)} ${center.x} ${center.y})
            scale(1 -1)
            translate(0 -${2 * (pathBounds!.y + pathBounds!.h)})
            rotate(${Angle.toDeg(props.node.bounds.r)} ${center.x} ${center.y})
          `}
            mask={`url(#reflection-mask-${props.node.id})`}
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
    </>
  );
};
