import { Box } from '@diagram-craft/geometry/box';
import { g, path, rect } from '../component/vdom-svg';
import type { VNode } from '../component/vdom';
import type { Point } from '@diagram-craft/geometry/point';

const SVG_NS = 'http://www.w3.org/2000/svg';

let svg: SVGSVGElement | undefined = undefined;

const SCALE = 0.5602;
const ANGLE = 45;

export type IsometricTransform = {
  svgForwardTransform: () => string;
  svgReverseTransform: () => string;
  svgForwardTransformPoint: (source: Point) => Point;
};

export const makeIsometricTransform = (bounds: Box): IsometricTransform => {
  const center = Box.center(bounds);

  const forward = [
    `translate(${center.x}, ${center.y})`,
    `scale(1, ${SCALE})`,
    `rotate(${-ANGLE})`,
    `translate(-${center.x}, -${center.y})`
  ].join(' ');
  const reverse = [
    `translate(${center.x}, ${center.y})`,
    `rotate(${ANGLE})`,
    `scale(1, ${1 / SCALE})`,
    `translate(-${center.x}, -${center.y})`
  ].join(' ');

  const el = document.createElementNS(SVG_NS, 'rect');
  el.setAttribute('transform', forward);

  const matrix = el.transform.baseVal.consolidate()?.matrix;

  return {
    svgForwardTransform: () => forward,

    svgReverseTransform: () => reverse,

    svgForwardTransformPoint: (source: Point) => {
      svg ??= document.createElementNS(SVG_NS, 'svg');
      const p = svg.createSVGPoint();
      p.x = source.x;
      p.y = source.y;

      return p.matrixTransform(matrix);
    }
  };
};

export const isometricBaseShape = (
  bounds: Box,
  transform: IsometricTransform,
  height: number,
  color: string,
  shape: 'none' | 'rect'
) => {
  if (shape === 'none') return [];

  const padding = 10;

  const dest: VNode[] = [
    rect({
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.w + padding * 2,
      height: bounds.h + padding * 2,
      stroke: 'none',
      fill: color
    })
  ];

  const tp1 = transform.svgForwardTransformPoint({ x: bounds.x - padding, y: bounds.y - padding });
  const tp2 = transform.svgForwardTransformPoint({
    x: bounds.x - padding,
    y: bounds.y + padding + bounds.h
  });
  const tp3 = transform.svgForwardTransformPoint({
    x: bounds.x + padding + bounds.w,
    y: bounds.y + padding + bounds.h
  });

  dest.push(
    g(
      { transform: `${transform.svgReverseTransform()}` },

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
