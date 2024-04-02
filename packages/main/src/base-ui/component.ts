import { apply, DOMElement, insert, VNode } from './vdom.ts';

export abstract class Component<P = Record<string, never>> {
  private element: VNode | undefined = undefined;

  abstract render(props: P): VNode;

  detach() {}

  attach(parent: HTMLElement | SVGElement, props: P) {
    const newElement = this.render(props);

    insert(newElement);

    this.element = newElement;

    parent.appendChild(this.element.el! as DOMElement);
  }

  update(props: P) {
    this.element = apply(this.element!, this.render(props));
  }

  isRendered(): boolean {
    return !!this.element?.el;
  }
}
