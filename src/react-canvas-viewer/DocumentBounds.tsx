import { CSSProperties } from 'react';
import { useEventListener } from '../react-app/hooks/useEventListener.ts';
import { useRedraw } from './useRedraw.tsx';
import { useDiagram } from '../react-app/context/DiagramContext.tsx';

export const DocumentBounds = () => {
  const diagram = useDiagram();
  const { x, y, w, h } = diagram.canvas;

  const redraw = useRedraw();
  useEventListener(diagram, 'change', redraw);

  const style: CSSProperties = {};

  if (diagram.props.background?.color) {
    style.fill = diagram.props.background?.color;
  }

  return <rect className="svg-doc-bounds" x={x} y={y} width={w} height={h} style={style} />;
};
