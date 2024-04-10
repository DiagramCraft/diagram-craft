import { round } from '@diagram-craft/utils/math';

export const makeShadowFilter = (edgeProps: {
  x?: number;
  y?: number;
  blur?: number;
  color?: string;
  opacity?: number;
}) => {
  return `drop-shadow(${edgeProps.x ?? 5}px ${edgeProps.y ?? 5}px ${
    edgeProps.blur ?? 5
  }px color-mix(in srgb, ${edgeProps.color ?? 'black'}, transparent ${round(
    (edgeProps.opacity ?? 0.5) * 100
  )}%))`;
};
