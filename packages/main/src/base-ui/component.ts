import { apply, DOMElement, insert, VNode, VNodeData } from './vdom.ts';

type ComponentVNodeData<P, C extends Component<P>> = VNodeData & {
  component: {
    instance: C | undefined;
    props: P;
  };
};

export abstract class Component<P = Record<string, never>> {
  private element: VNode | undefined = undefined;
  protected currentProps: P | undefined;

  abstract render(props: P): VNode;

  detach() {}

  attach(parent: HTMLElement | SVGElement, props: P) {
    this.create(props);
    parent.appendChild(this.element!.el! as DOMElement);
  }

  protected create(props: P) {
    this.currentProps = props;
    const newElement = this.render(props);

    insert(newElement);

    this.element = newElement;
  }

  update(props: P) {
    this.currentProps = props;
    this.element = apply(this.element!, this.render(props));
  }

  isRendered(): boolean {
    return !!this.element?.el;
  }

  replaceWith(newComponent: Component<P>) {
    if (this.element?.el) {
      newComponent.create(this.currentProps!);
      this.element.el.replaceWith(newComponent.element!.el!);
      this.detach();
    }
  }

  protected subComponent<P, C extends Component<P>>(
    id: string,
    component: () => C,
    props: P
  ): VNode & { data: ComponentVNodeData<P, C> } {
    return {
      type: 'c',
      tag: id,
      data: {
        component: {
          props,
          instance: undefined
        },
        hooks: {
          onCreate: node => {
            const cmp = component();
            cmp.create(props);
            node.el = cmp.element?.el;
            (node.data as ComponentVNodeData<P, C>).component = {
              instance: cmp,
              props: props
            };
          },
          onUpdate: (oldNode, newNode) => {
            const cmp = (oldNode.data as ComponentVNodeData<P, C>).component.instance!;
            cmp.update((newNode.data as ComponentVNodeData<P, C>).component.props);
            newNode.el = cmp.element?.el;
            (newNode.data as ComponentVNodeData<P, C>).component = {
              instance: cmp,
              props: props
            };
          },
          onRemove: node => {
            const cmp = (node.data as ComponentVNodeData<P, C>).component.instance!;
            cmp.detach();
          }
        }
      },
      children: [],
      el: undefined
    };
  }
}
