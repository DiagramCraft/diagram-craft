import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('./vdom', () => ({
  insert: vi.fn((node: { el?: unknown }) => {
    node.el ??= { mocked: true };
    return node;
  }),
  apply: vi.fn((oldNode: { el?: unknown }, newNode: { el?: unknown }) => {
    newNode.el ??= oldNode.el ?? { mocked: true };
    return newNode;
  })
}));

import { Component, createEffect } from './component';
import type { VNode } from './vdom';

const vnode = (): VNode => ({
  type: 'h',
  tag: 'div',
  data: {},
  children: [],
  el: undefined
});

class EffectComponent extends Component<{ deps: unknown[] }> {
  constructor(
    private readonly effect: () => void | (() => void)
  ) {
    super();
  }

  render(props: { deps: unknown[] }) {
    createEffect(this.effect, props.deps);
    return vnode();
  }

  mount(props: { deps: unknown[] }) {
    this.create(props);
  }
}

class MemoComponent extends Component<{ memoId: string; version: number }> {
  public readonly renderedVersions: number[] = [];

  render(props: { memoId: string; version: number }) {
    this.renderedVersions.push(props.version);
    return vnode();
  }

  protected getMemoKey(props: { memoId: string; version: number }) {
    return { memoId: props.memoId };
  }

  mount(props: { memoId: string; version: number }) {
    this.create(props);
  }
}

describe('component runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('reruns an effect when the dependency array shrinks', () => {
    let setupCount = 0;
    let cleanupCount = 0;

    const cmp = new EffectComponent(() => {
      setupCount += 1;
      return () => {
        cleanupCount += 1;
      };
    });

    cmp.mount({ deps: ['diagram', 'selection'] });
    cmp.update({ deps: ['diagram'] });

    expect(setupCount).toBe(2);
    expect(cleanupCount).toBe(1);
  });

  test('forced redraw uses the latest props after a memoized update is skipped', () => {
    const cmp = new MemoComponent();

    cmp.mount({ memoId: 'static-canvas', version: 1 });
    cmp.update({ memoId: 'static-canvas', version: 2 });
    cmp.redraw();

    expect(cmp.renderedVersions).toEqual([1, 2]);
  });
});
