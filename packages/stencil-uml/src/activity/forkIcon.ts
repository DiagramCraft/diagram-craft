import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { VNode } from '@diagram-craft/canvas/component/vdom';
import { Box } from '@diagram-craft/geometry/box';
import type { NodeProps } from '@diagram-craft/model/diagramProps';

const FORK_ICON_SIZE = 14;

export const renderForkIconInBounds = (
  iconBounds: Box,
  nodeProps: Pick<NodeProps, 'stroke' | 'fill'>
): VNode => {
  const color = nodeProps.stroke?.color ?? 'currentColor';
  const size = Math.min(iconBounds.w, iconBounds.h);
  const x = iconBounds.x + (iconBounds.w - size) / 2;
  const y = iconBounds.y + (iconBounds.h - size) / 2;
  const scale = size / FORK_ICON_SIZE;
  const shapeStrokeWidth = nodeProps.stroke?.width ?? 1;
  const effectiveStrokeWidth = Math.min(shapeStrokeWidth, Math.max(1, shapeStrokeWidth * 0.9));
  const strokeWidth = effectiveStrokeWidth / scale;

  return svg.g(
    {
      transform: `translate(${x} ${y}) scale(${scale})`,
      style: 'pointer-events: none',
      class: 'uScale'
    },
    svg.line({
      'x1': 7,
      'y1': 1.5,
      'x2': 7,
      'y2': 12.5,
      'stroke': color,
      'stroke-width': strokeWidth,
      'stroke-linecap': 'round'
    }),
    svg.line({
      'x1': 2.5,
      'y1': 7,
      'x2': 11.5,
      'y2': 7,
      'stroke': color,
      'stroke-width': strokeWidth,
      'stroke-linecap': 'round'
    }),
    svg.line({
      'x1': 2.5,
      'y1': 7,
      'x2': 2.5,
      'y2': 12.5,
      'stroke': color,
      'stroke-width': strokeWidth,
      'stroke-linecap': 'round'
    }),
    svg.line({
      'x1': 11.5,
      'y1': 7,
      'x2': 11.5,
      'y2': 12.5,
      'stroke': color,
      'stroke-width': strokeWidth,
      'stroke-linecap': 'round'
    })
  );
};
