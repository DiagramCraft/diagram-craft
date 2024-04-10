import { Component } from '../component/component';
import * as svg from '../component/vdom-svg';
import { toInlineCSS } from '../component/vdom';
import { CanvasState } from '../EditableCanvasComponent';

export class DocumentBoundsComponent extends Component<CanvasState> {
  render(props: CanvasState) {
    const diagram = props.diagram;

    // Note: we don't need to listen to diagram change events here, because this is handled
    //       through a full redraw of EditableCanvas when diagram changes.

    const style: Partial<CSSStyleDeclaration> = {};

    if (diagram.props.background?.color) {
      style.fill = diagram.props.background.color;
    }

    return svg.rect({
      class: 'svg-doc-bounds',
      x: diagram.canvas.x,
      y: diagram.canvas.y,
      width: diagram.canvas.w,
      height: diagram.canvas.h,
      style: toInlineCSS(style)
    });
  }
}
