import { Component } from './component/component.ts';
import * as svg from './component/vdom-svg.ts';
import { toInlineCSS, VNode } from './component/vdom.ts';
import { CanvasState } from './EditableCanvas.ts';

type Type = 'major' | 'minor';

const circleAt = (
  xCoord: number,
  yCoord: number,
  type: Type,
  style: Partial<CSSStyleDeclaration>
) => {
  return svg.circle({
    class: `svg-grid svg-grid--${type}`,
    cx: xCoord,
    cy: yCoord,
    r: 1,
    style: toInlineCSS(style)
  });
};

const hline = (
  xCoord: number,
  yCoord: number,
  w: number,
  type: Type,
  style: Partial<CSSStyleDeclaration>
) => {
  return svg.line({
    class: `svg-grid svg-grid--${type}`,
    x1: xCoord + 1,
    y1: yCoord,
    x2: xCoord + w - 1,
    y2: yCoord,
    style: toInlineCSS(style)
  });
};

const vline = (
  xCoord: number,
  yCoord: number,
  h: number,
  type: Type,
  style: Partial<CSSStyleDeclaration>
) => {
  return svg.line({
    class: `svg-grid svg-grid--${type}`,
    x1: xCoord,
    y1: yCoord + 1,
    x2: xCoord,
    y2: yCoord + h - 1,
    style: toInlineCSS(style)
  });
};

export class GridComponent extends Component<CanvasState> {
  render(props: CanvasState) {
    const diagram = props.diagram;

    // Note: we don't need to listen to diagram change events here, because this is handled
    //       through a full redraw of EditableCanvas when diagram changes.

    const { x, y, w, h } = diagram.canvas;

    const dx = diagram.props.grid?.size ?? 10;
    const dy = diagram.props.grid?.size ?? 10;

    const majorCount = diagram.props.grid?.majorCount ?? 5;

    const rows = Math.floor(h / dy);
    const cols = Math.floor(w / dx);

    const dest: VNode[] = [];

    if (diagram.props.grid?.enabled === false) {
      return svg.g({});
    }

    const majorStyle: Partial<CSSStyleDeclaration> = {};
    if (diagram.props.grid?.majorColor) {
      majorStyle.stroke = diagram.props.grid.majorColor;
      majorStyle.fill = diagram.props.grid.majorColor;
    }

    const minorStyle: Partial<CSSStyleDeclaration> = {};
    if (diagram.props.grid?.color) {
      minorStyle.stroke = diagram.props.grid.color;
      minorStyle.fill = diagram.props.grid.color;
    }

    const majorType = diagram.props.grid?.majorType ?? 'lines';
    const type = diagram.props.grid?.type ?? 'lines';

    if (type === 'lines') {
      for (let i = 0; i < rows; i++) {
        const yCoord = i * dy + dy + y;
        if (yCoord >= y + h - 1) continue;

        if (i % majorCount !== 0 || majorType !== 'lines') {
          dest.push(hline(x, yCoord, w, 'minor', minorStyle));
        }
      }

      for (let i = 0; i < cols; i++) {
        const xCoord = i * dx + dx + x;
        if (xCoord >= x + w - 1) continue;

        if (i % majorCount !== 0 || majorType !== 'lines') {
          dest.push(vline(xCoord, y, h, 'minor', minorStyle));
        }
      }
    } else if (type === 'dots') {
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const yCoord = i * dy + dy + y;
          const xCoord = j * dx + dx + x;

          if (yCoord >= y + h - 1 || xCoord >= x + w - 1) continue;

          dest.push(circleAt(xCoord, yCoord, 'minor', minorStyle));
        }
      }
    }

    if (majorType === 'lines') {
      for (let i = 0; i < rows; i++) {
        const yCoord = i * dy + dy + y;
        if (yCoord >= y + h - 1) continue;

        if (i % majorCount === 0) {
          dest.push(hline(x, yCoord, w, 'major', majorStyle));
        }
      }

      for (let i = 0; i < cols; i++) {
        const xCoord = i * dx + dx + x;
        if (xCoord >= x + w - 1) continue;

        if (i % majorCount === 0) {
          dest.push(vline(xCoord, y, h, 'major', majorStyle));
        }
      }
    } else if (majorType === 'dots') {
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          if (i % majorCount !== 0 || j % majorCount !== 0) continue;

          const yCoord = i * dy + dy + y;
          const xCoord = j * dx + dx + x;

          if (yCoord >= y + h - 1 || xCoord >= x + w - 1) continue;

          dest.push(circleAt(xCoord, yCoord, 'major', majorStyle));
        }
      }
    }

    return svg.g({}, ...dest);
  }
}
