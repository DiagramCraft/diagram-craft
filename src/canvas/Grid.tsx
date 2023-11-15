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

  for (let i = 0; i < rows; i++) {
    const yCoord = i * y + y;
    if (yCoord >= diagram.size.h - 1) continue;

    gridLines.push(
      <line
        key={`row-${i}`}
        x1={1}
        y1={yCoord}
        x2={w - 1}
        y2={yCoord}
        className={'grid ' + (i % 5 === 0 ? 'grid--major' : 'grid--minor')}
      />
    );
  }

  for (let i = 0; i < cols; i++) {
    const xCoord = i * x + x;
    if (xCoord >= diagram.size.w - 1) continue;
    gridLines.push(
      <line
        key={`col-${i}`}
        x1={xCoord}
        y1={1}
        x2={xCoord}
        y2={h - 1}
        className={'grid ' + (i % 5 === 0 ? 'grid--major' : 'grid--minor')}
      />
    );
  }

  return <>{gridLines}</>;
};

type Props = {
  diagram: Diagram;
};
