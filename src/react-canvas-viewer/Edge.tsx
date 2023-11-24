import React, { forwardRef, MouseEventHandler, useCallback, useImperativeHandle } from 'react';
import { DiagramEdge } from '../model-viewer/diagram.ts';
import { useRedraw } from './useRedraw.tsx';
import { Point } from '../geometry/point.ts';
import { Drag, Modifiers } from '../base-ui/drag.ts';
import { buildEdgePath } from '../base-ui/edgePathBuilder.ts';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { useDragDrop } from './DragDropManager.tsx';
import { ContextMenuEvent } from '../react-canvas-editor/EditableCanvas.tsx';

class EdgeWaypointDrag implements Drag {
  constructor(
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number
  ) {}

  onDrag(coord: Point, _diagram: EditableDiagram, _modifiers: Modifiers) {
    this.edge.waypoints![this.waypointIdx].point = coord;
    _diagram.updateElement(this.edge);
  }

  onDragEnd(_coord: Point, _diagram: EditableDiagram): void {}
}

export type EdgeApi = {
  repaint: () => void;
};

export const Edge = forwardRef<EdgeApi, Props>((props, ref) => {
  const redraw = useRedraw();
  const drag = useDragDrop();

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
      props.onMouseDown(props.def.id, Point.fromEvent(e.nativeEvent), e.nativeEvent);
      e.stopPropagation();

      return false;
    },
    [props]
  );

  const path = buildEdgePath(props.def);

  const isSelected =
    props.diagram instanceof EditableDiagram &&
    props.diagram.selectionState.elements.includes(props.def);
  const isSingleSelected =
    isSelected &&
    props.diagram instanceof EditableDiagram &&
    props.diagram.selectionState.elements.length === 1;

  const onContextMenu = (event: React.MouseEvent<SVGPathElement, MouseEvent>) => {
    const e = event as ContextMenuEvent & React.MouseEvent<SVGPathElement, MouseEvent>;
    const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    e.contextMenuTarget = {
      type: 'edge',
      id: props.def.id,
      pos: props.diagram.viewBox.toDiagramPoint(point)
    };
  };
  return (
    <g>
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
        stroke={'black'}
        onMouseDown={onMouseDown}
        onMouseEnter={() => props.onMouseEnter(props.def.id)}
        onMouseLeave={() => props.onMouseLeave(props.def.id)}
        onContextMenu={onContextMenu}
        style={{ cursor: 'move', fill: 'none' }}
      />

      {isSingleSelected && (
        <>
          {props.diagram.selectionState.edges[0].waypoints?.map((wp, idx) => (
            <circle
              key={`wp_${wp.point.x}_${wp.point.y}`}
              cx={wp.point.x}
              cy={wp.point.y}
              r="4"
              className="selection-edge-handle"
              cursor={'move'}
              onMouseDown={e => {
                if (e.button !== 0) return;

                drag.initiateDrag(new EdgeWaypointDrag(props.def, idx));
                e.stopPropagation();

                return false;
              }}
              onContextMenu={onContextMenu}
            />
          ))}
        </>
      )}
    </g>
  );
});

type Props = {
  def: DiagramEdge;
  diagram: EditableDiagram;
  onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
};
