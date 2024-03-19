import { Line } from '../../geometry/line.ts';
import { Point } from '../../geometry/point.ts';
import { newid } from '../../utils/id.ts';

export const DistanceMarker = (props: Props) => {
  const l = Line.of(props.p1, props.p2);
  const marker = `distance_marker_${newid()}`;
  return (
    <>
      <marker
        id={marker}
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
        className={'svg-guide__distance-line'}
        x1={props.p1.x}
        y1={props.p1.y}
        x2={props.p2.x}
        y2={props.p2.y}
        markerEnd={`url(#${marker})`}
        markerStart={`url(#${marker})`}
      />
      <rect
        className={'svg-guide__distance-label-bg'}
        x={Line.midpoint(l).x - props.label.length * 5}
        y={Line.midpoint(l).y - 10}
        rx={5}
        ry={5}
        width={props.label.length * 10}
        height={17}
      />
      <text x={Line.midpoint(l).x} y={Line.midpoint(l).y} className={'svg-guide__distance-label'}>
        {props.label}
      </text>
    </>
  );
};

type Props = {
  p1: Point;
  p2: Point;
  label: string;
};
