import { Component } from '../component/component';
import * as svg from '../component/vdom-svg';
import { toInlineCSS } from '../component/vdom';
import type { CanvasState } from '../canvas/EditableCanvasComponent';
import { GuideMoveDrag } from '../drag/guideDrag';
import { DRAG_DROP_MANAGER } from '../dragDropManager';
import { DEFAULT_GUIDE_COLOR } from '@diagram-craft/model/types';

export class CanvasGuidesComponent extends Component<CanvasState> {
  render(props: CanvasState) {
    const diagram = props.diagram;
    const guides = diagram.guides;
    const viewBox = diagram.viewBox;

    if (diagram.props.guides?.enabled === false || guides.length === 0) {
      return svg.g({});
    }

    this.redrawOn(viewBox, 'viewbox');
    this.redrawOn(DRAG_DROP_MANAGER, 'dragStart', true);
    this.redrawOn(DRAG_DROP_MANAGER, 'dragEnd', true);

    const guideElements = guides.map(guide => {
      const style = toInlineCSS({
        stroke: guide.color ?? DEFAULT_GUIDE_COLOR,
        strokeWidth: `${1.5 * viewBox.zoomLevel}px`,
        pointerEvents: DRAG_DROP_MANAGER.isDragging() ? 'none' : 'unset'
      });

      const mousedown = (e: MouseEvent) => {
        if (e.button !== 0) return;

        DRAG_DROP_MANAGER.initiate(new GuideMoveDrag(diagram, guide));
        e.preventDefault();
        e.stopPropagation();
      };

      const id = `guide-${guide.id}`;

      if (guide.type === 'horizontal') {
        return svg.line({
          id,
          class: 'svg-canvas-guide svg-canvas-guide--horizontal',
          x1: viewBox.offset.x,
          y1: guide.position,
          x2: viewBox.offset.x + viewBox.dimensions.w,
          y2: guide.position,
          style: `cursor: ns-resize; ${style}`,
          on: { mousedown }
        });
      } else {
        return svg.line({
          id,
          class: 'svg-canvas-guide svg-canvas-guide--vertical',
          x1: guide.position,
          y1: viewBox.offset.y,
          x2: guide.position,
          y2: viewBox.offset.y + viewBox.dimensions.h,
          style: `cursor: ew-resize; ${style}`,
          on: { mousedown }
        });
      }
    });

    return svg.g({ class: 'svg-canvas-guides-container' }, ...guideElements);
  }
}
