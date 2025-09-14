import { useId } from 'react';
import { ArrowShape } from '@diagram-craft/canvas/arrowShapes';

export const ArrowPreview = (props: Props) => {
  const id = useId();
  return (
    <svg width={props.width} height={10}>
      {props.start && (
        <marker
          id={`arrow_start_${props.type}_${id}`}
          viewBox={`-1 -1 ${props.start.width + 2} ${props.start.height + 2}`}
          refX={props.start.anchor.x}
          refY={props.start.anchor.y}
          markerWidth={props.start.width + 2}
          markerHeight={props.start.height + 2}
          orient="auto-start-reverse"
        >
          <path
            d={props.start.path}
            stroke={props.color ?? 'var(--base-fg-dim)'}
            strokeWidth={1}
            fill={
              props.start.fill === 'fg'
                ? (props.fg ?? 'var(--base-fg-dim)')
                : props.start.fill === 'bg'
                  ? props.bg
                  : 'none'
            }
          />
        </marker>
      )}
      {props.end && (
        <marker
          id={`arrow_end_${props.type}_${id}`}
          viewBox={`-1 -1 ${props.end.width + 2} ${props.end.height + 2}`}
          refX={props.end.anchor.x}
          refY={props.end.anchor.y}
          markerWidth={props.end.width + 2}
          markerHeight={props.end.height + 2}
          orient="auto-start-reverse"
        >
          <path
            d={props.end.path}
            stroke={props.color ?? 'var(--base-fg-dim)'}
            strokeWidth={1}
            fill={
              props.end.fill === 'fg'
                ? (props.fg ?? 'var(--base-fg-dim)')
                : props.end.fill === 'bg'
                  ? props.bg
                  : 'none'
            }
          />
        </marker>
      )}
      <path
        d={`M ${2 + (props.start?.shortenBy ?? 0)} 5 L ${
          props.width - 1 - (props.end?.shortenBy ?? 0)
        } 5`}
        stroke={props.color ?? 'var(--base-fg-dim)'}
        strokeWidth={'1'}
        style={{ cursor: 'move', fill: 'none' }}
        markerStart={props.start ? `url(#arrow_start_${props.type}_${id})` : undefined}
        markerEnd={props.end ? `url(#arrow_end_${props.type}_${id})` : undefined}
      />
    </svg>
  );
};

type Props = {
  color?: string;
  bg?: string;
  fg?: string;
  type: string;
  width: number;
  start?: ArrowShape;
  end?: ArrowShape;
};
