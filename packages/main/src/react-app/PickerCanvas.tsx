import { Canvas } from '@diagram-craft/canvas-react/Canvas';
import { Diagram } from '@diagram-craft/model/diagram';
import { useCallback, useRef, useState } from 'react';
import * as Portal from '@radix-ui/react-portal';
import { Point } from '@diagram-craft/geometry/point';

export const PickerCanvas = (props: PickerCanvasProps) => {
  const diagram = props.diagram;
  const timeout = useRef<number | null>(null);
  const [hover, setHover] = useState<Point | undefined>(undefined);

  const onMouseOver = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = { x: rect.x, y: rect.y };

    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    timeout.current = window.setTimeout(() => {
      setHover(p);
    }, 100);
  }, []);

  const onMouseOut = useCallback(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    setHover(undefined);
  }, []);

  return (
    <div onMouseEnter={e => onMouseOver(e)} onMouseLeave={onMouseOut} style={{}}>
      {hover && (
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
              viewBox={`0 0 ${props.diagramWidth} ${props.diagramHeight}`}
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
        viewBox={`0 0 ${props.diagramWidth ?? props.width} ${props.diagramHeight ?? props.height}`}
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
  name?: string;
};
