import { useEventListener } from './hooks/useEventListener';
import { useRedraw } from './hooks/useRedraw';
import React, { useCallback, useEffect, useRef } from 'react';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { useDiagram } from '../application';
import { UserState } from '../UserState';
import { DRAG_DROP_MANAGER } from '@diagram-craft/canvas/dragDropManager';
import { GuideCreateDrag } from '@diagram-craft/canvas/drag/guideDrag';

type Tick = {
  pos: number;
  lbl: string;
};

export const Ruler = ({ orientation }: Props) => {
  const diagram = useDiagram();
  const viewbox = diagram.viewBox;

  const redraw = useRedraw();

  const cursor = useRef<number>(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const cursorRef = useRef<SVGLineElement>(null);
  const selRef = useRef<SVGRectElement>(null);

  const toScreenX = useCallback((x: number) => viewbox.toScreenPoint({ x, y: 0 }).x, [viewbox]);
  const toScreenY = useCallback((y: number) => viewbox.toScreenPoint({ x: 0, y }).y, [viewbox]);

  const updateCursorLine = useCallback(() => {
    if (orientation === 'horizontal') {
      cursorRef.current!.setAttribute('x1', cursor.current.toString());
      cursorRef.current!.setAttribute('x2', cursor.current.toString());
    } else {
      cursorRef.current!.setAttribute('y1', cursor.current.toString());
      cursorRef.current!.setAttribute('y2', cursor.current.toString());
    }
  }, [orientation]);

  const updateSelection = useCallback(() => {
    const bounds = diagram.selectionState.bounds;
    const selRect = selRef.current;
    if (!selRect) return;

    if (orientation === 'horizontal') {
      selRect.setAttribute('x', toScreenX(bounds.x).toString());
      selRect.setAttribute('width', (bounds.w / viewbox.zoomLevel).toString());
    } else {
      selRect.setAttribute('y', toScreenY(bounds.y).toString());
      selRect.setAttribute('height', (bounds.h / viewbox.zoomLevel).toString());
    }
    selRect.style.visibility = diagram.selectionState.isEmpty() ? 'hidden' : 'visible';
  }, [diagram.selectionState, orientation, toScreenX, toScreenY, viewbox.zoomLevel]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;

      DRAG_DROP_MANAGER.initiate(new GuideCreateDrag(diagram, orientation));

      e.preventDefault();
      e.stopPropagation();
    },
    [diagram, orientation]
  );

  useEventListener(diagram, 'diagramChange', () => queueMicrotask(() => redraw()));
  useEventListener(diagram.viewBox, 'viewbox', () => queueMicrotask(() => redraw()));
  useEventListener(diagram.selectionState, 'change', updateSelection);
  useEventListener(UserState.get(), 'change', () => queueMicrotask(() => redraw()));

  const userState = UserState.get();

  useEffect(() => {
    if (!userState.showRulers) return;

    const handler = (e: SVGSVGElementEventMap['mousemove']) => {
      cursor.current = EventHelper.pointWithRespectTo(e, svgRef.current!)[
        orientation === 'horizontal' ? 'x' : 'y'
      ];
      updateCursorLine();
    };

    document.addEventListener('mousemove', handler);
    return () => {
      document.removeEventListener('mousemove', handler);
    };
  }, [userState.showRulers, orientation, updateCursorLine]);

  if (!userState.showRulers) return null;

  const ticks: Tick[] = [];

  if (orientation === 'horizontal') {
    if (diagram.viewBox.isInitialized()) {
      for (let x = diagram.canvas.x; x <= diagram.canvas.x + diagram.canvas.w; x += 10) {
        ticks.push({ pos: toScreenX(x), lbl: x.toString() });
      }
    }

    return (
      <div id={'ruler-h'} className={'cmp-ruler dark-theme'}>
        <svg preserveAspectRatio={'none'} ref={svgRef} onMouseDown={handleMouseDown}>
          {ticks.map((tick, idx) => (
            <line
              key={tick.lbl}
              className={'svg-tick'}
              x1={tick.pos}
              y1={-1}
              x2={tick.pos}
              y2={idx % 5 === 0 ? 6 : 3}
            />
          ))}

          {ticks
            .filter((_, idx) => idx % 10 === 0)
            .map(tick => (
              <text key={tick.lbl} className={'svg-lbl'} x={tick.pos} y={9}>
                {tick.lbl}
              </text>
            ))}

          <rect ref={selRef} className={'svg-selection'} y={-1} height={16} />
          <line ref={cursorRef} className={'svg-cursor'} y1={-1} y2={8} />
        </svg>
      </div>
    );
  } else {
    if (diagram.viewBox.isInitialized()) {
      for (let y = diagram.canvas.y; y <= diagram.canvas.y + diagram.canvas.h; y += 10) {
        ticks.push({ pos: toScreenY(y), lbl: y.toString() });
      }
    }

    return (
      <div id={'ruler-v'} className={'cmp-ruler dark-theme'}>
        <svg preserveAspectRatio={'none'} ref={svgRef} onMouseDown={handleMouseDown}>
          {ticks.map((tick, idx) => (
            <line
              key={tick.lbl}
              className={'svg-tick'}
              x1={-1}
              y1={tick.pos}
              x2={idx % 5 === 0 ? 6 : 3}
              y2={tick.pos}
            />
          ))}

          {ticks
            .filter((_, idx) => idx % 10 === 0)
            .map(tick => (
              <text
                key={tick.lbl}
                className={'svg-lbl'}
                x={9}
                y={tick.pos}
                transform={`rotate(-90,9,${tick.pos})`}
              >
                {tick.lbl}
              </text>
            ))}

          <rect ref={selRef} className={'svg-selection'} x={-1} width={16} />
          <line ref={cursorRef} className={'svg-cursor'} x1={-1} x2={8} />
        </svg>
      </div>
    );
  }
};

type Props = {
  orientation: 'horizontal' | 'vertical';
};
