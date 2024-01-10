import { Point } from '../../geometry/point.ts';
import { RotateDrag } from '../../base-ui/drag/rotateDrag.ts';
import { useDragDrop } from '../../react-canvas-viewer/DragDropManager.ts';
import { useDiagram } from '../../react-app/context/DiagramContext.tsx';

export const RotationHandle = () => {
  const diagram = useDiagram();
  const selection = diagram.selectionState;
  const drag = useDragDrop();

  const bounds = selection.bounds;

  const north = Point.midpoint(bounds, {
    x: bounds.x + bounds.w,
    y: bounds.y
  });

  return (
    <>
      <line
        x1={north.x}
        y1={north.y}
        x2={north.x}
        y2={north.y - 20}
        className="svg-selection__handle"
      />
      <circle
        cx={north.x}
        cy={north.y - 20}
        r="4"
        className="svg-selection__handle"
        cursor={'ew-resize'}
        onMouseDown={e => {
          if (e.button !== 0) return;
          drag.initiate(new RotateDrag(diagram));
          e.stopPropagation();
        }}
      />
    </>
  );
};
