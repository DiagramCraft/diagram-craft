import { Point } from '../../geometry/point.ts';
import { RotateDrag } from '../../base-ui/drag/rotateDrag.ts';
import { SelectionState } from '../../model/selectionState.ts';
import { Diagram } from '../../model/diagram.ts';
import { useDragDrop } from '../../react-canvas-viewer/DragDropManager.tsx';

export const RotationHandle = (props: Props) => {
  const drag = useDragDrop();

  const bounds = props.selection.bounds;

  const north = Point.midpoint(bounds.pos, {
    x: bounds.pos.x + bounds.size.w,
    y: bounds.pos.y
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
          drag.initiate(new RotateDrag(props.diagram));
          e.stopPropagation();
        }}
      />
    </>
  );
};

type Props = {
  selection: SelectionState;
  diagram: Diagram;
};
