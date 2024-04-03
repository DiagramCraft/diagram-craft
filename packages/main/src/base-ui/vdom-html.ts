import { h, VNode, VNodeData } from './vdom.ts';

export type ElementAttributes = {
  id?: string;
  class?: string;
  style?: string;
};

export type Attr<T = ElementAttributes> = T & {
  on?: VNodeData['on'];
  hooks?: VNodeData['hooks'];
};

type DivAttributes = ElementAttributes;

export const div = (attrs: Attr<DivAttributes>, ...children: VNode[]) => {
  return h('div', attrs, ...children);
};
