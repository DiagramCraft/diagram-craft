import { h, VNodeChildParam, VNodeData } from './vdom.ts';

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
