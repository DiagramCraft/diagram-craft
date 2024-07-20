import { Component, createEffect } from '../component/component';
import * as svg from '../component/vdom-svg';
import { toInlineCSS, VNode } from '../component/vdom';
import { CanvasState } from '../EditableCanvasComponent';
import { Zoom } from './zoom';
import { debounce } from '@diagram-craft/utils/debounce';
import { ViewboxEvents } from '@diagram-craft/model/viewBox';

const DEFAULT_MAJOR_COLOR = '#e7e5e4';
const DEFAULT_MINOR_COLOR = '#f5f5f4';

type Type = 'major' | 'minor';

const circleAt = (xCoord: number, yCoord: number, type: Type, style: string, z: Zoom) => {
  return svg.circle({
    class: `svg-grid svg-grid--${type}`,
    cx: xCoord,
    cy: yCoord,
    r: z.str(1),
    style
  });
};

const hLine = (xCoord: number, yCoord: number, w: number, type: Type, style: string) => {
  return svg.line({
    class: `svg-grid svg-grid--${type}`,
    x1: xCoord + 1,
    y1: yCoord,
    x2: xCoord + w - 1,
    y2: yCoord,
    style
  });
};

const vLine = (xCoord: number, yCoord: number, h: number, type: Type, style: string) => {
  return svg.line({
    class: `svg-grid svg-grid--${type}`,
    x1: xCoord,
    y1: yCoord + 1,
    x2: xCoord,
    y2: yCoord + h - 1,
    style
  });
};

export class GridComponent extends Component<CanvasState> {
  debouncedRedraw = debounce(() => {
    this.redraw();
  }, 1000);

  render(props: CanvasState) {
    const diagram = props.diagram;
    const z = new Zoom(diagram.viewBox.zoomLevel);

    createEffect(() => {
      const redrawIfNeeded = ({ type }: ViewboxEvents['viewbox']) => {
        if (type === 'pan') return;
        if (diagram.props.grid?.majorType === 'dots' || diagram.props.grid?.type === 'dots') {
          this.debouncedRedraw();
        }
      };
      diagram.viewBox.on('viewbox', redrawIfNeeded);
      return () => {
        diagram.viewBox.off('viewbox', redrawIfNeeded);
      };
    }, [diagram, props]);

    // Note: we don't need to listen to diagram change events here, because this is handled
    //       through a full redraw of EditableCanvas when diagram changes.

    const { x, y, w, h } = diagram.canvas;

    const dx = diagram.props.grid?.size ?? 10;
    const dy = diagram.props.grid?.size ?? 10;

    const majorCount = diagram.props.grid?.majorCount ?? 4;

    const rows = Math.floor(h / dy);
    const cols = Math.floor(w / dx);

    if (diagram.props.grid?.enabled === false) {
      return svg.g({});
    }

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
        const yCoord = i * dy + y;
        if (yCoord >= y + h - 1) continue;
        if (yCoord === y || yCoord === y + h - 1) continue;

        if (i % majorCount !== 0 || majorType !== 'lines') {
          dest.push(hLine(x, yCoord, w, 'minor', minorStyleAsString));
        }
      }

      for (let i = 0; i < cols; i++) {
        const xCoord = i * dx + x;
        if (xCoord >= x + w - 1) continue;
        if (xCoord === x || xCoord === x + w - 1) continue;

        if (i % majorCount !== 0 || majorType !== 'lines') {
          dest.push(vLine(xCoord, y, h, 'minor', minorStyleAsString));
        }
      }
    } else if (type === 'dots') {
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const yCoord = i * dy + y;
          const xCoord = j * dx + x;

          if (yCoord >= y + h - 1 || xCoord >= x + w - 1) continue;

          dest.push(circleAt(xCoord, yCoord, 'minor', minorStyleAsString, z));
        }
      }
    }

    if (majorType === 'lines') {
      for (let i = 0; i < rows; i++) {
        const yCoord = i * dy + y;
        if (yCoord >= y + h - 1) continue;
        if (yCoord === y || yCoord === y + h - 1) continue;

        if (i % majorCount === 0) {
          dest.push(hLine(x, yCoord, w, 'major', majorStyleAsString));
        }
      }

      for (let i = 0; i < cols; i++) {
        const xCoord = i * dx + x;
        if (xCoord >= x + w - 1) continue;
        if (xCoord === x || xCoord === x + w - 1) continue;

        if (i % majorCount === 0) {
          dest.push(vLine(xCoord, y, h, 'major', majorStyleAsString));
        }
      }
    } else if (majorType === 'dots') {
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          if (i % majorCount !== 0 || j % majorCount !== 0) continue;

          const yCoord = i * dy + y;
          const xCoord = j * dx + x;

          if (yCoord >= y + h - 1 || xCoord >= x + w - 1) continue;

          dest.push(circleAt(xCoord, yCoord, 'major', majorStyleAsString, z));
        }
      }
    }

    return svg.g({}, ...dest);
  }
}
