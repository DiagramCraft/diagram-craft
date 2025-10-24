import { Component, createEffect } from '../component/component';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import type { CanvasState } from '../canvas/EditableCanvasComponent';

export class SelectionMarqueeComponent extends Component<CanvasState> {
  render(props: CanvasState) {
    createEffect(() => {
      const cb = () => this.redraw();

      props.context.marquee.on('change', cb);
      return () => props.context.marquee.off('change', cb);
    }, [props.context.marquee]);

    const bounds = props.context.marquee.bounds;
    if (!bounds) return svg.g({});

    return svg.g(
      {},
      svg.rectFromBox(bounds, { class: 'svg-marquee' }),
      ...(props.context.marquee.pendingElements?.map(e =>
        svg.rectFromBox(e.bounds, {
          class: 'svg-marquee__element',
          transform: Transforms.rotate(e.bounds)
        })
      ) ?? [])
    );
  }
}
