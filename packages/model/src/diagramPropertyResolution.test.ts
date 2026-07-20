import { describe, expect, it } from 'vitest';
import { TestModel } from './test-support/testModel';
import { Stylesheet } from './diagramStyles';
import { UnitOfWork } from './unitOfWork';
import { RuleLayer } from './diagramLayerRule';
import type { EdgeProps, NodeProps } from './diagramProps';

const addStylesheet = (
  diagram: ReturnType<typeof TestModel.newDiagram>,
  type: 'node' | 'edge' | 'text',
  id: string,
  props: NodeProps | EdgeProps
) => {
  const stylesheet = Stylesheet.fromSnapshot(
    type,
    { id, name: id, props },
    diagram.document.root.factory,
    diagram.document.styles
  );

  UnitOfWork.execute(diagram, uow => diagram.document.styles.addStylesheet(id, stylesheet, uow));
  return stylesheet;
};

const addMatchingRuleLayer = (
  diagram: ReturnType<typeof TestModel.newDiagram>,
  type: 'node' | 'edge',
  elementStyle: string,
  textStyle: string,
  props: NodeProps | EdgeProps
) => {
  const layer = new RuleLayer(`rule-${type}`, `${type} rules`, diagram, []);
  UnitOfWork.execute(diagram, uow => diagram.layers.add(layer, uow));
  UnitOfWork.execute(diagram, uow =>
    layer.addRule(
      {
        id: `${type}-rule`,
        name: `${type} rule`,
        type,
        clauses: [
          {
            id: 'name',
            type: 'props',
            path: 'metadata.name',
            relation: 'eq',
            value: type
          }
        ],
        actions: [
          {
            id: 'stylesheet',
            type: 'set-stylesheet',
            elementStyle,
            textStyle
          },
          { id: 'props', type: 'set-props', props }
        ]
      },
      uow
    )
  );

  return layer;
};

describe('diagram property resolution', () => {
  it('resolves node sources with the complete precedence matrix', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();

    addStylesheet(diagram, 'node', 'node-style', {
      fill: { color: 'node-style' },
      text: { color: 'node-text', fontSize: 11 }
    });
    addStylesheet(diagram, 'text', 'text-style', {
      text: { color: 'text-style', fontSize: 12, bold: true }
    });
    addStylesheet(diagram, 'node', 'node-rule-style', {
      fill: { color: 'node-rule-style' }
    });
    addStylesheet(diagram, 'text', 'text-rule-style', {
      text: { color: 'text-rule-style', fontSize: 14, bold: false }
    });

    const parent = layer.addNode({
      id: 'parent',
      props: { fill: { color: 'parent' }, text: { fontSize: 9 }, debug: { anchors: true } }
    });
    const node = layer.addNode({
      id: 'node',
      props: {
        fill: { color: 'stored' },
        text: { fontSize: 13 },
        capabilities: { inheritStyle: true }
      }
    });

    UnitOfWork.execute(diagram, uow => {
      parent.updateMetadata(metadata => (metadata.name = 'parent'), uow);
      node.updateMetadata(metadata => {
        metadata.name = 'node';
        metadata.style = 'node-style';
        metadata.textStyle = 'text-style';
      }, uow);
      node._setParent(parent);
    });

    const filteredNode = layer.addNode({ id: 'filtered' });
    UnitOfWork.execute(diagram, uow =>
      filteredNode.updateMetadata(metadata => {
        metadata.name = 'filtered';
        metadata.style = 'node-style';
        metadata.textStyle = 'text-style';
      }, uow)
    );

    addMatchingRuleLayer(diagram, 'node', 'node-rule-style', 'text-rule-style', {
      fill: { color: 'rule-props' },
      stroke: { width: 5 }
    });

    expect(node.editProps.fill?.color).toBe('stored');
    expect(node.editProps.text?.color).toBe('var(--canvas-fg)');
    expect(node.editProps.text?.fontSize).toBe(13);
    expect(node.editProps.text?.bold).toBe(false);
    expect(node.editProps.debug).toEqual({});

    expect(node.renderProps.fill.color).toBe('rule-props');
    expect(node.renderProps.stroke.width).toBe(5);
    expect(node.renderProps.text.color).toBe('var(--canvas-fg)');
    expect(node.renderProps.text.fontSize).toBe(13);

    // Text styles must not override the node stylesheet's text color.
    expect(filteredNode.editProps.text?.color).toBe('node-text');

    expect(node.getPropsInfo('fill.color')).toEqual([
      { val: 'var(--canvas-bg2)', type: 'default' },
      { val: 'node-style', type: 'style', id: 'node-style' },
      { val: 'node-rule-style', type: 'ruleStyle' },
      { val: 'parent', type: 'parent' },
      { val: 'stored', type: 'stored' },
      { val: 'rule-props', type: 'rule', id: 'rule-node' }
    ]);

    expect(node.getPropsInfo('text.fontSize')).toEqual([
      { val: 10, type: 'default' },
      { val: 11, type: 'style', id: 'node-style' },
      { val: 12, type: 'textStyle', id: 'text-style' },
      { val: 14, type: 'ruleTextStyle' },
      { val: 9, type: 'parent' },
      { val: 13, type: 'stored' }
    ]);
  });

  it('resolves edge sources with rule overrides applied only for rendering', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();

    const style = addStylesheet(diagram, 'edge', 'edge-style', {
      fill: { color: 'edge-fill' },
      stroke: { color: 'edge-style', width: 1 }
    });
    addStylesheet(diagram, 'edge', 'edge-rule-style', {
      stroke: { color: 'edge-rule-style' }
    });

    const edge = layer.addEdge();
    UnitOfWork.execute(diagram, uow => {
      edge.updateMetadata(metadata => {
        metadata.name = 'edge';
        metadata.style = style.id;
      }, uow);
    });

    addMatchingRuleLayer(diagram, 'edge', 'edge-rule-style', '', {
      stroke: { color: 'edge-rule', width: 5 }
    });

    expect(edge.editProps.stroke?.color).toBe('edge-rule-style');
    expect(edge.editProps.stroke?.width).toBe(1);
    expect(edge.editProps.fill?.color).toBe('edge-fill');

    expect(edge.renderProps.stroke.color).toBe('edge-rule');
    expect(edge.renderProps.stroke.width).toBe(5);

    expect(edge.getPropsInfo('stroke.color')).toEqual([
      { val: 'var(--canvas-fg)', type: 'default' },
      { val: 'edge-style', type: 'style', id: 'edge-style' },
      { val: 'edge-rule-style', type: 'ruleStyle' },
      { val: 'edge-rule', type: 'rule', id: 'rule-edge' }
    ]);
  });

  it('refreshes cached values after a stylesheet update', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();
    const style = addStylesheet(diagram, 'edge', 'cache-style', {
      fill: { color: 'before' }
    });
    const edge = layer.addEdge();

    UnitOfWork.execute(diagram, uow =>
      edge.updateMetadata(metadata => (metadata.style = style.id), uow)
    );

    expect(edge.renderProps.fill.color).toBe('before');

    UnitOfWork.execute(diagram, uow => style.setProps({ fill: { color: 'after' } }, uow));

    expect(edge.renderProps.fill.color).toBe('after');
  });

  it('resolves fill.enabled, stroke.enabled and text.enabled to true by default', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();
    const node = layer.addNode({ id: 'default-enabled-node' });

    expect(node.renderProps.fill.enabled).toBe(true);
    expect(node.renderProps.stroke.enabled).toBe(true);
    expect(node.renderProps.text.enabled).toBe(true);
  });
});
