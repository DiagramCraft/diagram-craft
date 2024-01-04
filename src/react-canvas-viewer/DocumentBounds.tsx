import { Diagram } from '../model/diagram.ts';
import { CSSProperties } from 'react';
import { useEventListener } from '../react-app/hooks/useEventListener.ts';
import { useRedraw } from './useRedraw.tsx';

export const DocumentBounds = (props: Props) => {
  const { diagram } = props;
  const { x, y, w, h } = diagram.canvas;

  const redraw = useRedraw();
  useEventListener(props.diagram, 'change', redraw);

  const style: CSSProperties = {};

  if (props.diagram.props.background?.color) {
    style.fill = props.diagram.props.background?.color;
  }

  return <rect className="svg-doc-bounds" x={x} y={y} width={w} height={h} style={style} />;
};

type Props = {
  diagram: Diagram;
};
