import { Diagram } from '../model-viewer/diagram.ts';

export const DocumentBounds = (props: Props) => {
  const { diagram } = props;
  const { w, h } = diagram.canvas.size;
  const { x, y } = diagram.canvas.pos;

  return (
    <>
      <rect className="svg-doc-bounds" x={x} y={y} width={w} height={h} />
    </>
  );
};

type Props = {
  diagram: Diagram;
};
