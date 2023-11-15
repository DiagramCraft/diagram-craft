import { Line } from '../geometry/line.ts';

export const DistanceMarker = (props: Props) => {
  const l = Line.from({ x: props.x1, y: props.y1 }, { x: props.x2, y: props.y2 });
  return (
    <>
      <marker
        id={`arrow_${props.id}`}
        viewBox="0 0 10 10"
        refX="10"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" stroke="pink" fill="pink" />
      </marker>

      <line
        x1={props.x1}
        y1={props.y1}
        x2={props.x2}
        y2={props.y2}
        strokeWidth={1}
        stroke={'pink'}
        fill={'pink'}
        markerEnd={`url(#arrow_${props.id})`}
        markerStart={`url(#arrow_${props.id})`}
      />
      <rect
        x={Line.midpoint(l).x - props.label.length * 5}
        y={Line.midpoint(l).y - 10}
        rx={5}
        ry={5}
        width={props.label.length * 10}
        height={17}
        fill="white"
      />
      <text
        x={Line.midpoint(l).x}
        y={Line.midpoint(l).y}
        fill="pink"
        style={{ fontSize: '10px' }}
        dominantBaseline="middle"
        textAnchor="middle"
      >
        {props.label}
      </text>
    </>
  );
};

type Props = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  label: string;
};
