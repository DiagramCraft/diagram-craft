import { Path } from '../geometry/path.ts';
import { hash } from '../utils/hash.ts';
import { DiagramNode } from '../model/diagramNode.ts';
import React from 'react';
import { propsUtils } from './utils/propsUtils.ts';
import { Random } from '../utils/random.ts';
import { CubicSegment, LineSegment } from '../geometry/pathSegment.ts';
import { Point } from '../geometry/point.ts';
import { Vector } from '../geometry/vector.ts';
import { round } from '../utils/math.ts';

export const asDistortedSvgPath = (
  path: Path,
  seed: number,
  passes: number,
  distortVertices: boolean,
  amount: number
) => {
  const r = new Random(seed * passes);

  const endpointDistortion = 50 * amount;

  const distortedPath = [];

  let point = path.start;
  for (let i = 0; i < passes; i++) {
    for (const s of path.segments) {
      if (s instanceof LineSegment) {
        const d = r.nextFloatInRange(i % 2 === 0 ? 0.5 : 0.15, i % 2 === 0 ? 0.85 : 0.5);

        const midpoint = Point.add(s.start, Vector.scale(Vector.from(s.start, s.end), d));

        const distortion = Point.distance(s.start, s.end) * amount;
        const distortedMidpoint = Point.add(midpoint, {
          x: r.nextFloatInRange(-distortion, distortion),
          y: r.nextFloatInRange(-distortion, distortion)
        });

        point = distortVertices
          ? Point.add(s.end, {
              x: r.nextFloatInRange(-endpointDistortion, endpointDistortion),
              y: r.nextFloatInRange(-endpointDistortion, endpointDistortion)
            })
          : s.end;
        distortedPath.push(['Q', distortedMidpoint.x, distortedMidpoint.y, point.x, point.y]);
      } else if (s instanceof CubicSegment) {
        const lc1 = Point.distance(s.start, s.p1);
        const nc1 = Point.add(s.p1, {
          x: r.nextFloatInRange(-lc1 * amount * 2, lc1 * amount * 2),
          y: r.nextFloatInRange(-lc1 * amount * 2, lc1 * amount * 2)
        });
        const lc2 = Point.distance(s.end, s.p2);
        const nc2 = Point.add(s.p2, {
          x: r.nextFloatInRange(-lc2 * amount * 2, lc2 * amount * 2),
          y: r.nextFloatInRange(-lc2 * amount * 2, lc2 * amount * 2)
        });

        point = distortVertices
          ? Point.add(s.end, {
              x: r.nextFloatInRange(-endpointDistortion, endpointDistortion),
              y: r.nextFloatInRange(-endpointDistortion, endpointDistortion)
            })
          : s.end;
        distortedPath.push(['C', nc1.x, nc1.y, nc2.x, nc2.y, point.x, point.y]);
      } else {
        distortedPath.push(...s.raw());
      }
    }
  }

  return (
    `M ${round(path.start.x)} ${round(path.start.y)}` +
    (distortedPath.length > 0 ? ', ' : '') +
    distortedPath.map(e => e.join(' ')).join(', ')
  );
};

const SketchedFilledPath = (props: Props) => {
  const svgPathOutline = asDistortedSvgPath(
    props.p,
    hash(new TextEncoder().encode(props.node.id)),
    2,
    false,
    props.node.props.effects?.sketchStrength ?? 0.1
  );
  const svgPathFill = asDistortedSvgPath(
    props.p,
    hash(new TextEncoder().encode(props.node.id)),
    1,
    true,
    props.node.props.effects?.sketchStrength ?? 0.1
  );

  const boundaryProps = { ...props, style: { ...props.style } };
  const fillProps = { ...props, style: { ...props.style } };

  boundaryProps.style.fill = 'none';
  fillProps.style.stroke = 'none';

  return (
    <>
      <path
        d={svgPathFill}
        x={props.node.bounds.x}
        y={props.node.bounds.y}
        width={props.node.bounds.w}
        height={props.node.bounds.h}
        className={'svg-node__boundary svg-node'}
        {...propsUtils.filterSvgProperties(fillProps)}
      />

      <path
        d={svgPathOutline}
        x={props.node.bounds.x}
        y={props.node.bounds.y}
        width={props.node.bounds.w}
        height={props.node.bounds.h}
        className={'svg-node__boundary svg-node'}
        {...propsUtils.filterSvgProperties(boundaryProps)}
      />
    </>
  );
};

export const FilledPath = (props: Props) => {
  if (props.node.props.effects?.sketch) return <SketchedFilledPath {...props} />;

  return (
    <path
      d={props.p.asSvgPath()}
      x={props.node.bounds.x}
      y={props.node.bounds.y}
      width={props.node.bounds.w}
      height={props.node.bounds.h}
      className={'svg-node__boundary svg-node'}
      {...propsUtils.filterSvgProperties(props)}
    />
  );
};

type Props = {
  p: Path;
  node: DiagramNode;
} & Omit<React.SVGProps<SVGPathElement>, 'path'>;
