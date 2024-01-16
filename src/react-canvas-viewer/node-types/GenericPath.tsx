import React, { useState } from 'react';
import { propsUtils } from '../utils/propsUtils.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';
import { Tool } from '../../react-canvas-editor/tools/types.ts';
import { useDragDrop } from '../DragDropManager.ts';
import { EventHelper } from '../../base-ui/eventHelper.ts';
import {
  EditablePath,
  EditableWaypointType
} from '../../react-canvas-editor/tools/node/editablePath.ts';
import { ControlPointDrag } from '../../react-canvas-editor/tools/node/controlPointDrag.ts';
import { NodeDrag } from '../../react-canvas-editor/tools/node/nodeDrag.ts';

declare global {
  interface NodeProps {
    genericPath?: {
      path?: string;
      waypointTypes?: EditableWaypointType[];
    };
  }
}

const DEFAULT_PATH = 'M -1 1, L 1 1, L 1 -1, L -1 -1, L -1 1';

const COLORS: Record<EditableWaypointType, string> = {
  corner: 'red',
  smooth: 'blue',
  symmetric: 'green'
};

const NEXT_TYPE: Record<EditableWaypointType, EditableWaypointType> = {
  corner: 'smooth',
  smooth: 'symmetric',
  symmetric: 'corner'
};

export const GenericPath = (props: Props) => {
  const drag = useDragDrop();
  const pathBuilder = new GenericPathNodeDefinition().getBoundingPathBuilder(props.node);
  const path = pathBuilder.getPath();
  const svgPath = path.asSvgPath();
  const [selectedWaypoints, setSelectedWaypoints] = useState<number[]>([]);

  const editablePath = new EditablePath(path, props.node);

  return (
    <>
      {props.isSingleSelected && props.tool?.type === 'node' && (
        <path
          d={svgPath}
          x={props.node.bounds.x}
          y={props.node.bounds.y}
          width={props.node.bounds.w}
          height={props.node.bounds.h}
          {...propsUtils.filterSvgProperties(props)}
          style={{
            ...props.style,
            stroke: '#e8e8f8',
            strokeWidth: 20,
            strokeLinejoin: 'miter',
            strokeLinecap: 'square'
          }}
          onDoubleClick={
            props.tool?.type === 'node'
              ? e => {
                  const domPoint = EventHelper.point(e.nativeEvent);
                  const dp = props.node.diagram.viewBox.toDiagramPoint(domPoint);
                  editablePath.split(editablePath.toLocalCoordinate(dp));
                  editablePath.commit();
                }
              : undefined
          }
        />
      )}

      <path
        d={svgPath}
        x={props.node.bounds.x}
        y={props.node.bounds.y}
        width={props.node.bounds.w}
        height={props.node.bounds.h}
        {...propsUtils.filterSvgProperties(props)}
        style={{
          ...props.style,
          pointerEvents: props.isSingleSelected && props.tool?.type === 'node' ? 'none' : undefined
        }}
        onDoubleClick={
          props.tool?.type === 'node'
            ? e => {
                const domPoint = EventHelper.point(e.nativeEvent);
                const dp = props.node.diagram.viewBox.toDiagramPoint(domPoint);
                editablePath.split(editablePath.toLocalCoordinate(dp));
                editablePath.commit();
              }
            : undefined
        }
      />

      {props.isSingleSelected && props.tool?.type === 'node' && (
        <>
          {editablePath.waypoints.map((wp, idx) => (
            <React.Fragment key={idx}>
              {selectedWaypoints.includes(idx) && (
                <>
                  <line
                    x1={wp.point.x}
                    y1={wp.point.y}
                    x2={wp.point.x + wp.controlPoints.p1.x}
                    y2={wp.point.y + wp.controlPoints.p1.y}
                    stroke={'blue'}
                  />
                  <circle
                    cx={wp.point.x + wp.controlPoints.p1.x}
                    cy={wp.point.y + wp.controlPoints.p1.y}
                    stroke={'blue'}
                    fill={'white'}
                    r={4}
                    onMouseDown={e => {
                      if (e.button !== 0) return;
                      drag.initiate(new ControlPointDrag(editablePath, idx, 'p1'));
                      e.stopPropagation();
                    }}
                  />

                  <line
                    x1={wp.point.x}
                    y1={wp.point.y}
                    x2={wp.point.x + wp.controlPoints.p2.x}
                    y2={wp.point.y + wp.controlPoints.p2.y}
                    stroke={'green'}
                  />
                  <circle
                    cx={wp.point.x + wp.controlPoints.p2.x}
                    cy={wp.point.y + wp.controlPoints.p2.y}
                    stroke={'green'}
                    fill={'white'}
                    r={4}
                    onMouseDown={e => {
                      if (e.button !== 0) return;
                      drag.initiate(new ControlPointDrag(editablePath, idx, 'p2'));
                      e.stopPropagation();
                    }}
                  />
                </>
              )}

              <circle
                cx={wp.point.x}
                cy={wp.point.y}
                stroke={COLORS[wp.type]}
                fill={selectedWaypoints.includes(idx) ? COLORS[wp.type] : 'white'}
                r={4}
                onMouseDown={e => {
                  if (e.button !== 0) return;
                  drag.initiate(
                    new NodeDrag(
                      editablePath,
                      idx,
                      props.node.diagram.viewBox.toDiagramPoint(EventHelper.point(e.nativeEvent))
                    )
                  );

                  if (e.shiftKey) {
                    setSelectedWaypoints([...selectedWaypoints, idx]);
                  } else {
                    setSelectedWaypoints([idx]);
                  }
                  e.stopPropagation();
                }}
                onDoubleClick={e => {
                  if (e.metaKey) {
                    editablePath.deleteWaypoint(idx);
                  } else {
                    editablePath.updateWaypoint(idx, { type: NEXT_TYPE[wp.type] });
                  }
                  editablePath.commit();
                  e.stopPropagation();
                }}
              />
            </React.Fragment>
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
      def.props.genericPath?.path ?? DEFAULT_PATH,
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
