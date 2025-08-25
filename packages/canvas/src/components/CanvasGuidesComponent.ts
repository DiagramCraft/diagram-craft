import { Component, createEffect } from '../component/component';
import * as svg from '../component/vdom-svg';
import { toInlineCSS } from '../component/vdom';
import type { CanvasState } from '../canvas/EditableCanvasComponent';

const DEFAULT_GUIDE_COLOR = '#3b82f6';

export class CanvasGuidesComponent extends Component<CanvasState> {
  render(props: CanvasState) {
    const diagram = props.diagram;

    if (diagram.props.guides?.enabled === false) {
      return svg.g({});
    }

    // Subscribe to ViewBox events to redraw when panning/zooming
    createEffect(() => {
      const cb = () => this.redraw();
      diagram.viewBox.on('viewbox', cb);
      return () => diagram.viewBox.off('viewbox', cb);
    }, [diagram]);

    const viewBox = diagram.viewBox;
    const guides = diagram.guides;

    if (guides.length === 0) {
      return svg.g({});
    }

    const guideElements = guides.map(guide => {
      const color = guide.color ?? DEFAULT_GUIDE_COLOR;
      const strokeWidth = 1.5 * viewBox.zoomLevel;
      const style = toInlineCSS({
        stroke: color,
        strokeWidth: `${strokeWidth}px`,
        strokeOpacity: '0.8'
      });

      if (guide.type === 'horizontal') {
        // Horizontal guide - line across full viewbox width
        return svg.line({
          class: 'svg-canvas-guide svg-canvas-guide--horizontal',
          x1: viewBox.offset.x,
          y1: guide.position,
          x2: viewBox.offset.x + viewBox.dimensions.w,
          y2: guide.position,
          style
        });
      } else {
        // Vertical guide - line across full viewbox height
        return svg.line({
          class: 'svg-canvas-guide svg-canvas-guide--vertical',
          x1: guide.position,
          y1: viewBox.offset.y,
          x2: guide.position,
          y2: viewBox.offset.y + viewBox.dimensions.h,
          style
        });
      }
    });

    return svg.g(
      {
        class: 'svg-canvas-guides-container'
      },
      ...guideElements
    );
  }
}
