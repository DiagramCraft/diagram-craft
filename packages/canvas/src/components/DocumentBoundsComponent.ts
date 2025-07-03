import { Component } from '../component/component';
import * as svg from '../component/vdom-svg';
import { toInlineCSS, VNode } from '../component/vdom';
import type { CanvasState } from '../canvas/EditableCanvasComponent';
import { addFillComponents } from '../shape/shapeFill';
import { assert } from '@diagram-craft/utils/assert';
import { nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { DeepRequired } from '@diagram-craft/utils/types';

export class DocumentBoundsComponent extends Component<CanvasState> {
  render(props: CanvasState) {
    const diagram = props.diagram;

    // Note: we don't need to listen to diagram change events here, because this is handled
    //       through a full redraw of EditableCanvas when diagram changes.

    const style: Partial<CSSStyleDeclaration> = {};

    const children: VNode[] = [];

    const fill = nodeDefaults.applyDefaults({ fill: diagram.props.background })
      .fill as DeepRequired<NodeProps['fill']>;
    assert.present(fill);

    const fillType = diagram.props.background?.type ?? 'solid';
    if (fillType === 'solid') {
      if (fill.color) {
        style.fill = fill.color;
      }
    } else {
      addFillComponents(
        'diagram',
        props.diagram.id,
        fillType,
        fill,
        diagram,
        diagram.canvas,
        style,
        children,
        this
      );
    }

    return svg.g(
      {},
      svg.rect({
        class: 'svg-doc-bounds',
        x: diagram.canvas.x,
        y: diagram.canvas.y,
        width: diagram.canvas.w,
        height: diagram.canvas.h,
        style: toInlineCSS(style)
      }),
      ...children
    );
  }
}
