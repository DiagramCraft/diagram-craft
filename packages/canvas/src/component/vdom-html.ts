import { h, s, VNodeChildParam, VNodeData } from './vdom';

type DataAttributes = {
  [key in `data-${string}`]?: string;
};

export type ElementAttributes = {
  id?: string;
  class?: string;
  style?: string;
} & DataAttributes;

export type Attr<T = ElementAttributes> = T & {
  on?: VNodeData['on'];
  hooks?: VNodeData['hooks'];
};

type DivAttributes = ElementAttributes;

export const div = (attrs: Attr<DivAttributes>, children?: VNodeChildParam[]) => {
  return h('div', attrs, ...(children ?? []));
};

export const span = (attrs: Attr<DivAttributes>, children?: VNodeChildParam[]) => {
  return h('span', attrs, ...(children ?? []));
};

type TextareaAttributes = ElementAttributes;

export const textarea = (attrs: Attr<TextareaAttributes>, children?: VNodeChildParam[]) => {
  return h('textarea', attrs, ...(children ?? []));
};

type SVGAttributes = ElementAttributes & {
  preserveAspectRatio?: string;
  viewBox?: string;
};

export const svg = (attrs: Attr<SVGAttributes>, children?: VNodeChildParam[]) => {
  return s('svg', attrs, ...(children ?? []));
};
