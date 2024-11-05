import { Canvas } from '@diagram-craft/canvas-react/Canvas';
import { Diagram } from '@diagram-craft/model/diagram';
import React, { useCallback, useRef, useState } from 'react';
import * as Portal from '@radix-ui/react-portal';
import { Point } from '@diagram-craft/geometry/point';
import { Modifiers } from '@diagram-craft/canvas/dragDropManager';

export const PickerCanvas = (props: PickerCanvasProps) => {
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

  return (
    <div onMouseOver={e => onMouseOver(e)} onMouseLeave={onMouseOut} style={{}}>
      {hover && props.showHover && (
        <Portal.Root>
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
            <Canvas
              width={80}
              height={80}
              onClick={() => {}}
              diagram={diagram}
              viewBox={props.diagram.viewBox.svgViewboxString}
            />

            <div style={{ lineHeight: '14px', justifySelf: 'flex-end', marginTop: 'auto' }}>
              {props.name}
            </div>
          </div>
        </Portal.Root>
      )}

      <Canvas
        width={props.width ?? 40}
        height={props.height ?? 40}
        onClick={props.onClick}
        diagram={diagram}
        viewBox={`${props.diagram.viewBox.svgViewboxString}`}
        onMouseDown={props.onMouseDown}
      />
    </div>
  );
};

type PickerCanvasProps = {
  diagram: Diagram;
  width?: string | number;
  height?: string | number;
  onClick?: (e: MouseEvent) => void;
  diagramWidth?: number;
  diagramHeight?: number;
  showHover?: boolean;
  name?: string;
  onMouseDown?: (_id: string, _coord: Point, _modifiers: Modifiers) => void;
};
