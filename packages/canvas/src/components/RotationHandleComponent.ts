import { DRAG_DROP_MANAGER } from '../dragDropManager';
import { Diagram } from '@diagram-craft/model';
import { Component } from '../component/component';
import * as svg from '../component/vdom-svg';
import { Point } from '@diagram-craft/geometry/point';
import { RotateDrag } from '../drag/rotateDrag';

type Props = {
  diagram: Diagram;
};

export class RotationHandleComponent extends Component<Props> {
  render(props: Props) {
    const diagram = props.diagram;
    const selection = diagram.selectionState;
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
            DRAG_DROP_MANAGER.initiate(new RotateDrag(diagram));
            e.stopPropagation();
          }
        }
      })
    );
  }
}
