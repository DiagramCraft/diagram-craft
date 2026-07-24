import { describe, expect, test } from 'vitest';
import { ShapeBuilder } from './ShapeBuilder';
import { Component } from '../component/component';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import type { VNode } from '../component/vdom';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

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

describe('ShapeBuilder.makeOnDblclickHandle', () => {
  test('does not create a text editing handler for locked nodes', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ id: 'locked-node', type: 'rect' });

    UnitOfWork.execute(diagram, uow => node.setLocked(true, uow));

    const builder = new ShapeBuilder({
      element: node,
      elementProps: node.renderProps,
      isSingleSelected: false,
      onMouseDown: () => {}
    } as never);

    expect(builder.makeOnDblclickHandle()).toBeUndefined();
  });
});
