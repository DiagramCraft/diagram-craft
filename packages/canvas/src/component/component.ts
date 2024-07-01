import { apply, DOMElement, insert, VNode, VNodeData } from './vdom';
import { shallowEquals } from '@diagram-craft/utils/object';

type Callback = () => void | (() => void);

let CURRENT_EFFECT_MANAGER: EffectManager | undefined = undefined;

/**
 * Create an effect that will run the dependency function whenever the deps change.
 * Similar to React.useEffect
 *
 * @param callback
 * @param deps dependencies that will trigger the effect. An empty array will run the effect only once.
 */
export const createEffect = (callback: Callback, deps: unknown[]) => {
  if (!CURRENT_EFFECT_MANAGER) {
    throw new Error('Effect must be run inside a component');
  }
  CURRENT_EFFECT_MANAGER!.add(callback, deps);
};

type Registration = {
  cleanup: () => void;
  deps: unknown[];
};

class EffectManager {
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

    const res = dependency();
    this.dependencies[id] = {
      cleanup: res ? res : () => {},
      deps
    };
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

export type ComponentVNodeData<P> = VNodeData & {
  component: {
    instance: Component<P> | undefined;
    props: P;
  };
};

type ComponentContstructor<T> = {
  new (): Component<T>;
};

export const $cmp = <T>(cmp: ComponentContstructor<T>) => {
  return () => new cmp();
};

export abstract class Component<P = Record<string, never>> {
  protected element: VNode | undefined = undefined;
  protected currentProps: P | undefined;
  protected effectManager = new EffectManager();

  abstract render(props: P): VNode;

  protected doRender(props: P): VNode {
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
    this.update(this.currentProps!, true);
  }

  update(props: P, force = false) {
    if (!force && shallowEquals(this.currentProps, props)) return;
    this.currentProps = props;
    this.element = apply(this.element!, this.doRender(props));
  }

  isRendered(): boolean {
    return !!this.element?.el;
  }

  subComponent<P>(
    component: () => Component<P>,
    props: P & { key?: string },
    hooks?: VNodeData['hooks']
  ): VNode & { data: ComponentVNodeData<P> } {
    return {
      type: 'c',
      tag: props.key ?? component.name,
      data: {
        component: { props, instance: undefined },
        hooks: {
          onInsert: node => {
            (node.data as ComponentVNodeData<P>).component.instance?.onAttach(
              (node.data as ComponentVNodeData<P>).component!.instance!.currentProps!
            );
            hooks?.onInsert?.(node);
          },
          onCreate: node => {
            const cmp = component();
            cmp.create(props);
            node.el = cmp.element?.el;
            (node.data as ComponentVNodeData<P>).component = {
              instance: cmp,
              props: props
            };
            hooks?.onCreate?.(node);
          },
          onUpdate: (oldNode, newNode) => {
            const cmp = (oldNode.data as ComponentVNodeData<P>).component.instance!;
            cmp.update((newNode.data as ComponentVNodeData<P>).component.props);
            newNode.el = cmp.element?.el;
            (newNode.data as ComponentVNodeData<P>).component = {
              instance: cmp,
              props: props
            };
            hooks?.onUpdate?.(oldNode, newNode);
          },
          onRemove: node => {
            const cmp = (node.data as ComponentVNodeData<P>).component.instance!;
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
