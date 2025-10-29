import { describe, test, expect } from 'vitest';
import { defaultSerializer } from './serializer';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { AnchorEndpoint } from '@diagram-craft/model/endpoint';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';

const serialize = (layer: RegularLayer) => defaultSerializer.serialize(layer);

describe('serializer', () => {
  test('converts simple node', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    layer.addNode({ id: '1', type: 'rect' });

    const result = serialize(layer);

    expect(result).toEqual(['1: rect', '']);
  });

  test('converts node with text', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ id: '2', type: 'text' });
    node.setText('Hello World', UnitOfWork.immediate(layer.diagram));

    const result = serialize(layer);

    expect(result).toEqual(['2: text "Hello World"', '']);
  });

  test('converts node with custom props', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ id: '3', type: 'rect' });
    node.updateProps(props => {
      props.stroke = { enabled: false };
      props.fill = { enabled: true, color: '#ff0000' };
    }, UnitOfWork.immediate(layer.diagram));

    const result = serialize(layer);

    expect(result.length).toBe(4); // opening line, props line, closing brace, blank line
    expect(result[0]).toContain('3: rect {');
    expect(result[1]).toContain(
      'props: "stroke.enabled=false;fill.enabled=true;fill.color=#ff0000"'
    );
    expect(result[2]).toBe('}');
    expect(result[3]).toBe('');
  });

  test('converts node with metadata name', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ id: '4', type: 'rect' });
    node.updateMetadata(metadata => {
      metadata.name = 'TestNode';
    }, UnitOfWork.immediate(layer.diagram));

    const result = serialize(layer);

    expect(result.length).toBe(4); // opening line, metadata line, closing brace, blank line
    expect(result[0]).toContain('4: rect {');
    expect(result.some(line => line.includes('metadata: "name=TestNode"'))).toBe(true);
    expect(result[2]).toBe('}');
    expect(result[3]).toBe('');
  });

  test('converts node with custom styles', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ id: '5', type: 'rect' });
    node.updateMetadata(metadata => {
      metadata.style = 'custom-style';
      metadata.textStyle = 'custom-text-style';
    }, UnitOfWork.immediate(layer.diagram));

    const result = serialize(layer);

    expect(result.length).toBe(4); // opening line, stylesheet line, closing brace, blank line
    expect(result[0]).toContain('5: rect {');
    expect(result.some(line => line.includes('stylesheet: custom-style / custom-text-style'))).toBe(
      true
    );
    expect(result[2]).toBe('}');
    expect(result[3]).toBe('');
  });

  test('filters out default styles', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ id: '6', type: 'rect' });
    node.updateMetadata(metadata => {
      metadata.style = 'default';
      metadata.textStyle = 'default-text-default';
    }, UnitOfWork.immediate(layer.diagram));

    const result = serialize(layer);

    // Should not include stylesheet line when using default styles
    expect(result).toEqual(['6: rect', '']);
  });

  test('converts node with children', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const parent = layer.addNode({ id: 'parent', type: 'group' });
    const child = layer.createNode({ id: 'child', type: 'text' });
    child.setText('Child text', UnitOfWork.immediate(layer.diagram));
    parent.addChild(child, UnitOfWork.immediate(layer.diagram));

    const result = serialize(layer);

    expect(result.length).toBeGreaterThan(2);
    expect(result[0]).toContain('parent: group {');
    expect(result.some(line => line.trim().startsWith('child: text "Child text"'))).toBe(true);
    expect(result.some(line => line === '}')).toBe(true);
  });

  test('converts simple edge', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    layer.addEdge({ id: 'e1' });

    const result = serialize(layer);

    expect(result).toEqual(['e1: edge', '']);
  });

  test('converts connected edge', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node1 = layer.addNode({ id: 'n1', type: 'rect' });
    const node2 = layer.addNode({ id: 'n2', type: 'rect' });
    const edge = layer.addEdge({ id: 'e1' });

    // Connect edge to nodes using AnchorEndpoint
    edge.setStart(new AnchorEndpoint(node1, 'c'), UnitOfWork.immediate(layer.diagram));
    edge.setEnd(new AnchorEndpoint(node2, 'c'), UnitOfWork.immediate(layer.diagram));

    const result = serialize(layer);

    // Find the edge line
    const edgeLine = result.find(line => line.startsWith('e1:'));
    expect(edgeLine).toContain('n1 -> n2');
  });

  test('converts edge with single label node inline', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const edge = layer.addEdge({ id: 'e1' });
    const labelNode = layer.createNode({ id: 'label1', type: 'text' });
    labelNode.setText('Edge Label', UnitOfWork.immediate(layer.diagram));

    // Add label node as child of edge
    edge.addChild(labelNode, UnitOfWork.immediate(layer.diagram));
    edge.labelNodes.push(labelNode.asLabelNode());

    const result = serialize(layer);

    // The label should be shown inline, not as a child
    const edgeLine = result.find(line => line.startsWith('e1:'));
    expect(edgeLine).toContain('"Edge Label"');

    // Label node should not be listed separately as child
    const hasLabelAsChild = result.some(
      line => line.trim().startsWith('label1:') && line !== edgeLine
    );
    expect(hasLabelAsChild).toBe(false);
  });

  test('converts edge with props', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const edge = layer.addEdge({ id: 'e1' });
    edge.updateProps(props => {
      props.arrow = {
        start: { type: 'SQUARE_ARROW_OUTLINE' },
        end: { type: 'CROWS_FEET_BAR' }
      };
    }, UnitOfWork.immediate(layer.diagram));

    const result = serialize(layer);

    expect(result.length).toBeGreaterThan(2);
    expect(result[0]).toContain('e1: edge {');
    expect(
      result.some(line =>
        line.includes('arrow.start.type=SQUARE_ARROW_OUTLINE;arrow.end.type=CROWS_FEET_BAR')
      )
    ).toBe(true);
  });

  test('converts multiple elements with blank lines between', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    layer.addNode({ id: '1', type: 'rect' });
    layer.addNode({ id: '2', type: 'circle' });
    layer.addEdge({ id: 'e1' });

    const result = serialize(layer);

    expect(result).toEqual(['1: rect', '', '2: circle', '', 'e1: edge', '']);
  });

  test('converts nested structure with proper indentation', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const parent = layer.addNode({ id: 'parent1', type: 'group' });
    const child1 = layer.createNode({ id: 'child1', type: 'group' });
    const grandchild1 = layer.createNode({ id: 'grandchild1', type: 'text' });
    const grandchild2 = layer.createNode({ id: 'grandchild2', type: 'text' });

    grandchild1.setText('GC 1', UnitOfWork.immediate(layer.diagram));
    grandchild2.setText('GC 2', UnitOfWork.immediate(layer.diagram));

    child1.addChild(grandchild1, UnitOfWork.immediate(layer.diagram));
    child1.addChild(grandchild2, UnitOfWork.immediate(layer.diagram));
    parent.addChild(child1, UnitOfWork.immediate(layer.diagram));

    const result = serialize(layer);

    // Check for proper indentation
    expect(result[0]).toBe('parent1: group {');
    expect(result.some(line => line.startsWith('  child1: group {'))).toBe(true);
    expect(result.some(line => line.startsWith('    grandchild1: text "GC 1"'))).toBe(true);
    expect(result.some(line => line.startsWith('    grandchild2: text "GC 2"'))).toBe(true);
  });

  test('handles empty layer', () => {
    const { layer } = TestModel.newDiagramWithLayer();

    const result = serialize(layer);

    expect(result).toEqual([]);
  });

  test('converts node with both text and props', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ id: '1', type: 'text' });
    node.setText('Test Text', UnitOfWork.immediate(layer.diagram));
    node.updateProps(props => {
      props.stroke = { enabled: false };
    }, UnitOfWork.immediate(layer.diagram));

    const result = serialize(layer);

    expect(result[0]).toContain('1: text "Test Text" {');
    expect(result.some(line => line.includes('props: "stroke.enabled=false"'))).toBe(true);
  });

  test('converts edge with only style set', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ id: '1', type: 'rect' });
    node.updateMetadata(metadata => {
      metadata.style = 'custom-style';
    }, UnitOfWork.immediate(layer.diagram));

    const result = serialize(layer);

    expect(result.some(line => line.includes('stylesheet: custom-style /'))).toBe(true);
  });

  test('converts edge with only textStyle set', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ id: '1', type: 'rect' });
    node.updateMetadata(metadata => {
      metadata.textStyle = 'h1';
    }, UnitOfWork.immediate(layer.diagram));

    const result = serialize(layer);

    expect(result.some(line => line.includes('stylesheet: / h1'))).toBe(true);
  });

  test('filters out default-text style', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ id: '1', type: 'rect' });
    node.updateMetadata(metadata => {
      metadata.style = 'default-text';
    }, UnitOfWork.immediate(layer.diagram));

    const result = serialize(layer);

    // Should not include stylesheet line when using default-text style
    expect(result).toEqual(['1: rect', '']);
  });

  test('converts node with ID containing spaces to quoted format', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    layer.addNode({ id: 'my node', type: 'rect' });

    const result = serialize(layer);

    expect(result).toEqual(['"my node": rect', '']);
  });

  test('converts node with ID without spaces to unquoted format', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    layer.addNode({ id: 'myNode', type: 'rect' });

    const result = serialize(layer);

    expect(result).toEqual(['myNode: rect', '']);
  });

  test('converts edge with endpoint IDs containing spaces to quoted format', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node1 = layer.addNode({ id: 'node 1', type: 'rect' });
    const node2 = layer.addNode({ id: 'node 2', type: 'rect' });
    const edge = layer.addEdge({ id: 'edge 1' });

    edge.setStart(new AnchorEndpoint(node1, 'c'), UnitOfWork.immediate(layer.diagram));
    edge.setEnd(new AnchorEndpoint(node2, 'c'), UnitOfWork.immediate(layer.diagram));

    const result = serialize(layer);

    const edgeLine = result.find(line => line.startsWith('"edge 1":'));
    expect(edgeLine).toContain('"node 1" -> "node 2"');
  });

  test('converts edge with mixed quoted and unquoted endpoint IDs', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node1 = layer.addNode({ id: 'node 1', type: 'rect' });
    const node2 = layer.addNode({ id: 'simpleNode', type: 'rect' });
    const edge = layer.addEdge({ id: 'e1' });

    edge.setStart(new AnchorEndpoint(node1, 'c'), UnitOfWork.immediate(layer.diagram));
    edge.setEnd(new AnchorEndpoint(node2, 'c'), UnitOfWork.immediate(layer.diagram));

    const result = serialize(layer);

    const edgeLine = result.find(line => line.startsWith('e1:'));
    expect(edgeLine).toContain('"node 1" -> simpleNode');
  });

  test('converts nested structure with quoted IDs', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const parent = layer.addNode({ id: 'parent node', type: 'group' });
    const child = layer.createNode({ id: 'child node', type: 'text' });
    child.setText('Child text', UnitOfWork.immediate(layer.diagram));
    parent.addChild(child, UnitOfWork.immediate(layer.diagram));

    const result = serialize(layer);

    expect(result[0]).toBe('"parent node": group {');
    expect(result.some(line => line.trim().startsWith('"child node": text "Child text"'))).toBe(
      true
    );
    expect(result.some(line => line === '}')).toBe(true);
  });

  test('converts node with ID containing spaces and props', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ id: 'my node', type: 'rect' });
    node.updateProps(props => {
      props.stroke = { enabled: false };
    }, UnitOfWork.immediate(layer.diagram));

    const result = serialize(layer);

    expect(result[0]).toContain('"my node": rect {');
    expect(result.some(line => line.includes('props: "stroke.enabled=false"'))).toBe(true);
  });
});
