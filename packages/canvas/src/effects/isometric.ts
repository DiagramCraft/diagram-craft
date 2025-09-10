import { Box } from '@diagram-craft/geometry/box';
import { g, path, rect } from '../component/vdom-svg';
import type { VNode } from '../component/vdom';
import type { Point } from '@diagram-craft/geometry/point';
import { SvgTransformBuilder } from '@diagram-craft/geometry/svgTransform';
import type { NodePropsForRendering } from '@diagram-craft/model/diagramNode';

export type IsometricTransform = {
  svgForward: () => string;
  svgReverse: () => string;
  point: (source: Point) => Point;
};

export const makeIsometricTransform = (
  bounds: Box,
  props: NodePropsForRendering
): IsometricTransform => {
  const c = Box.center(bounds);

  const scale = props.effects.isometric.tilt;
  const angle = props.effects.isometric.rotation;

  const fwd = new SvgTransformBuilder(c).scale(1, scale).rotate(-angle).build();
  const rev = new SvgTransformBuilder(c)
    .rotate(angle)
    .scale(1, 1 / scale)
    .build();

  return {
    svgForward: () => fwd.asSvgString(),
    svgReverse: () => rev.asSvgString(),
    point: (source: Point) => fwd.transformPoint(source)
  };
};

export const isometricBaseShape = (
  box: Box,
  transform: IsometricTransform,
  props: NodePropsForRendering
) => {
  const height = props.effects.isometric.size;
  const color = props.effects.isometric.color;
  const shape = props.effects.isometric.shape;
  const strokeColor = props.effects.isometric.strokeEnabled
    ? props.effects.isometric.strokeColor
    : 'none';

  if (shape === 'none') return [];

  const padding = 10;

  const dest: VNode[] = [
    rect({
      'x': box.x - padding,
      'y': box.y - padding,
      'width': box.w + padding * 2,
      'height': box.h + padding * 2,
      'stroke': strokeColor,
      'stroke-width': 1,
      'fill': color
    })
  ];

  const tp1 = transform.point({ x: box.x - padding, y: box.y - padding });
  const tp2 = transform.point({ x: box.x - padding, y: box.y + padding + box.h });
  const tp3 = transform.point({ x: box.x + padding + box.w, y: box.y + padding + box.h });

  dest.push(
    g(
      { transform: `${transform.svgReverse()}` },

      path({
        'd': `M ${tp1.x} ${tp1.y} L ${tp1.x} ${tp1.y + height} L ${tp2.x} ${tp2.y + height} L ${tp2.x} ${tp2.y} Z`,
        'stroke': strokeColor,
        'stroke-width': 1,
        'fill': color,
        'filter': 'brightness(80%)'
      }),
      path({
        'd': `M ${tp2.x} ${tp2.y} L ${tp2.x} ${tp2.y + height} L ${tp3.x} ${tp3.y + height} L ${tp3.x} ${tp3.y} Z`,
        'stroke': strokeColor,
        'stroke-width': 1,
        'fill': color,
        'filter': 'brightness(90%)'
      })
    )
  );

  return dest;
};
