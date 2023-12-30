import { ArrowShape } from '../base-ui/arrowShapes.ts';

export const ArrowMarker = ({ id, arrow, width, color, fillColor }: Props) => {
  if (!arrow) return null;
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
        d={arrow.path}
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
};
