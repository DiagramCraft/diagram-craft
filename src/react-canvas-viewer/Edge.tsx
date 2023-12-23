import React, {
  CSSProperties,
  forwardRef,
  MouseEventHandler,
  useCallback,
  useEffect,
  useImperativeHandle
} from 'react';
import { useRedraw } from './useRedraw.tsx';
import { Point } from '../geometry/point.ts';
import { Modifiers } from '../base-ui/drag.ts';
import { useDragDrop } from './DragDropManager.tsx';
import { ContextMenuEvent } from '../react-canvas-editor/EditableCanvas.tsx';
import { ARROW_SHAPES } from '../base-ui/arrowShapes.ts';
import { DASH_PATTERNS } from '../base-ui/dashPatterns.ts';
import { EventHelper } from '../base-ui/eventHelper.ts';
import { DiagramEdge } from '../model/diagramEdge.ts';
import { EdgeWaypointDrag } from '../react-canvas-editor/edgeWaypoint.ts';
import { BezierControlPointDrag } from '../react-canvas-editor/edgeBezierControlPoint.ts';
import { deepMerge } from '../utils/deepmerge.ts';
import { useConfiguration } from '../react-app/context/ConfigurationContext.tsx';
import { Diagram } from '../model/diagram.ts';
import { makeShadowFilter } from '../base-ui/styleUtils.ts';
import { DeepRequired } from 'ts-essentials';
import { clipPath } from '../model/edgeUtils.ts';
import { TimeOffsetOnPath } from '../geometry/pathPosition.ts';

export type EdgeApi = {
  repaint: () => void;
};

export const Edge = forwardRef<EdgeApi, Props>((props, ref) => {
  const redraw = useRedraw();
  const drag = useDragDrop();

  const { defaults } = useConfiguration();

  useImperativeHandle(ref, () => {
    return {
      repaint: () => {
        redraw();
      }
    };
  });

  const onMouseDown = useCallback<MouseEventHandler>(
    e => {
      if (e.button !== 0) return;
      props.onMouseDown(props.def.id, EventHelper.point(e.nativeEvent), e.nativeEvent);
      e.stopPropagation();

      return false;
    },
    [props]
  );

  const onContextMenu = (event: React.MouseEvent<SVGPathElement, MouseEvent>) => {
    const e = event as ContextMenuEvent & React.MouseEvent<SVGPathElement, MouseEvent>;
    const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    e.contextMenuTarget = {
      type: 'edge',
      id: props.def.id,
      pos: props.diagram.viewBox.toDiagramPoint(point)
    };
  };

  const isSelected = props.diagram.selectionState.elements.includes(props.def);
  const isSingleSelected = isSelected && props.diagram.selectionState.elements.length === 1;
  const firstEdge = props.diagram.selectionState.edges[0];

  const edgeProps = deepMerge({}, defaults.edge, props.def.props) as DeepRequired<EdgeProps>;

  const color = edgeProps.stroke?.color;
  const fillColor = edgeProps.fill?.color;
  const width = edgeProps.stroke?.width;

  const style: CSSProperties = {};
  style.cursor = 'move';
  style.fill = 'none';
  style.strokeDasharray =
    DASH_PATTERNS[edgeProps.stroke.pattern]?.(
      edgeProps.stroke.patternSize / 100,
      edgeProps.stroke.patternSpacing / 100
    ) ?? '';
  style.strokeWidth = width;
  style.stroke = color;
  if (edgeProps.shadow?.enabled) {
    style.filter = makeShadowFilter(edgeProps.shadow);
  }

  const startArrowSize = edgeProps.arrow.start.size / 100;
  const endArrowSize = edgeProps.arrow.end.size / 100;
  const arrow1 = ARROW_SHAPES[edgeProps.arrow.start.type]?.(startArrowSize);
  const arrow2 = ARROW_SHAPES[edgeProps.arrow.end.type]?.(endArrowSize);
  const fullPath = props.def.path();
  const path = clipPath(fullPath, props.def, arrow1, arrow2);

  // TODO: Do we really want to this while painting?
  useEffect(() => {
    if (props.def.labelNode) {
      const refPoint = fullPath.pointAt(
        TimeOffsetOnPath.toLengthOffsetOnPath({ pathT: props.def.labelNode.timeOffset }, fullPath)
      );

      const centerPoint = Point.add(refPoint, props.def.labelNode.offset);
      const currentCenterPoint = {
        x: props.def.labelNode.node.bounds.pos.x + props.def.labelNode.node.bounds.size.w / 2,
        y: props.def.labelNode.node.bounds.pos.y + props.def.labelNode.node.bounds.size.h / 2
      };
      if (!Point.isEqual(centerPoint, currentCenterPoint)) {
        props.def.labelNode.node.bounds = {
          ...props.def.labelNode.node.bounds,
          pos: {
            x: centerPoint.x - props.def.labelNode.node.bounds.size.w / 2,
            y: centerPoint.y - props.def.labelNode.node.bounds.size.h / 2
          }
        };
        props.def.diagram?.updateElement(props.def.labelNode.node);
      }
    }
  }, [fullPath, path, props.def.diagram, props.def.labelNode]);

  return (
    <g>
      {arrow1 && (
        <marker
          id={`marker_s_${props.def.id}`}
          viewBox={`${-1 * width} ${-1 * width} ${arrow1.width + 1 + width} ${
            arrow1.height + 1 + width
          }`}
          refX={arrow1.anchor.x}
          refY={arrow1.anchor.y}
          strokeLinejoin={'round'}
          strokeLinecap={'round'}
          markerUnits={'userSpaceOnUse'}
          markerWidth={arrow1.width + 2}
          markerHeight={arrow1.height + 2}
          orient="auto-start-reverse"
        >
          <path
            d={arrow1.path}
            stroke={color}
            strokeWidth={width}
            fill={arrow1.fill === 'fg' ? fillColor : arrow1.fill === 'bg' ? 'white' : 'none'}
          />
        </marker>
      )}
      {arrow2 && (
        <marker
          id={`marker_e_${props.def.id}`}
          viewBox={`${-1 * width} ${-1 * width} ${arrow2.width + 1 + width} ${
            arrow2.height + 1 + width
          }`}
          refX={arrow2.anchor.x}
          refY={arrow2.anchor.y}
          markerUnits={'userSpaceOnUse'}
          strokeLinejoin={'round'}
          strokeLinecap={'round'}
          markerWidth={arrow2.width + 2}
          markerHeight={arrow2.height + 2}
          orient="auto-start-reverse"
        >
          <path
            d={arrow2.path}
            stroke={color}
            strokeWidth={width}
            fill={arrow2.fill === 'fg' ? fillColor : arrow2.fill === 'bg' ? 'white' : 'none'}
          />
        </marker>
      )}

      <path
        d={path.asSvgPath()}
        stroke={'transparent'}
        strokeWidth={15}
        onMouseDown={onMouseDown}
        onMouseEnter={() => props.onMouseEnter(props.def.id)}
        onMouseLeave={() => props.onMouseLeave(props.def.id)}
        onContextMenu={onContextMenu}
        style={{ cursor: 'move', fill: 'none' }}
      />
      <path
        d={path.asSvgPath()}
        onMouseDown={onMouseDown}
        onMouseEnter={() => props.onMouseEnter(props.def.id)}
        onMouseLeave={() => props.onMouseLeave(props.def.id)}
        onContextMenu={onContextMenu}
        style={style}
        markerStart={arrow1 ? `url(#marker_s_${props.def.id})` : undefined}
        markerEnd={arrow2 ? `url(#marker_e_${props.def.id})` : undefined}
      />

      {isSingleSelected && (
        <>
          {firstEdge.waypoints?.map((wp, idx) => (
            <circle
              key={`wp_${wp.point.x}_${wp.point.y}`}
              cx={wp.point.x}
              cy={wp.point.y}
              r="4"
              className="svg-waypoint-handle"
              onMouseDown={e => {
                if (e.button !== 0) return;
                drag.initiate(new EdgeWaypointDrag(props.diagram, props.def, idx));
                e.stopPropagation();
              }}
              onContextMenu={onContextMenu}
            />
          ))}
          {firstEdge.props.type === 'bezier' &&
            firstEdge.waypoints?.map((wp, idx) => {
              const controlPoints = wp.controlPoints ?? [];
              return controlPoints.map((cp, cIdx) => {
                return (
                  <React.Fragment key={`cp_bz_${idx}_${cp.x}_${cp.y}`}>
                    <line
                      x1={wp.point.x + cp.x}
                      y1={wp.point.y + cp.y}
                      x2={wp.point.x}
                      y2={wp.point.y}
                      className="svg-bezier-handle-line"
                    />
                    <circle
                      cx={wp.point.x + cp.x}
                      cy={wp.point.y + cp.y}
                      r="4"
                      className="svg-bezier-handle"
                      onMouseDown={e => {
                        if (e.button !== 0) return;
                        drag.initiate(
                          new BezierControlPointDrag(props.diagram, props.def, idx, cIdx)
                        );
                        e.stopPropagation();
                      }}
                    />
                  </React.Fragment>
                );
              });
            })}
        </>
      )}
    </g>
  );
});

type Props = {
  def: DiagramEdge;
  diagram: Diagram;
  onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
};
