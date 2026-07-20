import { describe, expect, test } from 'vitest';
import { ShapeBuilder } from './ShapeBuilder';
import { Component } from '../component/component';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import type { VNode } from '../component/vdom';

class NoopComponent extends Component<unknown> {
  render(): VNode {
    return { type: 'h', tag: 'div', data: {}, children: [], el: undefined };
  }
}

describe('ShapeBuilder.text', () => {
  test('does not render text node when textProps.enabled is false', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ id: 'n1', type: 'rect' });

    const builder = new ShapeBuilder({
      element: node,
      elementProps: node.renderProps,
      isSingleSelected: false,
      onMouseDown: () => {}
    } as never);

    builder.text(new NoopComponent(), '1', 'Hello', { enabled: false });

    expect(builder.nodes).toHaveLength(0);
  });

  test('renders text node when textProps.enabled is true or unset', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ id: 'n2', type: 'rect' });

    const builder = new ShapeBuilder({
      element: node,
      elementProps: node.renderProps,
      isSingleSelected: false,
      onMouseDown: () => {}
    } as never);

    builder.text(new NoopComponent(), '1', 'Hello', {});

    expect(builder.nodes).toHaveLength(1);
  });
});
