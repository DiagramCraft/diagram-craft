import { DRAG_DROP_MANAGER } from '../dragDropManager';
import { Component } from '../component/component';
import * as svg from '../component/vdom-svg';
import { Point } from '@diagram-craft/geometry/point';
import { RotateDrag } from '../drag/rotateDrag';
import { Diagram } from '@diagram-craft/model/diagram';
import { Zoom } from './zoom';

type Props = {
  diagram: Diagram;
};

export class RotationHandleComponent extends Component<Props> {
  render(props: Props) {
    const { diagram } = props;

    const selection = diagram.selectionState;
    const bounds = selection.bounds;

    const north = Point.midpoint(bounds, {
      x: bounds.x + bounds.w,
      y: bounds.y
    });

    if (selection.nodes.some(p => p.renderProps.capabilities.rotatable === false)) {
      return svg.g({});
    }

    const z = new Zoom(diagram.viewBox.zoomLevel);

    return svg.g(
      {},
      svg.line({
        x1: north.x,
        y1: north.y,
        x2: north.x,
        y2: north.y - z.num(20, 10)
      }),
      svg.circle({
        cx: north.x,
        cy: north.y - z.num(20, 10),
        r: z.num(4, 2),
        class: 'svg-handle svg-selection__handle',
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
