import React from 'react';
import { propsUtils } from '../utils/propsUtils.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';
import { Tool } from '../../react-canvas-editor/tools/types.ts';
import { CubicSegment, LineSegment } from '../../geometry/pathSegment.ts';
import { VerifyNotReached } from '../../utils/assert.ts';

declare global {
  interface NodeProps {
    genericPath?: {
      path: string;
    };
  }
}

export const GenericPath = (props: Props) => {
  const pathBuilder = new GenericPathNodeDefinition().getBoundingPathBuilder(props.node);
  const path = pathBuilder.getPath();
  const svgPath = path.asSvgPath();

  const normalizedSegments = path.segments.map(s => {
    if (s instanceof CubicSegment) {
      return s;
    } else if (s instanceof LineSegment) {
      return CubicSegment.fromLine(s);
    } else {
      throw new VerifyNotReached();
    }
  });

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

      {props.isSingleSelected && props.tool?.type === 'node' && (
        <>
          <circle
            cx={path.segments[0].start.x}
            cy={path.segments[0].start.y}
            fill={'red'}
            r={4}
            onMouseDown={e => {
              if (e.button !== 0) return;
              console.log('click');
              e.stopPropagation();
            }}
          />

          {normalizedSegments.slice(1).map((s, i) => (
            <circle
              key={i}
              cx={s.start.x}
              cy={s.start.y}
              fill={'green'}
              r={4}
              onMouseDown={e => {
                if (e.button !== 0) return;
                e.stopPropagation();
              }}
            />
          ))}
        </>
      )}
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
  tool: Tool | undefined;
  isSelected: boolean;
  isSingleSelected: boolean;
  nodeProps: NodeProps;
} & React.SVGProps<SVGRectElement>;
