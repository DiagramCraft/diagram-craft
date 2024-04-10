import { Component, createEffect } from '../component/component';
import * as svg from '../component/vdom-svg';
import { Transform } from '../component/vdom-svg';
import { CanvasState } from '../EditableCanvasComponent';

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
      svg.rectFromBox(bounds, { class: 'svg-marquee' }),
      ...(selection.marquee.pendingElements?.map(e =>
        svg.rectFromBox(e.bounds, {
          class: 'svg-marquee__element',
          transform: Transform.rotate(e.bounds)
        })
      ) ?? [])
    );
  }
}
