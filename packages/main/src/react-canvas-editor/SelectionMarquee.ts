import { Angle } from '../geometry/angle.ts';
import { SelectionState } from '../model/selectionState.ts';
import { Component, createEffect } from '../base-ui/component.ts';
import * as svg from '../base-ui/vdom-svg.ts';

export class SelectionMarqueeComponent extends Component<Props> {
  render(props: Props) {
    createEffect(() => {
      const cb = () => this.redraw();
      props.selection.marquee.on('change', cb);
      return () => props.selection.marquee.off('change', cb);
    }, [props.selection.marquee]);

    const bounds = props.selection.marquee.bounds;
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
      ...(props.selection.marquee.pendingElements?.map(e =>
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

type Props = {
  selection: SelectionState;
};
