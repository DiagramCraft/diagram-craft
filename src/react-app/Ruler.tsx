import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { useEventListener } from './hooks/useEventListener.ts';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';
import { useRef } from 'react';

type Tick = {
  coord: number;
  label: string;
};

export const Ruler = (props: Props) => {
  const redraw = useRedraw();
  const viewbox = props.diagram.viewBox;
  const svgRef = useRef<SVGSVGElement>(null);

  useEventListener('viewbox', redraw, props.diagram.viewBox);
  useEventListener('canvaschanged', redraw, props.diagram);
  useEventListener('change', redraw, props.diagram.selectionState);

  if (props.diagram.props.ruler?.enabled === false) {
    return null;
  }

  const ticks: Tick[] = [];

  if (props.orientation === 'horizontal') {
    for (
      let x = props.diagram.canvas.pos.x;
      x <= props.diagram.canvas.pos.x + props.diagram.canvas.size.w;
      x += 10
    ) {
      ticks.push({
        coord: viewbox.toScreenPoint({ x, y: 0 }).x,
        label: x.toString()
      });
    }

    return (
      <div id={'ruler-h'} className={'cmp-ruler'}>
        <svg preserveAspectRatio={'none'} ref={svgRef}>
          {ticks.map((tick, idx) => (
            <line
              key={tick.label}
              x1={tick.coord}
              y1={-1}
              x2={tick.coord}
              y2={idx % 5 === 0 ? 6 : 3}
              style={{ stroke: 'var(--tertiary-fg)' }}
              strokeWidth="1"
            />
          ))}

          {ticks
            .filter((_, idx) => idx % 10 === 0)
            .map(tick => (
              <text className={'svg-lbl'} x={tick.coord} y={9}>
                {tick.label}
              </text>
            ))}

          {props.diagram.selectionState.elements.length > 0 && (
            <>
              <rect
                x={
                  viewbox.toScreenPoint({
                    x: props.diagram.selectionState.elements[0].bounds.pos.x,
                    y: 0
                  }).x
                }
                y={-1}
                width={props.diagram.selectionState.elements[0].bounds.size.w / viewbox.zoomLevel}
                height={16}
                style={{ stroke: 'var(--tertiary-fg)', fill: 'rgba(0, 0, 0, 0.25)' }}
                strokeWidth="1"
              />
            </>
          )}
        </svg>
      </div>
    );
  } else {
    for (
      let y = props.diagram.canvas.pos.y;
      y <= props.diagram.canvas.pos.y + props.diagram.canvas.size.h;
      y += 10
    ) {
      ticks.push({
        coord: viewbox.toScreenPoint({ x: 0, y }).y,
        label: y.toString()
      });
    }

    return (
      <div id={'ruler-v'} className={'cmp-ruler'}>
        <svg preserveAspectRatio={'none'} ref={svgRef}>
          {ticks.map((tick, idx) => (
            <line
              key={tick.label}
              x1={-1}
              y1={tick.coord}
              x2={idx % 5 === 0 ? 6 : 3}
              y2={tick.coord}
              style={{ stroke: 'var(--tertiary-fg)' }}
              strokeWidth="1"
            />
          ))}

          {ticks
            .filter((_, idx) => idx % 10 === 0)
            .map(tick => (
              <text
                className={'svg-lbl'}
                x={9}
                y={tick.coord}
                transform={`rotate(-90,9,${tick.coord})`}
              >
                {tick.label}
              </text>
            ))}

          {props.diagram.selectionState.elements.length > 0 && (
            <>
              <rect
                x={-1}
                y={
                  viewbox.toScreenPoint({
                    x: 0,
                    y: props.diagram.selectionState.elements[0].bounds.pos.y
                  }).y
                }
                height={props.diagram.selectionState.elements[0].bounds.size.h / viewbox.zoomLevel}
                width={16}
                style={{ stroke: 'var(--tertiary-fg)', fill: 'rgba(0, 0, 0, 0.25)' }}
                strokeWidth="1"
              />
            </>
          )}
        </svg>
      </div>
    );
  }
};

type Props = {
  diagram: EditableDiagram;
  orientation: 'horizontal' | 'vertical';
};
