import { s, VNode, VNodeChildParam } from './vdom';
import { ElementAttributes, Attr } from './vdom-html';
import { Box } from '@diagram-craft/geometry/box';
import { Angle } from '@diagram-craft/geometry/angle';

type CommonPresentationAttributes = {
  'stroke'?: string;
  'stroke-width'?: string | number;
  'fill'?: string;
  'marker-start'?: string;
  'marker-mid'?: string;
  'marker-end'?: string;
  'transform'?: string;
  'cursor'?: string;
  'pointer-events'?: string;
};

export const circle = (
  attrs: Attr<
    {
      cx?: string | number;
      cy?: string | number;
      r?: string | number;
      pathLength?: string | number;
    } & ElementAttributes &
      CommonPresentationAttributes
  >,
  ...children: VNode[]
) => {
  return s('circle', attrs, ...children);
};

export const path = (
  attrs: Attr<
    {
      d: string;
      x?: string | number;
      y?: string | number;
      width?: string | number;
      height?: string | number;
    } & ElementAttributes &
      CommonPresentationAttributes
  >,
  ...children: VNode[]
) => {
  return s('path', attrs, ...children);
};

export const rect = (
  attrs: Attr<
    {
      x?: string | number;
      y?: string | number;
      rx?: string | number;
      ry?: string | number;
      width?: string | number;
      height?: string | number;
    } & ElementAttributes &
      CommonPresentationAttributes
  >,
  ...children: VNode[]
) => {
  return s('rect', attrs, ...children);
};

export const rectFromBox = (
  b: Box,
  attrs: Attr<
    {
      rx?: string | number;
      ry?: string | number;
    } & ElementAttributes &
      CommonPresentationAttributes
  >,
  ...children: VNode[]
) => {
  return s(
    'rect',
    {
      x: b.x,
      y: b.y,
      width: b.w,
      height: b.h,
      ...attrs
    },
    ...children
  );
};

export const line = (
  attrs: Attr<
    {
      x1?: string | number;
      y1?: string | number;
      x2?: string | number;
      y2?: string | number;
    } & ElementAttributes &
      CommonPresentationAttributes
  >,
  ...children: VNode[]
) => {
  return s('line', attrs, ...children);
};

export const text = (
  attrs: Attr<
    {
      x?: string | number;
      y?: string | number;
    } & ElementAttributes
  >,
  ...children: VNode[]
) => {
  return s('text', attrs, ...children);
};

type MarkerAttributes = ElementAttributes & {
  viewBox?: string;
  refX?: string | number;
  refY?: string | number;
  markerUnits?: string;
  strokeLinejoin?: string;
  strokeLinecap?: string;
  markerWidth?: string | number;
  markerHeight?: string | number;
  orient?: string;
};

export const marker = (attrs: Attr<MarkerAttributes>, ...children: VNode[]) => {
  return s('marker', attrs, ...children);
};

type MaskAttributes = ElementAttributes & {
  maskContentUnits?: string;
};

export const mask = (attrs: Attr<MaskAttributes>, ...children: VNode[]) => {
  return s('mask', attrs, ...children);
};

type GAttributes = ElementAttributes & {
  transform?: string;
  mask?: string;
};

export const g = (attrs: Attr<GAttributes>, ...children: VNodeChildParam[]) => {
  return s('g', attrs, ...children);
};

type ImageAttributes = ElementAttributes & {
  href?: string;
  preserveAspectRatio?: string;
  width?: string | number;
  height?: string | number;
  filter?: string;
};

export const image = (attrs: Attr<ImageAttributes>, ...children: VNode[]) => {
  return s('image', attrs, ...children);
};

type LinearGradientAttributes = ElementAttributes & {
  x1?: string | number;
  y1?: string | number;
  x2?: string | number;
  y2?: string | number;
  gradientUnits?: string;
  gradientTransform?: string;
};

export const linearGradient = (attrs: Attr<LinearGradientAttributes>, ...children: VNode[]) => {
  return s('linearGradient', attrs, ...children);
};

type RadialGradientAttributes = ElementAttributes & {
  gradientTransform?: string;
};

export const radialGradient = (attrs: Attr<RadialGradientAttributes>, ...children: VNode[]) => {
  return s('radialGradient', attrs, ...children);
};

type StopAttributes = ElementAttributes & {
  'offset'?: string | number;
  'stop-color'?: string;
  'stop-opacity'?: string | number;
};

export const stop = (attrs: Attr<StopAttributes>, ...children: VNode[]) => {
  return s('stop', attrs, ...children);
};

export const defs = (...children: VNode[]) => {
  return s('defs', {}, ...children);
};

type PatterAttributes = ElementAttributes & {
  patternUnits?: string;
  patternContentUnits?: string;
  width?: string | number;
  height?: string | number;
};

export const pattern = (attrs: Attr<PatterAttributes>, ...children: VNode[]) => {
  return s('pattern', attrs, ...children);
};

type FeFloodAttributes = ElementAttributes & {
  'result'?: string;
  'flood-color'?: string;
  'flood-opacity'?: string | number;
  'width'?: string | number;
  'height'?: string | number;
};

export const feFlood = (attrs: Attr<FeFloodAttributes>, ...children: VNode[]) => {
  return s('feFlood', attrs, ...children);
};

type FeGaussianBlurAttributes = ElementAttributes & {
  stdDeviation?: string | number;
};

export const feGaussianBlur = (attrs: Attr<FeGaussianBlurAttributes>, ...children: VNode[]) => {
  return s('feGaussianBlur', attrs, ...children);
};

type FeColorMatrixAttributes = ElementAttributes & {
  in?: string;
  result?: string;
  type?: string;
  values?: string;
};

export const feColorMatrix = (attrs: Attr<FeColorMatrixAttributes>, ...children: VNode[]) => {
  return s('feColorMatrix', attrs, ...children);
};

type FeBlendAttributes = ElementAttributes & {
  in?: string;
  in2?: string;
  mode?: string;
  result?: string;
};

export const feBlend = (attrs: Attr<FeBlendAttributes>, ...children: VNode[]) => {
  return s('feBlend', attrs, ...children);
};

type FeCompositeAttributes = ElementAttributes & {
  in?: string;
  in2?: string;
  operator?: string;
  k1?: string | number;
  k2?: string | number;
  k3?: string | number;
  k4?: string | number;
};

export const feComposite = (attrs: Attr<FeCompositeAttributes>, ...children: VNode[]) => {
  return s('feComposite', attrs, ...children);
};

type FeComponentTransferAttributes = ElementAttributes;

export const feComponentTransfer = (
  attrs: Attr<FeComponentTransferAttributes>,
  ...children: VNode[]
) => {
  return s('feComponentTransfer', attrs, ...children);
};

type FeFuncAttributes = {
  type: string;
  slope?: string | number;
  intercept?: string | number;
};

export const feFuncR = (attrs: Attr<FeFuncAttributes>) => {
  return s('feFuncR', attrs);
};
export const feFuncG = (attrs: Attr<FeFuncAttributes>) => {
  return s('feFuncG', attrs);
};
export const feFuncB = (attrs: Attr<FeFuncAttributes>) => {
  return s('feFuncB', attrs);
};

type FilterAttributes = ElementAttributes & {
  filterUnits?: string;
};

export const filter = (attrs: Attr<FilterAttributes>, ...children: (VNode | null)[]) => {
  return s('filter', attrs, ...children);
};

type ForeignObjectAttributes = ElementAttributes & {
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
};

export const foreignObject = (attrs: Attr<ForeignObjectAttributes>, ...children: VNode[]) => {
  return s('foreignObject', attrs, ...children);
};

export const Transform = {
  rotate: (b: Box) => {
    const center = Box.center(b);
    return `rotate(${Angle.toDeg(b.r)} ${center.x} ${center.y})`;
  }
};
