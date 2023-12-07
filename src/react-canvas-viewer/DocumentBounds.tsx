import { Diagram } from '../model-viewer/diagram.ts';
import { CSSProperties } from 'react';
import { useEventListener } from '../react-app/hooks/useEventListener.ts';
import { useRedraw } from './useRedraw.tsx';

export const DocumentBounds = (props: Props) => {
  const { diagram } = props;
  const { w, h } = diagram.canvas.size;
  const { x, y } = diagram.canvas.pos;

  const redraw = useRedraw();
  useEventListener('canvaschange', redraw, props.diagram);

  const style: CSSProperties = {};

  if (props.diagram.props.background?.color) {
    style.fill = props.diagram.props.background?.color;
  }

  return (
    <>
      <rect className="svg-doc-bounds" x={x} y={y} width={w} height={h} style={style} />
    </>
  );
};

type Props = {
  diagram: Diagram;
};
