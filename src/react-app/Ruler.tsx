import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { useEventListener } from './hooks/useEventListener.ts';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';
import React, { useEffect, useRef, useState } from 'react';
import { EventHelper } from '../base-ui/eventHelper.ts';

type Tick = {
  coord: number;
  label: string;
};

export const Ruler = ({ diagram, canvasRef, orientation }: Props) => {
  const redraw = useRedraw();
  const viewbox = diagram.viewBox;
  const svgRef = useRef<SVGSVGElement>(null);

  const [cursor, setCursor] = useState(0);

  useEventListener(diagram, 'canvaschanged', redraw);
  useEventListener(diagram.viewBox, 'viewbox', redraw);
  useEventListener(diagram.selectionState, 'change', redraw);

  useEffect(() => {
    const handler = (e: SVGSVGElementEventMap['mousemove']) => {
      setCursor(
        EventHelper.pointWithRespectTo(e, svgRef.current!)[orientation === 'horizontal' ? 'x' : 'y']
      );
    };

    const currentCanvas = canvasRef.current;

    if (!currentCanvas) return;
    if (diagram.props.ruler?.enabled === false) return;

    currentCanvas.addEventListener('mousemove', handler);
    return () => {
      currentCanvas.removeEventListener('mousemove', handler);
    };
  }, [diagram.props.ruler?.enabled, orientation, canvasRef, viewbox]);

  if (diagram.props.ruler?.enabled === false) {
    return null;
  }

  const ticks: Tick[] = [];

  const toScreenX = (x: number) => viewbox.toScreenPoint({ x, y: 0 }).x;

  const toScreenY = (y: number) => viewbox.toScreenPoint({ x: 0, y }).y;

  if (orientation === 'horizontal') {
    for (let x = diagram.canvas.pos.x; x <= diagram.canvas.pos.x + diagram.canvas.size.w; x += 10) {
      ticks.push({
        coord: toScreenX(x),
        label: x.toString()
      });
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
              x={toScreenX(diagram.selectionState.bounds.pos.x)}
              y={-1}
              width={diagram.selectionState.bounds.size.w / viewbox.zoomLevel}
              height={16}
            />
          )}

          <line className={'svg-cursor'} x1={cursor} y1={-1} x2={cursor} y2={8} />
        </svg>
      </div>
    );
  } else {
    for (let y = diagram.canvas.pos.y; y <= diagram.canvas.pos.y + diagram.canvas.size.h; y += 10) {
      ticks.push({
        coord: toScreenY(y),
        label: y.toString()
      });
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
              y={toScreenY(diagram.selectionState.bounds.pos.y)}
              height={diagram.selectionState.bounds.size.h / viewbox.zoomLevel}
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
  diagram: EditableDiagram;
  orientation: 'horizontal' | 'vertical';
};
