import { apply, DOMElement, insert, VNode, VNodeData } from './vdom.ts';

type Callback = () => void | (() => void);

type Registration = {
  cleanup: () => void;
  deps: unknown[];
};

let CURRENT_EFFECT_MANAGER: EffectManager | undefined = undefined;

export const createEffect = (dependency: Callback, deps: unknown[]) => {
  if (!CURRENT_EFFECT_MANAGER) {
    throw new Error('Effect must be run inside a component');
  }
  CURRENT_EFFECT_MANAGER!.add(dependency, deps);
};

export class EffectManager {
  private dependencies: Record<string, Registration> = {};
  private idx: number = 0;

  add(dependency: Callback, deps: unknown[]) {
    const id = (this.idx++).toString();
    if (
      id in this.dependencies &&
      (this.dependencies[id].deps.length === 0 ||
        deps.every((d, i) => d === this.dependencies[id].deps[i]))
    ) {
      return;
    }

    if (id in this.dependencies) {
      this.dependencies[id].cleanup();
    }

    //console.log('run effect');
    const res = dependency();
    if (res) {
      this.dependencies[id] = {
        cleanup: res,
        deps
      };
    }
  }

  cleanup() {
    for (const id in this.dependencies) {
      this.dependencies[id].cleanup();
    }
  }

  _start() {
    this.idx = 0;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    CURRENT_EFFECT_MANAGER = this;
  }

  _stop() {
    CURRENT_EFFECT_MANAGER = undefined;
  }
}

export type ComponentVNodeData<P, C extends Component<P>> = VNodeData & {
  component: {
    instance: C | undefined;
    props: P;
  };
};

export abstract class Component<P = Record<string, never>> {
  protected element: VNode | undefined = undefined;
  protected currentProps: P | undefined;
  protected effectManager = new EffectManager();

  abstract render(props: P): VNode;

  private doRender(props: P): VNode {
    this.effectManager._start();
    try {
      return this.render(props);
    } finally {
      this.effectManager._stop();
    }
  }

  onDetach(_props: P) {}
  onAttach(_props: P) {}

  detach() {
    this.onDetach(this.currentProps!);
    if (this.element?.el) this.element.el.remove();
    this.effectManager.cleanup();
  }

  attach(parent: HTMLElement | SVGElement, props: P) {
    this.create(props);
    parent.appendChild(this.element!.el! as DOMElement);
    this.onAttach(props);
  }

  protected create(props: P) {
    const newElement = this.doRender(props);

    insert(newElement);

    this.element = newElement;
    this.currentProps = props;
  }

  redraw() {
    if (!this.element) return;
    this.update(this.currentProps!);
  }

  update(props: P) {
    this.element = apply(this.element!, this.doRender(props));
    this.currentProps = props;
  }

  isRendered(): boolean {
    return !!this.element?.el;
  }

  subComponent<P, C extends Component<P>>(
    id: string,
    component: () => C,
    props: P,
    hooks?: VNodeData['hooks']
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
          onInsert: node => {
            (node.data as ComponentVNodeData<P, C>).component.instance?.onAttach(
              (node.data as ComponentVNodeData<P, C>).component!.instance!.currentProps!
            );
            hooks?.onInsert?.(node);
          },
          onCreate: node => {
            const cmp = component();
            cmp.create(props);
            node.el = cmp.element?.el;
            (node.data as ComponentVNodeData<P, C>).component = {
              instance: cmp,
              props: props
            };
            hooks?.onCreate?.(node);
          },
          onUpdate: (oldNode, newNode) => {
            const cmp = (oldNode.data as ComponentVNodeData<P, C>).component.instance!;
            cmp.update((newNode.data as ComponentVNodeData<P, C>).component.props);
            newNode.el = cmp.element?.el;
            (newNode.data as ComponentVNodeData<P, C>).component = {
              instance: cmp,
              props: props
            };
            hooks?.onUpdate?.(oldNode, newNode);
          },
          onRemove: node => {
            const cmp = (node.data as ComponentVNodeData<P, C>).component.instance!;
            cmp.detach();
            hooks?.onRemove?.(node);
          }
        }
      },
      children: [],
      el: undefined
    };
  }
}
