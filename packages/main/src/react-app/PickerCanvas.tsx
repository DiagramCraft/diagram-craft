import { Canvas } from '@diagram-craft/canvas-react/Canvas';
import { Diagram } from '@diagram-craft/model/diagram';
import React, { useCallback, useRef, useState } from 'react';
import { Point } from '@diagram-craft/geometry/point';
import { useApplication, useDiagram } from '../application';
import {
  StaticCanvasComponent,
  StaticCanvasProps
} from '@diagram-craft/canvas/canvas/StaticCanvasComponent';
import { createPortal } from 'react-dom';

const canvasFactory = () => new StaticCanvasComponent();

export const PickerCanvas = (props: PickerCanvasProps) => {
  const application = useApplication();
  const $d = useDiagram();
  const diagram = props.diagram;
  const timeout = useRef<number | null>(null);
  const [hover, setHover] = useState<Point | undefined>(undefined);
  const r = useRef<string>('');

  const onMouseOver = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = { x: rect.x, y: rect.y };

    // Note: this is a hack to ensure the event is not re-triggered as the object is dropped on the canvas
    const hash = `${e.nativeEvent.screenX},${e.nativeEvent.screenY},${e.nativeEvent.offsetX},${e.nativeEvent.offsetY}`;
    if (r.current === hash) return;
    r.current = hash;

    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    timeout.current = window.setTimeout(() => {
      setHover(p);
    }, 100);
  };

  const onMouseOut = useCallback(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    setHover(undefined);
  }, []);

  if (!props.showHover && hover) {
    setHover(undefined);
  }

  // TODO: We should use default cursor instead of move cursor when disabled
  const isRuleLayer = $d.activeLayer.type === 'rule';
  return (
    <div
      onMouseOver={isRuleLayer ? () => {} : e => onMouseOver(e)}
      onMouseLeave={isRuleLayer ? () => {} : onMouseOut}
      style={{
        'filter': isRuleLayer ? 'opacity(0.3)' : 'none',
        // @ts-expect-error valid use
        '--container-outline': '#d5d5d4'
      }}
      className={props.scaleStrokes === undefined || props.scaleStrokes ? 'scale-strokes' : ''}
      onPointerDown={isRuleLayer ? () => {} : e => props.onMouseDown?.(e.nativeEvent) ?? (() => {})}
    >
      {hover &&
        props.showHover &&
        createPortal(
          <div
            style={{
              position: 'absolute',
              left: hover.x + 40,
              top: hover.y,
              width: 100,
              height: 110,
              zIndex: 200,
              background: 'var(--canvas-bg)',
              borderRadius: '4px',
              lineHeight: '0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'top',
              color: 'var(--canvas-fg)',
              fontSize: '11px',
              paddingTop: '0.75rem',
              paddingBottom: '0.75rem',
              boxShadow:
                'hsl(206 22% 7% / 35%) 0px 10px 38px -10px, hsl(206 22% 7% / 20%) 0px 10px 20px -15px'
            }}
          >
            <Canvas<StaticCanvasComponent, StaticCanvasProps>
              id={`picker-canvas-portal-${props.diagram.id}`}
              context={application}
              width={80}
              height={80}
              onClick={() => {}}
              diagram={diagram}
              viewbox={props.diagram.viewBox.svgViewboxString}
              canvasFactory={canvasFactory}
            />

            <div
              style={{
                lineHeight: '14px',
                justifySelf: 'flex-end',
                marginTop: 'auto',
                textAlign: 'center'
              }}
            >
              {props.name}
            </div>
          </div>,
          document.body
        )}

      <Canvas<StaticCanvasComponent, StaticCanvasProps>
        id={`picker-canvas-${props.diagram.id}`}
        context={application}
        width={props.size ?? 40}
        height={props.size ?? 40}
        diagram={diagram}
        viewbox={`${props.diagram.viewBox.svgViewboxString}`}
        canvasFactory={canvasFactory}
      />
    </div>
  );
};

type PickerCanvasProps = {
  diagram: Diagram;
  size?: number;
  diagramWidth?: number;
  diagramHeight?: number;
  showHover?: boolean;
  name?: string;
  onMouseDown?: (e: MouseEvent) => void;
  scaleStrokes?: boolean;
};
