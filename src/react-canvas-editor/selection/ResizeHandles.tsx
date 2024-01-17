import { Point } from '../../geometry/point.ts';
import React, { useCallback } from 'react';
import { ResizeDrag, ResizeType } from '../../base-ui/drag/resizeDrag.ts';
import { EventHelper } from '../../base-ui/eventHelper.ts';
import { useDragDrop } from '../../react-canvas-viewer/DragDropManager.ts';
import { Box } from '../../geometry/box.ts';
import { useDiagram } from '../../react-app/context/DiagramContext.tsx';

const Handle = (props: {
  x: number;
  y: number;
  r: number;
  cursor: string;
  onMouseDown: React.MouseEventHandler<SVGElement>;
}) => {
  return (
    <rect
      x={props.x - props.r / 2}
      y={props.y - props.r / 2}
      width={props.r}
      height={props.r}
      rx={1}
      ry={1}
      className="svg-selection__handle"
      cursor={props.cursor}
      onMouseDown={props.onMouseDown}
    />
  );
};

export const ResizeHandles = () => {
  const diagram = useDiagram();
  const selection = diagram.selectionState;
  const drag = useDragDrop();

  const bounds = selection.bounds;

  const points: Point[] = Box.corners({
    ...bounds,
    r: 0
  });

  const north = Point.midpoint(points[0], points[1]);
  const east = Point.midpoint(points[1], points[2]);
  const south = Point.midpoint(points[2], points[3]);
  const west = Point.midpoint(points[3], points[0]);

  const initiateDrag = useCallback(
    (e: React.MouseEvent<SVGElement, MouseEvent>, type: ResizeType) => {
      if (e.button !== 0) return;
      drag.initiate(
        new ResizeDrag(
          diagram,
          type,
          diagram.viewBox.toDiagramPoint(EventHelper.point(e.nativeEvent))
        )
      );
      e.stopPropagation();
    },
    [drag, diagram]
  );

  return (
    <>
      <Handle
        x={points[0].x}
        y={points[0].y}
        r={6}
        cursor={'nw-resize'}
        onMouseDown={e => initiateDrag(e, 'nw')}
      />
      <Handle
        x={points[1].x}
        y={points[1].y}
        r={6}
        cursor={'ne-resize'}
        onMouseDown={e => initiateDrag(e, 'ne')}
      />
      <Handle
        x={points[2].x}
        y={points[2].y}
        r={6}
        cursor={'se-resize'}
        onMouseDown={e => initiateDrag(e, 'se')}
      />
      <Handle
        x={points[3].x}
        y={points[3].y}
        r={6}
        cursor={'sw-resize'}
        onMouseDown={e => initiateDrag(e, 'sw')}
      />
      <Handle
        x={north.x}
        y={north.y}
        r={6}
        cursor={'n-resize'}
        onMouseDown={e => initiateDrag(e, 'n')}
      />
      <Handle
        x={east.x}
        y={east.y}
        r={6}
        cursor={'e-resize'}
        onMouseDown={e => initiateDrag(e, 'e')}
      />
      ;
      <Handle
        x={south.x}
        y={south.y}
        r={6}
        cursor={'s-resize'}
        onMouseDown={e => initiateDrag(e, 's')}
      />
      <Handle
        x={west.x}
        y={west.y}
        r={6}
        cursor={'w-resize'}
        onMouseDown={e => initiateDrag(e, 'w')}
      />
    </>
  );
};
