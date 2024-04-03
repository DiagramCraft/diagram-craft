import { apply, DOMElement, insert, VNode, VNodeProps } from './vdom.ts';

type ComponentVNodeProps<P, C extends Component<P>> = VNodeProps & {
  component: {
    instance: C | undefined;
    props: P;
  };
};

export abstract class Component<P = Record<string, never>> {
  private element: VNode | undefined = undefined;

  abstract render(props: P): VNode;

  detach() {}

  attach(parent: HTMLElement | SVGElement, props: P) {
    this.create(props);
    parent.appendChild(this.element!.el! as DOMElement);
  }

  protected create(props: P) {
    const newElement = this.render(props);

    insert(newElement);

    this.element = newElement;
  }

  update(props: P) {
    this.element = apply(this.element!, this.render(props));
  }

  isRendered(): boolean {
    return !!this.element?.el;
  }

  protected subComponent<P, C extends Component<P>>(
    id: string,
    component: () => C,
    props: P
  ): VNode & { props: ComponentVNodeProps<P, C> } {
    return {
      type: 'c',
      tag: id,
      props: {
        component: {
          props,
          instance: undefined
        },
        hooks: {
          onCreate: node => {
            const cmp = component();
            cmp.create(props);
            node.el = cmp.element?.el;
            (node.props as ComponentVNodeProps<P, C>).component = {
              instance: cmp,
              props: props
            };
          },
          onUpdate: (oldNode, newNode) => {
            const cmp = (oldNode.props as ComponentVNodeProps<P, C>).component.instance!;
            cmp.update((newNode.props as ComponentVNodeProps<P, C>).component.props);
            newNode.el = cmp.element?.el;
            (newNode.props as ComponentVNodeProps<P, C>).component = {
              instance: cmp,
              props: props
            };
          },
          onRemove: node => {
            const cmp = (node.props as ComponentVNodeProps<P, C>).component.instance!;
            cmp.detach();
          }
        }
      },
      children: [],
      el: undefined
    };
  }
}
