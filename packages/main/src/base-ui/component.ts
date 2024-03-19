// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const h = (tag: string, props: Record<string, any>, ...children: HTMLElement[]) => {
  const el = document.createElement(tag);
  Object.assign(el, props);
  el.append(...children);
  return el;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const s = (tag: string, props: Record<string, any>, ...children: SVGElement[]) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.assign(el, props);
  el.append(...children);
  return el;
};

export abstract class Component {
  abstract render(): HTMLElement | SVGElement;
  abstract update(): void;
  detach() {}
}

export const render = (component: Component, parent: HTMLElement) => {
  parent.append(component.render());
};
