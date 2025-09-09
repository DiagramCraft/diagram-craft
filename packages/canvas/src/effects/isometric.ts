import { Box } from '@diagram-craft/geometry/box';
import { g, path, rect } from '../component/vdom-svg';
import type { VNode } from '../component/vdom';
import type { Point } from '@diagram-craft/geometry/point';
import { SvgTransformBuilder } from '@diagram-craft/geometry/svgTransform';

const SCALE = 0.5602;
const SCALE_INV = 1 / SCALE;
const ANGLE = 45;

export type IsometricTransform = {
  svgForward: () => string;
  svgReverse: () => string;
  point: (source: Point) => Point;
};

export const makeIsometricTransform = (bounds: Box): IsometricTransform => {
  const c = Box.center(bounds);

  const fwd = new SvgTransformBuilder(c).scale(1, SCALE).rotate(-ANGLE).build();
  const rev = new SvgTransformBuilder(c).rotate(ANGLE).scale(1, SCALE_INV).build();

  return {
    svgForward: () => fwd.asSvgString(),
    svgReverse: () => rev.asSvgString(),
    point: (source: Point) => fwd.transformPoint(source)
  };
};

export const isometricBaseShape = (
  box: Box,
  transform: IsometricTransform,
  height: number,
  color: string,
  shape: 'none' | 'rect'
) => {
  if (shape === 'none') return [];

  const padding = 10;

  const dest: VNode[] = [
    rect({
      x: box.x - padding,
      y: box.y - padding,
      width: box.w + padding * 2,
      height: box.h + padding * 2,
      stroke: 'none',
      fill: color
    })
  ];

  const tp1 = transform.point({ x: box.x - padding, y: box.y - padding });
  const tp2 = transform.point({ x: box.x - padding, y: box.y + padding + box.h });
  const tp3 = transform.point({ x: box.x + padding + box.w, y: box.y + padding + box.h });

  dest.push(
    g(
      { transform: `${transform.svgReverse()}` },

      path({
        d: `M ${tp1.x} ${tp1.y} L ${tp1.x} ${tp1.y + height} L ${tp2.x} ${tp2.y + height} L ${tp2.x} ${tp2.y} Z`,
        stroke: 'none',
        fill: color,
        filter: 'brightness(80%)'
      }),
      path({
        d: `M ${tp2.x} ${tp2.y} L ${tp2.x} ${tp2.y + height} L ${tp3.x} ${tp3.y + height} L ${tp3.x} ${tp3.y} Z`,
        stroke: 'none',
        fill: color,
        filter: 'brightness(90%)'
      })
    )
  );

  return dest;
};
