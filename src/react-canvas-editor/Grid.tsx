import { Diagram } from '../model-viewer/diagram.ts';

export const Grid = (props: Props) => {
  const { diagram } = props;
  const { grid } = diagram;
  const { w, h } = diagram.canvas.size;
  const { x, y } = diagram.canvas.pos;

  const dx = grid.x;
  const dy = grid.y;

  const rows = Math.floor(h / dy);
  const cols = Math.floor(w / dx);

  const gridLines = [];

  for (let i = 0; i < rows; i++) {
    const yCoord = i * dy + dy + y;
    if (yCoord >= y + h - 1) continue;

    gridLines.push(
      <line
        key={`row-${i}`}
        x1={x + 1}
        y1={yCoord}
        x2={x + w - 1}
        y2={yCoord}
        className={'grid ' + (i % 5 === 0 ? 'grid--major' : 'grid--minor')}
      />
    );
  }

  for (let i = 0; i < cols; i++) {
    const xCoord = i * dx + dx + x;
    if (xCoord >= x + w - 1) continue;
    gridLines.push(
      <line
        key={`col-${i}`}
        x1={xCoord}
        y1={y + 1}
        x2={xCoord}
        y2={y + h - 1}
        className={'grid ' + (i % 5 === 0 ? 'grid--major' : 'grid--minor')}
      />
    );
  }

  return <>{gridLines}</>;
};

type Props = {
  diagram: Diagram;
};
