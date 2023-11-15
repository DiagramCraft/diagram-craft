import { Diagram } from '../model-viewer/diagram.ts';

export const Grid = (props: Props) => {
  const { diagram } = props;
  const { grid } = diagram;
  const dimensions = diagram.viewBox.dimensions;
  const { w, h } = dimensions;
  const { x, y } = grid;

  const rows = Math.floor(h / y);
  const cols = Math.floor(w / x);

  const gridLines = [];

  for (let i = 0; i <= rows; i++) {
    const yCoord = i * y;
    gridLines.push(
      <line
        key={`row-${i}`}
        x1={0}
        y1={yCoord}
        x2={w}
        y2={yCoord}
        stroke={i % 5 === 0 ? '#dedede' : '#eeeeee'}
        strokeWidth={1}
      />
    );
  }

  for (let i = 0; i <= cols; i++) {
    const xCoord = i * x;
    gridLines.push(
      <line
        key={`col-${i}`}
        x1={xCoord}
        y1={0}
        x2={xCoord}
        y2={h}
        stroke={i % 5 === 0 ? '#dedede' : '#eeeeee'}
        strokeWidth={1}
      />
    );
  }

  return (
    <svg width={w} height={h}>
      {gridLines}
    </svg>
  );
};

type Props = {
  diagram: Diagram;
};
