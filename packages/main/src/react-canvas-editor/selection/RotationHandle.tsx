import { Point } from '../../geometry/point.ts';
import { RotateDrag } from '../../base-ui/drag/rotateDrag.ts';
import { DRAG_DROP_MANAGER } from '../../react-canvas-viewer/DragDropManager.ts';
import { Diagram } from '../../model/diagram.ts';
import { Component } from '../../base-ui/component.ts';
import * as svg from '../../base-ui/vdom-svg.ts';

type Props = {
  diagram: Diagram;
};

export class RotationHandleComponent extends Component<Props> {
  render(props: Props) {
    const diagram = props.diagram;
    const selection = diagram.selectionState;
    const drag = DRAG_DROP_MANAGER;

    const bounds = selection.bounds;

    const north = Point.midpoint(bounds, {
      x: bounds.x + bounds.w,
      y: bounds.y
    });

    return svg.g(
      {},
      svg.line({
        x1: north.x,
        y1: north.y,
        x2: north.x,
        y2: north.y - 20,
        class: 'svg-selection__handle'
      }),
      svg.circle({
        cx: north.x,
        cy: north.y - 20,
        r: 4,
        class: 'svg-selection__handle',
        cursor: 'ew-resize',
        on: {
          mousedown: e => {
            if (e.button !== 0) return;
            drag.initiate(new RotateDrag(diagram));
            e.stopPropagation();
          }
        }
      })
    );
  }
}

/*
export const RotationHandle = () => {
  const diagram = useDiagram();
  const ref = useComponent<Props, RotationHandleComponent, SVGGElement>(
    () => new RotationHandleComponent(),
    {
      diagram
    }
  );

  return <g ref={ref}></g>;

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
};*/
