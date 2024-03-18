import { Path } from '../geometry/path.ts';
import { hash } from '../utils/hash.ts';
import { DiagramNode } from '../model/diagramNode.ts';
import React from 'react';
import { propsUtils } from './utils/propsUtils.ts';
import { asDistortedSvgPath } from './sketch.ts';

const SketchedFilledPath = (props: Props) => {
  const svgPathOutline = asDistortedSvgPath(
    props.p,
    hash(new TextEncoder().encode(props.node.id)),
    {
      passes: 2,
      amount: props.node.props.effects?.sketchStrength ?? 0.1
    }
  );
  const svgPathFill = asDistortedSvgPath(props.p, hash(new TextEncoder().encode(props.node.id)), {
    passes: 1,
    amount: props.node.props.effects?.sketchStrength ?? 0.1,
    distortVertices: true
  });

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
