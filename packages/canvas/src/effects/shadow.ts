import { round } from '@diagram-craft/utils/math';
import * as svg from '../component/vdom-svg';

export const makeShadowFilter = (props: {
  x?: number;
  y?: number;
  blur?: number;
  color?: string;
  opacity?: number;
}) => {
  return `drop-shadow(${props.x ?? 5}px ${props.y ?? 5}px ${
    props.blur ?? 5
  }px color-mix(in srgb, ${props.color ?? 'black'}, transparent ${round(
    (props.opacity ?? 0.5) * 100
  )}%))`;
};

export const makeSvgShadowFilter = (props: {
  x?: number;
  y?: number;
  blur?: number;
  color?: string;
  opacity?: number;
}) => {
  return svg.feDropShadow({
    'dx': props.x ?? 0,
    'dy': props.y ?? 0,
    'stdDeviation': `${(props.blur ?? 0) / 1.9}, ${(props.blur ?? 0) / 1.9}`,
    'flood-color': props.color ?? 'black',
    'flood-opacity': props.opacity ?? 0
  });
};
