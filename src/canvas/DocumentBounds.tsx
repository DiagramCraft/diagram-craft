import { Diagram } from '../model-viewer/diagram.ts';

export const DocumentBounds = (props: Props) => {
  const { diagram } = props;
  const { w, h } = diagram.size;

  return (
    <>
      <rect className="documentBounds" x={0} y={0} width={w} height={h} />
    </>
  );
};

type Props = {
  diagram: Diagram;
};
