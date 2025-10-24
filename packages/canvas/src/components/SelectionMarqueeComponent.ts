import { Component, createEffect } from '../component/component';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import type { CanvasState } from '../canvas/EditableCanvasComponent';

export class SelectionMarqueeComponent extends Component<CanvasState> {
  render(props: CanvasState) {
    const selection = props.diagram.selection;

    createEffect(() => {
      const cb = () => this.redraw();

      selection.marquee.on('change', cb);
      return () => selection.marquee.off('change', cb);
    }, [selection.marquee]);

    const bounds = selection.marquee.bounds;
    if (!bounds) return svg.g({});

    return svg.g(
      {},
      svg.rectFromBox(bounds, { class: 'svg-marquee' }),
      ...(selection.marquee.pendingElements?.map(e =>
        svg.rectFromBox(e.bounds, {
          class: 'svg-marquee__element',
          transform: Transforms.rotate(e.bounds)
        })
      ) ?? [])
    );
  }
}
