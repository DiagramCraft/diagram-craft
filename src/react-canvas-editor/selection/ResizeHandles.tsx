import { Point } from '../../geometry/point.ts';
import React, { useCallback } from 'react';
import { ResizeDrag, ResizeType } from '../../base-ui/drag/resizeDrag.ts';
import { EventHelper } from '../../base-ui/eventHelper.ts';
import { useDragDrop } from '../../react-canvas-viewer/DragDropManager.tsx';
import { Diagram } from '../../model/diagram.ts';
import { Box } from '../../geometry/box.ts';
import { SelectionState } from '../../model/selectionState.ts';

export const ResizeHandles = (props: Props) => {
  const drag = useDragDrop();

  const bounds = props.selection.bounds;

  const points: Point[] = Box.corners({
    ...bounds,
    rotation: 0
  });

  const north = Point.midpoint(points[0], points[1]);
  const east = Point.midpoint(points[1], points[2]);
  const south = Point.midpoint(points[2], points[3]);
  const west = Point.midpoint(points[3], points[0]);

  const initiateDrag = useCallback(
    (e: React.MouseEvent<SVGCircleElement, MouseEvent>, type: ResizeType) => {
      if (e.button !== 0) return;
      drag.initiate(
        new ResizeDrag(
          props.diagram,
          type,
          props.diagram.viewBox.toDiagramPoint(EventHelper.point(e.nativeEvent))
        )
      );
      e.stopPropagation();
    },
    [drag, props.diagram]
  );

  return (
    <>
      <circle
        cx={points[0].x}
        cy={points[0].y}
        r="4"
        className="svg-selection__handle"
        cursor={'nw-resize'}
        onMouseDown={e => initiateDrag(e, 'resize-nw')}
      />
      <circle
        cx={points[1].x}
        cy={points[1].y}
        r="4"
        className="svg-selection__handle"
        cursor={'ne-resize'}
        onMouseDown={e => initiateDrag(e, 'resize-ne')}
      />
      <circle
        cx={points[2].x}
        cy={points[2].y}
        r="4"
        className="svg-selection__handle"
        cursor={'se-resize'}
        onMouseDown={e => initiateDrag(e, 'resize-se')}
      />
      <circle
        cx={points[3].x}
        cy={points[3].y}
        r="4"
        className="svg-selection__handle"
        cursor={'sw-resize'}
        onMouseDown={e => initiateDrag(e, 'resize-sw')}
      />
      <circle
        cx={north.x}
        cy={north.y}
        r="4"
        className="svg-selection__handle"
        cursor={'n-resize'}
        onMouseDown={e => initiateDrag(e, 'resize-n')}
      />
      <circle
        cx={east.x}
        cy={east.y}
        r="4"
        className="svg-selection__handle"
        cursor={'e-resize'}
        onMouseDown={e => initiateDrag(e, 'resize-e')}
      />
      ;
      <circle
        cx={south.x}
        cy={south.y}
        r="4"
        className="svg-selection__handle"
        cursor={'s-resize'}
        onMouseDown={e => initiateDrag(e, 'resize-s')}
      />
      <circle
        cx={west.x}
        cy={west.y}
        r="4"
        className="svg-selection__handle"
        cursor={'w-resize'}
        onMouseDown={e => initiateDrag(e, 'resize-w')}
      />
    </>
  );
};

type Props = {
  diagram: Diagram;
  selection: SelectionState;
};
