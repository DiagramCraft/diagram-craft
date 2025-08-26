import { Component, createEffect } from '../component/component';
import * as svg from '../component/vdom-svg';
import { toInlineCSS } from '../component/vdom';
import type { CanvasState } from '../canvas/EditableCanvasComponent';
import { GuideDrag } from '../drag/guideDrag';
import { DRAG_DROP_MANAGER } from '../dragDropManager';

const DEFAULT_GUIDE_COLOR = 'var(--accent-9)';

export class CanvasGuidesComponent extends Component<CanvasState> {
  render(props: CanvasState) {
    const diagram = props.diagram;
    const guides = diagram.guides;

    if (diagram.props.guides?.enabled === false || guides.length === 0) {
      return svg.g({});
    }

    // Subscribe to ViewBox events to redraw when panning/zooming
    createEffect(() => {
      const cb = () => this.redraw();
      diagram.viewBox.on('viewbox', cb);
      return () => diagram.viewBox.off('viewbox', cb);
    }, [diagram]);

    createEffect(() => {
      const cb = () => setTimeout(() => this.redraw(), 0);

      DRAG_DROP_MANAGER.on('dragStart', cb);
      return () => DRAG_DROP_MANAGER.off('dragStart', cb);
    }, []);

    createEffect(() => {
      const cb = () => setTimeout(() => this.redraw(), 0);

      DRAG_DROP_MANAGER.on('dragEnd', cb);
      return () => DRAG_DROP_MANAGER.off('dragEnd', cb);
    }, []);

    const viewBox = diagram.viewBox;

    const guideElements = guides.map(guide => {
      const color = guide.color ?? DEFAULT_GUIDE_COLOR;
      const strokeWidth = 1.5 * viewBox.zoomLevel;
      const style = toInlineCSS({
        stroke: color,
        strokeWidth: `${strokeWidth}px`,
        pointerEvents: DRAG_DROP_MANAGER.isDragging() ? 'none' : 'unset'
      });

      if (guide.type === 'horizontal') {
        // Horizontal guide - line across full viewbox width
        return svg.line({
          id: `guide-${guide.id}`,
          class: 'svg-canvas-guide svg-canvas-guide--horizontal',
          x1: viewBox.offset.x,
          y1: guide.position,
          x2: viewBox.offset.x + viewBox.dimensions.w,
          y2: guide.position,
          style: `${style}; cursor: ns-resize;`,
          on: {
            mousedown: (e: MouseEvent) => {
              if (e.button !== 0) return;

              DRAG_DROP_MANAGER.initiate(new GuideDrag(diagram, guide));
              e.preventDefault();
              e.stopPropagation();
            }
          }
        });
      } else {
        // Vertical guide - line across full viewbox height
        return svg.line({
          id: `guide-${guide.id}`,
          class: 'svg-canvas-guide svg-canvas-guide--vertical',
          x1: guide.position,
          y1: viewBox.offset.y,
          x2: guide.position,
          y2: viewBox.offset.y + viewBox.dimensions.h,
          style: `${style}; cursor: ew-resize;`,
          on: {
            mousedown: (e: MouseEvent) => {
              if (e.button !== 0) return;

              DRAG_DROP_MANAGER.initiate(new GuideDrag(diagram, guide));
              e.preventDefault();
              e.stopPropagation();
            }
          }
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
