import type { VNode, VNodeData } from '@diagram-craft/canvas/component/vdom';
import type { Component, ComponentVNodeData } from '@diagram-craft/canvas/component/component';

const SKIP_KEYS = new Set(['on', 'hooks', 'component', 'componentFactory']);

const XML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
};

const escapeXml = (str: string): string =>
  str.replace(/[&<>"]/g, c => XML_ESCAPE[c] ?? c);

const serializeAttrs = (data: VNodeData): string => {
  let result = '';
  for (const key in data) {
    if (SKIP_KEYS.has(key)) continue;
    const value = data[key];
    if (value === undefined || value === null || value === false || value === '') continue;
    result += ` ${key}="${escapeXml(String(value))}"`;
  }
  return result;
};

export const vnodeToString = (vnode: VNode): string => {
  if (vnode.type === 't') {
    return escapeXml(vnode.children[0]);
  }

  if (vnode.type === 'r') {
    return vnode.children[0];
  }

  if (vnode.type === 'c') {
    const cmpData = vnode.data as ComponentVNodeData<unknown>;
    const factory = cmpData.componentFactory as (() => Component<unknown>) | undefined;
    if (!factory) return '';
    const instance = factory();
    const rendered = instance.renderForSSR(cmpData.component.props);
    return vnodeToString(rendered);
  }

  const { tag } = vnode;
  if (!tag) return vnode.children.map(c => vnodeToString(c)).join('');

  const attrs = serializeAttrs(vnode.data);

  if (vnode.children.length === 0) {
    return `<${tag}${attrs}/>`;
  }

  const childContent = vnode.children.map(c => vnodeToString(c)).join('');
  return `<${tag}${attrs}>${childContent}</${tag}>`;
};
