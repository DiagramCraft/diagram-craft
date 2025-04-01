import { Canvas } from '@diagram-craft/canvas-react/Canvas';
import { Diagram } from '@diagram-craft/model/diagram';
import React, { useCallback, useRef, useState } from 'react';
import * as Portal from '@radix-ui/react-portal';
import { Point } from '@diagram-craft/geometry/point';
import { useApplication } from '../application';
import { CanvasComponent, CanvasProps } from '@diagram-craft/canvas/CanvasComponent';

class PickerCanvasComponent extends CanvasComponent {
  protected getMemoKey(props: CanvasProps): unknown | undefined {
    return {
      id: props.diagram.id,
      width: props.width,
      height: props.height,
      viewBox: props.viewBox,
      onClick: props.onClick,
      className: props.className
    };
  }
}
export const PickerCanvas = (props: PickerCanvasProps) => {
  const application = useApplication();
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
    <div
      onMouseOver={e => onMouseOver(e)}
      onMouseLeave={onMouseOut}
      style={{}}
      /* TODO: This is a bit of a hack to not interfere with onMouseDown used in CanvasComponent */
      // @ts-ignore
      onPointerDown={props.onMouseDown ?? (() => {})}
    >
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
              id={`picker-canvas-portal-${props.diagram.id}`}
              context={application}
              width={80}
              height={80}
              onClick={() => {}}
              diagram={diagram}
              viewBox={props.diagram.viewBox.svgViewboxString}
              canvasFactory={() => new PickerCanvasComponent()}
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
          </div>
        </Portal.Root>
      )}

      <Canvas
        id={`picker-canvas-${props.diagram.id}`}
        context={application}
        width={props.width ?? 40}
        height={props.height ?? 40}
        onClick={props.onClick}
        diagram={diagram}
        viewBox={`${props.diagram.viewBox.svgViewboxString}`}
        canvasFactory={() => new PickerCanvasComponent()}
      />
    </div>
  );
};

type PickerCanvasProps = {
  diagram: Diagram;
  width?: number;
  height?: number;
  onClick?: (e: MouseEvent) => void;
  diagramWidth?: number;
  diagramHeight?: number;
  showHover?: boolean;
  name?: string;
  onMouseDown?: (e: MouseEvent) => void;
};
