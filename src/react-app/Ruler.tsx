import { useEventListener } from './hooks/useEventListener.ts';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';
import React, { useEffect, useRef, useState } from 'react';
import { EventHelper } from '../base-ui/eventHelper.ts';
import { useDiagram } from './context/DiagramContext.tsx';

type Tick = {
  coord: number;
  label: string;
};

// TODO: Can we draw in only one direction, and then simply rotate the SVG?
export const Ruler = ({ canvasRef, orientation }: Props) => {
  const diagram = useDiagram();
  const viewbox = diagram.viewBox;

  const redraw = useRedraw();
  const svgRef = useRef<SVGSVGElement>(null);

  const [cursor, setCursor] = useState(0);

  useEventListener(diagram, 'change', redraw);
  useEventListener(diagram.viewBox, 'viewbox', redraw);
  useEventListener(diagram.selectionState, 'change', redraw);

  // TODO: It's a bit silly to repaint the whole ruler on every mouse move.
  useEffect(() => {
    if (diagram.props.ruler?.enabled === false) return;

    const handler = (e: SVGSVGElementEventMap['mousemove']) => {
      setCursor(
        EventHelper.pointWithRespectTo(e, svgRef.current!)[orientation === 'horizontal' ? 'x' : 'y']
      );
    };

    const currentCanvas = canvasRef.current;
    if (!currentCanvas) return;

    currentCanvas.addEventListener('mousemove', handler);
    return () => {
      currentCanvas.removeEventListener('mousemove', handler);
    };
  }, [diagram.props.ruler?.enabled, orientation, canvasRef, viewbox]);

  if (diagram.props.ruler?.enabled === false) return null;

  const ticks: Tick[] = [];

  if (orientation === 'horizontal') {
    const toScreenX = (x: number) => viewbox.toScreenPoint({ x, y: 0 }).x;

    for (let x = diagram.canvas.x; x <= diagram.canvas.x + diagram.canvas.w; x += 10) {
      ticks.push({ coord: toScreenX(x), label: x.toString() });
    }

    return (
      <div id={'ruler-h'} className={'cmp-ruler'}>
        <svg preserveAspectRatio={'none'} ref={svgRef}>
          {ticks.map((tick, idx) => (
            <line
              key={tick.label}
              className={'svg-tick'}
              x1={tick.coord}
              y1={-1}
              x2={tick.coord}
              y2={idx % 5 === 0 ? 6 : 3}
            />
          ))}

          {ticks
            .filter((_, idx) => idx % 10 === 0)
            .map(tick => (
              <text key={tick.label} className={'svg-lbl'} x={tick.coord} y={9}>
                {tick.label}
              </text>
            ))}

          {!diagram.selectionState.isEmpty() && (
            <rect
              className={'svg-selection'}
              x={toScreenX(diagram.selectionState.bounds.x)}
              y={-1}
              width={diagram.selectionState.bounds.w / viewbox.zoomLevel}
              height={16}
            />
          )}

          <line className={'svg-cursor'} x1={cursor} y1={-1} x2={cursor} y2={8} />
        </svg>
      </div>
    );
  } else {
    const toScreenY = (y: number) => viewbox.toScreenPoint({ x: 0, y }).y;

    for (let y = diagram.canvas.y; y <= diagram.canvas.y + diagram.canvas.h; y += 10) {
      ticks.push({ coord: toScreenY(y), label: y.toString() });
    }

    return (
      <div id={'ruler-v'} className={'cmp-ruler'}>
        <svg preserveAspectRatio={'none'} ref={svgRef}>
          {ticks.map((tick, idx) => (
            <line
              key={tick.label}
              className={'svg-tick'}
              x1={-1}
              y1={tick.coord}
              x2={idx % 5 === 0 ? 6 : 3}
              y2={tick.coord}
            />
          ))}

          {ticks
            .filter((_, idx) => idx % 10 === 0)
            .map(tick => (
              <text
                key={tick.label}
                className={'svg-lbl'}
                x={9}
                y={tick.coord}
                transform={`rotate(-90,9,${tick.coord})`}
              >
                {tick.label}
              </text>
            ))}

          {!diagram.selectionState.isEmpty() && (
            <rect
              className={'svg-selection'}
              x={-1}
              y={toScreenY(diagram.selectionState.bounds.y)}
              height={diagram.selectionState.bounds.h / viewbox.zoomLevel}
              width={16}
            />
          )}

          <line className={'svg-cursor'} x1={-1} y1={cursor} x2={8} y2={cursor} />
        </svg>
      </div>
    );
  }
};

type Props = {
  canvasRef: React.RefObject<SVGSVGElement>;
  orientation: 'horizontal' | 'vertical';
};
