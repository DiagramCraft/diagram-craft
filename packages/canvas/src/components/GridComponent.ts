import { Component } from '../component/component';
import * as svg from '../component/vdom-svg';
import { toInlineCSS, VNode } from '../component/vdom';
import { CanvasState } from '../EditableCanvasComponent';

const DEFAULT_MAJOR_COLOR = '#e7e5e4';
const DEFAULT_MINOR_COLOR = '#f5f5f4';

type Type = 'major' | 'minor';

const crossAt = (xCoord: number, yCoord: number, type: Type, style: string) => {
  return [
    svg.line({
      class: `svg-grid svg-grid--${type}`,
      x1: xCoord - 1,
      y1: yCoord,
      x2: xCoord + 1,
      y2: yCoord,
      style
    }),
    svg.line({
      class: `svg-grid svg-grid--${type}`,
      x1: xCoord,
      y1: yCoord - 1,
      x2: xCoord,
      y2: yCoord + 1,
      style
    })
  ];
};

const hLine = (xCoord: number, yCoord: number, w: number, type: Type, style: string) => {
  return svg.line({
    class: `svg-grid svg-grid--${type}`,
    x1: xCoord,
    y1: yCoord,
    x2: xCoord + w,
    y2: yCoord,
    style
  });
};

const vLine = (xCoord: number, yCoord: number, h: number, type: Type, style: string) => {
  return svg.line({
    class: `svg-grid svg-grid--${type}`,
    x1: xCoord,
    y1: yCoord,
    x2: xCoord,
    y2: yCoord + h,
    style
  });
};

export class GridComponent extends Component<CanvasState> {
  render(props: CanvasState) {
    const diagram = props.diagram;

    if (diagram.props.grid?.enabled === false) {
      return svg.g({});
    }

    // Note: we don't need to listen to diagram change events here, because this is handled
    //       through a full redraw of EditableCanvas when diagram changes.

    const { x, y, w, h } = diagram.canvas;

    const dx = diagram.props.grid?.size ?? 10;
    const dy = diagram.props.grid?.size ?? 10;

    const majorCount = diagram.props.grid?.majorCount ?? 4;

    const patternWidth = dx * majorCount;
    const patternHeight = dy * majorCount;

    const rows = Math.floor(patternHeight / dy) + 1;
    const cols = Math.floor(patternWidth / dx) + 1;

    const majorType = diagram.props.grid?.majorType ?? 'lines';
    const type = diagram.props.grid?.type ?? 'lines';

    const majorStyle: Partial<CSSStyleDeclaration> = {
      stroke: diagram.props.grid?.majorColor ?? DEFAULT_MAJOR_COLOR,
      fill: diagram.props.grid?.majorColor ?? DEFAULT_MAJOR_COLOR
    };

    const minorStyle: Partial<CSSStyleDeclaration> = {
      stroke: diagram.props.grid?.color ?? DEFAULT_MINOR_COLOR,
      fill: diagram.props.grid?.color ?? DEFAULT_MINOR_COLOR
    };

    const minorStyleAsString = toInlineCSS(minorStyle);
    const majorStyleAsString = toInlineCSS(majorStyle);

    const dest: VNode[] = [];

    if (type === 'lines') {
      for (let i = 0; i < rows; i++) {
        const yCoord = i * dy;
        if (i % majorCount !== 0 || majorType !== 'lines') {
          dest.push(hLine(0, yCoord, patternWidth, 'minor', minorStyleAsString));
        }
      }

      for (let i = 0; i < cols; i++) {
        const xCoord = i * dx;
        if (i % majorCount !== 0 || majorType !== 'lines') {
          dest.push(vLine(xCoord, 0, patternHeight, 'minor', minorStyleAsString));
        }
      }
    } else if (type === 'dots') {
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const yCoord = i * dy + y;
          const xCoord = j * dx + x;

          if (yCoord >= y + h - 1 || xCoord >= x + w - 1) continue;

          dest.push(...crossAt(xCoord, yCoord, 'minor', minorStyleAsString));
        }
      }
    }

    if (majorType === 'lines') {
      for (let i = 0; i < rows; i++) {
        const yCoord = i * dy;
        if (i % majorCount === 0) {
          dest.push(hLine(0, yCoord, patternWidth, 'major', majorStyleAsString));
        }
      }

      for (let i = 0; i < cols; i++) {
        const xCoord = i * dx;
        if (i % majorCount === 0) {
          dest.push(vLine(xCoord, 0, patternHeight, 'major', majorStyleAsString));
        }
      }
    } else if (majorType === 'dots') {
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          if (i % majorCount !== 0 || j % majorCount !== 0) continue;

          const yCoord = i * dy + y;
          const xCoord = j * dx + x;

          if (yCoord >= y + h - 1 || xCoord >= x + w - 1) continue;

          dest.push(...crossAt(xCoord, yCoord, 'major', majorStyleAsString));
        }
      }
    }

    return svg.g(
      {},
      svg.pattern(
        {
          id: 'grid-pattern',
          width: patternWidth,
          height: patternHeight,
          patternUnits: 'userSpaceOnUse'
        },
        ...dest
      ),
      svg.rect({
        x,
        y,
        width: w,
        height: h,
        fill: 'url(#grid-pattern)'
      })
    );
  }
}
