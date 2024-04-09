import { RotateDrag } from '../../base-ui/drag/rotateDrag.ts';
import { DRAG_DROP_MANAGER } from '../DragDropManager.ts';
import { Diagram } from '../../model/diagram.ts';
import { Component } from '../../base-ui/component.ts';
import * as svg from '../../base-ui/vdom-svg.ts';
import { Point } from '@diagram-craft/geometry';

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
