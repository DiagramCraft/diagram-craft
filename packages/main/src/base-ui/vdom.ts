import { VerifyNotReached } from '../utils/assert.ts';

const toKebabCase = (key: string) =>
  key.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();

export const toInlineCSS = (style: Partial<CSSStyleDeclaration>) => {
  return Object.entries(style!)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${toKebabCase(key)}: ${value}`)
    .join(';');
};

type EventListenerMap = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof HTMLElementEventMap]?: (this: Document, ev: DocumentEventMap[K]) => any;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface VNodeData extends Record<string, any> {
  on?: Partial<EventListenerMap>;
  hooks?: {
    onUpdate?: (oldVNode: VNode, newVNode: VNode) => void;
    onInsert?: (node: VNode) => void;
    onCreate?: (node: VNode) => void;
    onRemove?: (node: VNode) => void;
  };
}

export type DOMElement = HTMLElement | SVGElement;

export type VNode =
  | {
      type: 'h' | 's' | 'c';
      tag: string;
      data: VNodeData;
      children: Array<VNode>;
      el: DOMElement | undefined;
    }
  | {
      type: 't';
      tag: '#text';
      data: VNodeData;
      children: [string];
      el: Text | undefined;
    }
  | {
      type: 'r';
      tag: '#raw';
      data: VNodeData;
      children: [string];
      el: DOMElement | undefined;
    };

const emptyVNode = (): VNode => ({
  type: 'h',
  tag: '',
  data: {},
  children: [],
  el: undefined
});

export const h = (tag: string, props: VNodeData, ...children: (VNode | null)[]): VNode => {
  return {
    type: 'h',
    tag,
    data: props,
    children: children.filter(Boolean) as VNode[],
    el: undefined
  };
};

export const s = (tag: string, props: VNodeData, ...children: (VNode | null)[]): VNode => {
  return {
    type: 's',
    tag,
    data: props,
    children: children.filter(Boolean) as VNode[],
    el: undefined
  };
};

export const text = (text: string): VNode => {
  return { type: 't', tag: '#text', data: {}, children: [text], el: undefined };
};

export const rawHTML = (text: string): VNode => {
  return { type: 'r', tag: '#raw', data: {}, children: [text], el: undefined };
};

const onUpdate = (oldVNode: VNode, newVNode: VNode, parentElement: VNode | undefined) => {
  updateAttrs(oldVNode, newVNode);
  updateEvents(oldVNode, newVNode);

  if (newVNode.type === 't' || newVNode.type === 'r') {
    // TODO: Checking for contentEditable here is a bit of a hack
    //       It's because for some reason blur events from TextComponent is handled out of order
    if (!parentElement || (parentElement.el! as HTMLElement).contentEditable === 'true') {
      return;
    }

    if (newVNode.type === 't') {
      (parentElement.el! as HTMLElement).innerText = newVNode.children[0];
    } else if (newVNode.type === 'r') {
      (parentElement.el! as HTMLElement).innerHTML = newVNode.children[0];
    }
  }

  newVNode.data.hooks?.onUpdate?.(oldVNode, newVNode);
};

const onInsert = (node: VNode) => {
  node.data.hooks?.onInsert?.(node);
};

const onCreate = (node: VNode) => {
  node.data.hooks?.onCreate?.(node);
};

const onRemove = (node: VNode) => {
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    onRemove(child as VNode);
  }

  node.data.hooks?.onRemove?.(node);
};

const updateAttrs = (oldVNode: VNode, newVNode: VNode) => {
  if (oldVNode.type === 't' || newVNode.type === 't') return;

  const oldAttrs = oldVNode.data ?? {};
  const newAttrs = newVNode.data ?? {};
  const newNode = newVNode.el! as DOMElement;

  Object.entries(newAttrs).forEach(([key, value]) => {
    if (oldAttrs[key] !== value) {
      newNode.setAttribute(key, value as string);
    }
  });
};

const updateEvents = (oldVNode: VNode, newVNode: VNode) => {
  if (oldVNode.type === 't' || newVNode.type === 't') return;

  const oldEvents = oldVNode.data.on ?? {};
  const newEvents = newVNode.data.on ?? {};
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
  // TODO: Support replacing root element in case tag name has changed
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
