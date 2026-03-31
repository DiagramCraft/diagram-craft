import { useEventListener } from './hooks/useEventListener';
import { useRedraw } from './hooks/useRedraw';
import React, { useCallback, useEffect, useRef } from 'react';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { useDiagram } from '../application';
import { UserState } from '../UserState';
import { DRAG_DROP_MANAGER } from '@diagram-craft/canvas/dragDropManager';
import { GuideCreateDrag } from '@diagram-craft/canvas/drag/guideDrag';
import { round } from '@diagram-craft/utils/math';
import styles from './Ruler.module.css';

type Tick = {
  pos: number;
  lbl: string;
  value: number;
};

const roundTicks = (ticks: Tick[]) => {
  const min = ticks.at(0)?.pos;
  const max = ticks.at(-1)?.pos;
  if (min === undefined || max === undefined) return;

  const delta = max - min;
  const stepSize = delta / ticks.length;

  // Calculate decimals needed: if stepSize is 0.1, we need 1 decimal; if 0.01, we need 2, etc.
  const numberOfDecimals = stepSize >= 1 ? 0 : Math.max(0, Math.ceil(-Math.log10(stepSize)));

  for (let i = 0; i < ticks.length; i++) {
    ticks[i]!.lbl = round(ticks[i]!.value, numberOfDecimals).toString();
  }
};

export const Ruler = ({ orientation, id }: Props) => {
  const diagram = useDiagram();
  const viewbox = diagram.viewBox;

  const redraw = useRedraw();

  const cursor = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selRef = useRef<SVGRectElement>(null);

  const toScreenX = useCallback((x: number) => viewbox.toScreenPoint({ x, y: 0 }).x, [viewbox]);
  const toScreenY = useCallback((y: number) => viewbox.toScreenPoint({ x: 0, y }).y, [viewbox]);

  const updateSelection = useCallback(() => {
    const bounds = diagram.selection.bounds;
    const selRect = selRef.current;
    if (!selRect) return;

    if (orientation === 'horizontal') {
      selRect.setAttribute('x', toScreenX(bounds.x).toString());
      selRect.setAttribute('width', (bounds.w / viewbox.zoomLevel).toString());
    } else {
      selRect.setAttribute('y', toScreenY(bounds.y).toString());
      selRect.setAttribute('height', (bounds.h / viewbox.zoomLevel).toString());
    }
    selRect.style.visibility = diagram.selection.isEmpty() ? 'hidden' : 'visible';
  }, [diagram.selection, orientation, toScreenX, toScreenY, viewbox.zoomLevel]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;

      DRAG_DROP_MANAGER.initiate(new GuideCreateDrag(diagram, orientation));

      e.preventDefault();
      e.stopPropagation();
    },
    [diagram, orientation]
  );

  // Draw ticks directly onto the canvas — no React re-render needed
  const drawTicks = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio ?? 1;
    const rect = canvas.getBoundingClientRect();
    const displayW = rect.width;
    const displayH = rect.height;

    // Resize backing store only when dimensions actually changed
    const backingW = Math.round(displayW * dpr);
    const backingH = Math.round(displayH * dpr);
    if (canvas.width !== backingW || canvas.height !== backingH) {
      canvas.width = backingW;
      canvas.height = backingH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayW, displayH);

    if (!viewbox.isInitialized()) return;

    // Read colors from CSS custom properties set on the canvas element
    const cs = getComputedStyle(canvas);
    const tickColor = cs.getPropertyValue('--base-fg-more-dim').trim() || '#666';
    const textColor = cs.getPropertyValue('--base-fg-dim').trim() || '#999';
    const accentColor = cs.getPropertyValue('--accent-fg').trim() || '#4af';

    ctx.lineWidth = 1;

    const ticks: Tick[] = [];

    if (orientation === 'horizontal') {
      if (viewbox.isInitialized()) {
        for (let x = diagram.bounds.x; x <= diagram.bounds.x + diagram.bounds.w; x += 10) {
          ticks.push({ pos: toScreenX(x), lbl: x.toString(), value: x });
        }
      }
      roundTicks(ticks);

      ctx.strokeStyle = tickColor;
      for (let i = 0; i < ticks.length; i++) {
        const tick = ticks[i]!;
        const tickH = i % 5 === 0 ? 6 : 3;
        ctx.beginPath();
        ctx.moveTo(Math.round(tick.pos) + 0.5, 0);
        ctx.lineTo(Math.round(tick.pos) + 0.5, tickH);
        ctx.stroke();
      }

      ctx.fillStyle = textColor;
      ctx.font = '6px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      for (let i = 0; i < ticks.length; i++) {
        if (i % 10 === 0) {
          ctx.fillText(ticks[i]!.lbl, ticks[i]!.pos, 9);
        }
      }
    } else {
      if (viewbox.isInitialized()) {
        for (let y = diagram.bounds.y; y <= diagram.bounds.y + diagram.bounds.h; y += 10) {
          ticks.push({ pos: toScreenY(y), lbl: y.toString(), value: y });
        }
      }
      roundTicks(ticks);

      ctx.strokeStyle = tickColor;
      for (let i = 0; i < ticks.length; i++) {
        const tick = ticks[i]!;
        const tickW = i % 5 === 0 ? 6 : 3;
        ctx.beginPath();
        ctx.moveTo(0, Math.round(tick.pos) + 0.5);
        ctx.lineTo(tickW, Math.round(tick.pos) + 0.5);
        ctx.stroke();
      }

      ctx.fillStyle = textColor;
      ctx.font = '6px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      for (let i = 0; i < ticks.length; i++) {
        if (i % 10 === 0) {
          ctx.save();
          ctx.translate(9, ticks[i]!.pos);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(ticks[i]!.lbl, 0, 0);
          ctx.restore();
        }
      }
    }

    // Redraw the cursor indicator on top
    ctx.strokeStyle = accentColor;
    ctx.beginPath();
    if (orientation === 'horizontal') {
      const x = Math.round(cursor.current) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 8);
    } else {
      const y = Math.round(cursor.current) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(8, y);
    }
    ctx.stroke();
  }, [diagram.bounds, orientation, toScreenX, toScreenY, viewbox]);

  // Viewbox changes (pan/zoom) redraw the canvas directly — no React re-render
  useEventListener(diagram.viewBox, 'viewbox', drawTicks);

  // Structural changes (diagram edited, user state) still go through React
  useEventListener(diagram, 'diagramChange', () => queueMicrotask(() => redraw()));
  useEventListener(diagram.selection, 'change', updateSelection);
  useEventListener(UserState.get(), 'change', () => queueMicrotask(() => redraw()));

  // Draw after every React render (covers initial mount, resize, zoom, theme changes)
  useEffect(() => drawTicks());

  const userState = UserState.get();

  useEffect(() => {
    if (!userState.showRulers) return;

    const handler = (e: MouseEvent) => {
      cursor.current = EventHelper.pointWithRespectTo(e, canvasRef.current!)[
        orientation === 'horizontal' ? 'x' : 'y'
      ];
      // Redraw ticks so the cursor indicator stays current without a React re-render
      drawTicks();
    };

    document.addEventListener('mousemove', handler);
    return () => {
      document.removeEventListener('mousemove', handler);
    };
  }, [userState.showRulers, orientation, drawTicks]);

  if (!userState.showRulers) return null;

  if (orientation === 'horizontal') {
    return (
      <div id={id} className={`${styles.icRuler} dark-theme`} data-orientation={'horizontal'}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          onMouseDown={handleMouseDown}
        >
          <rect ref={selRef} className={styles.eSvgSelection} y={-1} height={16} />
        </svg>
      </div>
    );
  } else {
    return (
      <div id={id} className={`${styles.icRuler} dark-theme`} data-orientation={'vertical'}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          onMouseDown={handleMouseDown}
        >
          <rect ref={selRef} className={styles.eSvgSelection} x={-1} width={16} />
        </svg>
      </div>
    );
  }
};

type Props = {
  id?: string;
  orientation: 'horizontal' | 'vertical';
};
