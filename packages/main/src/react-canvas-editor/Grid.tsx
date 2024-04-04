import { useDiagram } from '../react-app/context/DiagramContext.ts';
import { Diagram } from '../model/diagram.ts';
import { Component, PropChangeManager } from '../base-ui/component.ts';
import * as svg from '../base-ui/vdom-svg.ts';
import { toInlineCSS, VNode } from '../base-ui/vdom.ts';
import { useComponent } from '../react-canvas-viewer/temp/useComponent.temp.ts';

type Type = 'major' | 'minor';

type Props = {
  diagram: Diagram;
};

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

class GridComponent extends Component<Props> {
  private propChangeManager = new PropChangeManager();

  onDetach() {
    this.propChangeManager.cleanup();
  }

  // TODO: This is rendered three times when we change selection, why
  render(props: Props) {
    const diagram = props.diagram;

    // TODO: Should we really pass diagram as props and not in the constructor
    this.propChangeManager.when([diagram], 'add-diagram-change-listener', () => {
      diagram.on('change', () => this.redraw());
      return () => diagram.off('change', this.redraw);
    });

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

/*
const circleAt = (xCoord: number, yCoord: number, type: Type, style: React.CSSProperties) => (
  <circle
    key={`${type}-${xCoord}-${yCoord}`}
    className={`svg-grid svg-grid--${type}`}
    cx={xCoord}
    cy={yCoord}
    r={1}
    style={style}
  />
);

const hline = (
  xCoord: number,
  yCoord: number,
  w: number,
  type: Type,
  style: React.CSSProperties
) => (
  <line
    key={`${type}-h-${yCoord}`}
    className={`svg-grid svg-grid--${type}`}
    x1={xCoord + 1}
    y1={yCoord}
    x2={xCoord + w - 1}
    y2={yCoord}
    style={style}
  />
);

const vline = (
  xCoord: number,
  yCoord: number,
  h: number,
  type: Type,
  style: React.CSSProperties
) => (
  <line
    key={`${type}-v-${xCoord}`}
    className={`svg-grid svg-grid--${type}`}
    x1={xCoord}
    y1={yCoord + 1}
    x2={xCoord}
    y2={yCoord + h - 1}
    style={style}
  />
);

 */

export const Grid = () => {
  const diagram = useDiagram();

  const ref = useComponent<Props, GridComponent, SVGGElement>(() => new GridComponent(), {
    diagram
  });

  return <g ref={ref}></g>;

  /*
  const redraw = useRedraw();
  useEventListener(diagram, 'change', redraw);

  const { x, y, w, h } = diagram.canvas;

  const dx = diagram.props.grid?.size ?? 10;
  const dy = diagram.props.grid?.size ?? 10;

  const majorCount = diagram.props.grid?.majorCount ?? 5;

  const rows = Math.floor(h / dy);
  const cols = Math.floor(w / dx);

  const dest = [];

  if (diagram.props.grid?.enabled === false) {
    return null;
  }

  const majorStyle: CSSProperties = {};
  if (diagram.props.grid?.majorColor) {
    majorStyle.stroke = diagram.props.grid.majorColor;
    majorStyle.fill = diagram.props.grid.majorColor;
  }

  const minorStyle: CSSProperties = {};
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

  return <>{dest}</>;
   */
};
