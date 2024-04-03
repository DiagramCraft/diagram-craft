import { VerifyNotReached } from '../utils/assert.ts';

type EventListenerMap = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof HTMLElementEventMap]?: (this: Document, ev: DocumentEventMap[K]) => any;
};

export type VNodeProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //props?: Record<string, any>;
  attrs?: Record<string, string | number | boolean>;
  //  style?: Partial<CSSStyleDeclaration>;
  on?: Partial<EventListenerMap>;
  hooks?: {
    onUpdate?: (oldVNode: VNode, newVNode: VNode) => void;
    onInsert?: (node: VNode) => void;
    onCreate?: (node: VNode) => void;
    onRemove?: (node: VNode) => void;
  };
};

export type DOMElement = HTMLElement | SVGElement;

export type VNode =
  | {
      type: 'h' | 's' | 'c';
      tag: string;
      props: VNodeProps;
      children: Array<VNode>;
      el: DOMElement | undefined;
    }
  | {
      type: 't';
      tag: '#text';
      props: VNodeProps;
      children: [string];
      el: Text | undefined;
    }
  | {
      type: 'r';
      tag: '#raw';
      props: VNodeProps;
      children: [string];
      el: DOMElement | undefined;
    };

const emptyVNode = (): VNode => ({
  type: 'h',
  tag: '',
  props: {},
  children: [],
  el: undefined
});

const parseTag = (rawTag: string) => {
  const [tag, className] = rawTag.split('.');
  return { tag, className: className };
};

export const h = (rawTag: string, props: VNodeProps, ...children: (VNode | null)[]): VNode => {
  const { tag, className } = parseTag(rawTag);
  props.attrs ??= {};
  props.attrs.class ??= className;
  return { type: 'h', tag, props, children: children.filter(Boolean) as VNode[], el: undefined };
};

export const s = (rawTag: string, props: VNodeProps, ...children: (VNode | null)[]): VNode => {
  const { tag, className } = parseTag(rawTag);
  props.attrs ??= {};
  props.attrs.class ??= className;
  return { type: 's', tag, props, children: children.filter(Boolean) as VNode[], el: undefined };
};

export const t = (text: string): VNode => {
  return { type: 't', tag: '#text', props: {}, children: [text], el: undefined };
};

export const r = (text: string): VNode => {
  return { type: 'r', tag: '#raw', props: {}, children: [text], el: undefined };
};

const onUpdate = (oldVNode: VNode, newVNode: VNode, parentElement: VNode | undefined) => {
  updateAttrs(oldVNode, newVNode);
  updateEvents(oldVNode, newVNode);

  if (oldVNode.type === 't' && newVNode.type === 't') {
    // TODO: Checking for contentEditable here is a bit of a hack
    //       It's because for some reason blur events from TextComponent is handled out of order
    if (parentElement && (parentElement.el! as HTMLElement).contentEditable !== 'true') {
      (parentElement.el! as HTMLElement).innerText = newVNode.children[0];
    }
  } else if (oldVNode.type === 'r' && newVNode.type === 'r') {
    // TODO: Checking for contentEditable here is a bit of a hack
    //       It's because for some reason blur events from TextComponent is handled out of order
    if (parentElement && (parentElement.el! as HTMLElement).contentEditable !== 'true') {
      (parentElement.el! as HTMLElement).innerHTML = newVNode.children[0];
    }
  }

  newVNode.props.hooks?.onUpdate?.(oldVNode, newVNode);
};

const onInsert = (node: VNode) => {
  node.props.hooks?.onInsert?.(node);
};

const onCreate = (node: VNode) => {
  node.props.hooks?.onCreate?.(node);
};

const onRemove = (node: VNode) => {
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    onRemove(child as VNode);
  }

  node.props.hooks?.onRemove?.(node);
};

const updateAttrs = (oldVNode: VNode, newVNode: VNode) => {
  if (oldVNode.type === 't' || newVNode.type === 't') return;

  const oldAttrs = oldVNode.props.attrs ?? {};
  const newAttrs = newVNode.props.attrs ?? {};
  const newNode = newVNode.el! as DOMElement;

  Object.entries(newAttrs).forEach(([key, value]) => {
    if (oldAttrs[key] !== value) {
      newNode.setAttribute(key, value as string);
    }
  });
};

const updateEvents = (oldVNode: VNode, newVNode: VNode) => {
  if (oldVNode.type === 't' || newVNode.type === 't') return;

  const oldEvents = oldVNode.props.on ?? {};
  const newEvents = newVNode.props.on ?? {};
  const newNode = newVNode.el! as DOMElement;
  const oldNode = oldVNode.el! as DOMElement;

  Object.entries(oldEvents).forEach(([key, value]) => {
    // @ts-ignore
    oldNode.removeEventListener(key, value!);
  });

  Object.entries(newEvents).forEach(([key, value]) => {
    // @ts-ignore
    if (oldEvents[key] !== value) {
      // @ts-ignore
      newNode.addEventListener(key, value);
    }
  });
};

const createElement = (e: VNode, parentElement: VNode | undefined, insertQueue: VNode[]) => {
  insertQueue.push(e);

  if (e.type === 't') {
    e.el = document.createTextNode(e.children[0] as string);
    onCreate(e);
  } else if (e.type === 'r') {
    (parentElement!.el as HTMLElement).innerHTML = e.children[0] as string;

    // NOTE: Not very elegant
    e.el = parentElement!.el! as DOMElement;
    onCreate(e);
  } else if (e.type === 'c') {
    onCreate(e);
  } else {
    const node =
      e.type === 'h'
        ? document.createElement(e.tag)
        : document.createElementNS('http://www.w3.org/2000/svg', e.tag);

    e.el = node;

    onCreate(e);
    onUpdate(emptyVNode(), e, undefined);

    e.children.forEach(child => {
      createElement(child as VNode, e, insertQueue);
      if ((child as VNode).type !== 'r') node.appendChild((child as VNode).el!);
    });
  }
};

const applyUpdates = (
  oldElement: VNode,
  newElement: VNode,
  parentElement: VNode | undefined,
  insertQueue: VNode[]
): VNode => {
  newElement.el ??= oldElement.el;

  // Diff props
  onUpdate(oldElement, newElement, parentElement);

  if (oldElement.type === 't' || oldElement.type === 'r') {
    if (newElement.type !== oldElement.type) throw new VerifyNotReached();
    return newElement;
  }

  if (newElement.type === 't' || newElement.type === 'r') {
    throw new VerifyNotReached();
  }

  // Diff children
  const oldChildren = oldElement.children;
  const newChildren = newElement.children as VNode[];

  // Diff this.elements and newElements
  // TODO: This is a bit of a naive algorithm, as it doesn't try to match elements properly
  let i = 0;
  let j = 0;
  while (i < newChildren.length) {
    if (j >= oldChildren.length) {
      break;
    }

    const newChild = newChildren[i];
    const oldChild = oldChildren[j];

    if (newChild === oldChild) {
      // Do nothing
    } else if (newChild.tag !== oldChild.tag) {
      // New tag name
      onRemove(oldChild);

      createElement(newChild, newElement, insertQueue);
      oldChild.el?.replaceWith(newChild.el!);
    } else {
      // Only properties have changed
      newChild.el = oldChild.el;
      applyUpdates(oldChild, newChild, newElement, insertQueue);
    }
    i++;
    j++;
  }

  for (; j < oldChildren.length; j++) {
    const oldChild = oldChildren[j];
    onRemove(oldChild);
    oldChild.el!.remove();
  }

  for (; i < newChildren.length; i++) {
    const newChild = newChildren[i];
    createElement(newChild, newElement, insertQueue);
    if (newChild.type !== 'r') newElement.el!.appendChild(newChild.el!);
  }

  return newElement;
};

export const apply = (oldElement: VNode, newElement: VNode) => {
  const insertQueue: VNode[] = [];
  const newRoot = applyUpdates(oldElement, newElement, undefined, insertQueue);
  setTimeout(() => {
    insertQueue.forEach(onInsert);
  }, 0);
  return newRoot;
};

export const insert = (newElement: VNode) => {
  const insertQueue: VNode[] = [];
  createElement(newElement, undefined, insertQueue);
  setTimeout(() => {
    insertQueue.forEach(onInsert);
  }, 0);
  return newElement;
};
