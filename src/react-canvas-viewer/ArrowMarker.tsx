import { ArrowShape } from '../base-ui/arrowShapes.ts';
import { asDistortedSvgPath, parseArrowSvgPath } from './sketch.ts';
import { hash } from '../utils/hash.ts';

export const ArrowMarker = ({ id, arrow, width, color, fillColor, sketch }: Props) => {
  if (!arrow) return null;

  let path = arrow.path;
  if (sketch) {
    path = asDistortedSvgPath(parseArrowSvgPath(arrow.path), hash(new TextEncoder().encode(id)), {
      unidirectional: false,
      passes: 2,
      amount: 0.1
    });
  }

  return (
    <marker
      id={id}
      viewBox={`${-width} ${-width} ${arrow.width + 1 + width} ${arrow.height + 1 + width}`}
      refX={arrow.anchor.x}
      refY={arrow.anchor.y}
      markerUnits={'userSpaceOnUse'}
      strokeLinejoin={'round'}
      strokeLinecap={'round'}
      markerWidth={arrow.width + 2}
      markerHeight={arrow.height + 2}
      orient="auto-start-reverse"
    >
      <path
        d={path}
        stroke={color}
        strokeWidth={width}
        /* TODO: white cannot really be correct here */
        fill={arrow.fill === 'fg' ? fillColor : arrow.fill === 'bg' ? 'white' : 'none'}
      />
    </marker>
  );
};

type Props = {
  id: string;
  arrow: ArrowShape | undefined;
  width: number;
  color: string;
  fillColor: string;
  sketch?: boolean;
};
