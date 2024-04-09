import { Angle } from '@diagram-craft/geometry';
import { Component, createEffect } from './component/component.ts';
import * as svg from './component/vdom-svg.ts';
import { CanvasState } from './EditableCanvasComponent.ts';

export class SelectionMarqueeComponent extends Component<CanvasState> {
  render(props: CanvasState) {
    const selection = props.diagram.selectionState;

    createEffect(() => {
      const cb = () => this.redraw();
      selection.marquee.on('change', cb);
      return () => selection.marquee.off('change', cb);
    }, [selection.marquee]);

    const bounds = selection.marquee.bounds;
    if (!bounds) return svg.g({});

    return svg.g(
      {},
      svg.rect({
        class: 'svg-marquee',
        x: bounds.x,
        y: bounds.y,
        width: bounds.w,
        height: bounds.h
      }),
      ...(selection.marquee.pendingElements?.map(e =>
        svg.rect({
          class: 'svg-marquee__element',
          x: e.bounds.x,
          y: e.bounds.y,
          width: e.bounds.w,
          height: e.bounds.h,
          transform: `rotate(${Angle.toDeg(e.bounds.r)} ${e.bounds.x + e.bounds.w / 2} ${
            e.bounds.y + e.bounds.h / 2
          })`
        })
      ) ?? [])
    );
  }
}
