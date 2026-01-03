import { beforeEach, describe, expect, test } from 'vitest';
import { _test, textToDiagram } from './textToDiagram';
import type {
  TestDiagramBuilder,
  TestLayerBuilder
} from '@diagram-craft/model/test-support/testModel';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { AnchorEndpoint, ConnectedEndpoint } from '@diagram-craft/model/endpoint';
import type { ParsedElement } from './types';
import { isEdge, isNode } from '@diagram-craft/model/diagramElement';

const { updateOrCreateLabelNode } = _test;

describe('textToDiagram', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;

  beforeEach(() => {
    const setup = TestModel.newDiagramWithLayer();
    diagram = setup.diagram;
    layer = setup.layer;
  });

  describe('updateOrCreateLabelNode', () => {
    test('updates existing single label node', () => {
      const edge = layer.addEdge({ id: 'e1' });
      const labelNode = layer.createNode({ id: 'label1', type: 'text' });
      UnitOfWork.execute(diagram, uow => labelNode.setText('Original', uow));

      UnitOfWork.execute(diagram, uow => edge.addChild(labelNode, uow));
      edge.labelNodes.push(labelNode.asLabelNode());

      const result = UnitOfWork.execute(diagram, uow =>
        updateOrCreateLabelNode(edge, 'Updated', uow, layer)
      );

      expect(result.id).toBe('label1');
      expect(result.getText()).toBe('Updated');
    });

    test('creates new label node when none exists', () => {
      const edge = layer.addEdge({ id: 'e1' });

      const result = UnitOfWork.execute(diagram, uow =>
        updateOrCreateLabelNode(edge, 'New Label', uow, layer)
      );

      expect(result.getText()).toBe('New Label');
      expect(edge.labelNodes.length).toBe(1);
      expect(edge.labelNodes[0]!.id).toBe(result.id);
    });

    test('replaces multiple label nodes with single one', () => {
      const edge = layer.addEdge({ id: 'e1' });
      const label1 = layer.createNode({ id: 'label1', type: 'text' });
      const label2 = layer.createNode({ id: 'label2', type: 'text' });

      UnitOfWork.execute(diagram, uow => label1.setText('Label 1', uow));
      UnitOfWork.execute(diagram, uow => label2.setText('Label 2', uow));

      UnitOfWork.execute(diagram, uow => edge.addChild(label1, uow));
      UnitOfWork.execute(diagram, uow => edge.addChild(label2, uow));
      edge.labelNodes.push(label1.asLabelNode());
      edge.labelNodes.push(label2.asLabelNode());

      const result = UnitOfWork.execute(diagram, uow =>
        updateOrCreateLabelNode(edge, 'Single Label', uow, layer)
      );

      expect(result.getText()).toBe('Single Label');
      expect(edge.labelNodes.length).toBe(1);
    });

    test('throws error when called on non-edge element', () => {
      const node = layer.addNode({ id: 'n1', type: 'rect' });

      expect(() => {
        UnitOfWork.execute(diagram, uow => updateOrCreateLabelNode(node, 'Test', uow, layer));
      }).toThrow('Element is not an edge');
    });
  });

  describe('textToDiagram - add new elements', () => {
    test('adds simple node', () => {
      const elements: ParsedElement[] = [{ id: '1', type: 'node', shape: 'rect', line: 0 }];

      textToDiagram(elements, diagram);

      expect(layer.elements.length).toBe(1);
      const node = diagram.lookup('1');
      expect(node).toBeDefined();
      expect(isNode(node!)).toBe(true);
    });

    test('adds node with text', () => {
      const elements: ParsedElement[] = [
        { id: '1', type: 'node', shape: 'text', name: 'Hello', line: 0 }
      ];

      textToDiagram(elements, diagram);

      const node = diagram.lookup('1');
      expect(node).toBeDefined();
      if (isNode(node!)) {
        expect(node!.getText()).toBe('Hello');
      }
    });

    test('adds node with props', () => {
      const elements: ParsedElement[] = [
        {
          id: '1',
          type: 'node',
          shape: 'rect',
          props: {
            fill: { color: '#ff0000' },
            stroke: { width: 2 }
          },
          line: 0
        }
      ];

      textToDiagram(elements, diagram);

      const node = diagram.lookup('1');
      expect(node).toBeDefined();
      if (isNode(node!)) {
        expect(node!.renderProps.fill?.color).toBe('#ff0000');
        expect(node!.renderProps.stroke?.width).toBe(2);
      }
    });

    test('adds node with stylesheets', () => {
      const elements: ParsedElement[] = [
        {
          id: '1',
          type: 'node',
          shape: 'rect',
          stylesheet: 'custom-style',
          textStylesheet: 'h1',
          line: 0
        }
      ];

      textToDiagram(elements, diagram);

      const node = diagram.lookup('1');
      expect(node).toBeDefined();
      if (isNode(node!)) {
        expect(node!.metadata.style).toBe('custom-style');
        expect(node!.metadata.textStyle).toBe('h1');
      }
    });

    test('adds edge with connections', () => {
      // Pre-existing nodes in the diagram
      layer.addNode({ id: 'n1', type: 'rect' });
      layer.addNode({ id: 'n2', type: 'rect' });

      // Must include the nodes in parsed elements too, otherwise they will be removed
      const elements: ParsedElement[] = [
        { id: 'n1', type: 'node', shape: 'rect', line: 0 },
        { id: 'n2', type: 'node', shape: 'rect', line: 1 },
        { id: 'e1', type: 'edge', from: 'n1', to: 'n2', line: 2 }
      ];

      textToDiagram(elements, diagram);

      const edge = diagram.lookup('e1');
      expect(edge).toBeDefined();
      if (isEdge(edge!)) {
        expect((edge!.start as ConnectedEndpoint).node?.id).toBe('n1');
        expect((edge!.end as ConnectedEndpoint).node?.id).toBe('n2');
      }
    });

    test('adds edge with label', () => {
      const elements: ParsedElement[] = [{ id: 'e1', type: 'edge', label: 'Edge Label', line: 0 }];

      textToDiagram(elements, diagram);

      const edge = diagram.lookup('e1');
      expect(edge).toBeDefined();
      if (isEdge(edge!)) {
        expect(edge!.labelNodes.length).toBe(1);
        expect(edge!.labelNodes[0]!.node().getText()).toBe('Edge Label');
      }
    });

    test('adds multiple elements', () => {
      const elements: ParsedElement[] = [
        { id: '1', type: 'node', shape: 'rect', line: 0 },
        { id: '2', type: 'node', shape: 'circle', line: 1 },
        { id: 'e1', type: 'edge', from: '1', to: '2', line: 2 }
      ];

      textToDiagram(elements, diagram);

      expect(layer.elements.length).toBe(3);
      expect(diagram.lookup('1')).toBeDefined();
      expect(diagram.lookup('2')).toBeDefined();
      expect(diagram.lookup('e1')).toBeDefined();
    });
  });

  describe('textToDiagram - update existing elements', () => {
    test('updates node text', () => {
      const node = layer.addNode({ id: '1', type: 'text' });
      UnitOfWork.execute(diagram, uow => node.setText('Original', uow));

      const elements: ParsedElement[] = [
        { id: '1', type: 'node', shape: 'text', name: 'Updated', line: 0 }
      ];

      textToDiagram(elements, diagram);

      const updated = diagram.lookup('1');
      expect(updated).toBeDefined();
      if (isNode(updated!)) {
        expect(updated!.getText()).toBe('Updated');
      }
    });

    test('updates node props', () => {
      const node = layer.addNode({ id: '1', type: 'rect' });
      UnitOfWork.execute(diagram, uow =>
        node.updateProps(props => {
          props.fill = { color: '#ff0000' };
        }, uow)
      );

      const elements: ParsedElement[] = [
        {
          id: '1',
          type: 'node',
          shape: 'rect',
          props: { fill: { color: '#00ff00' } },
          line: 0
        }
      ];

      textToDiagram(elements, diagram);

      const updated = diagram.lookup('1');
      expect(updated).toBeDefined();
      if (isNode(updated!)) {
        expect(updated!.renderProps.fill?.color).toBe('#00ff00');
      }
    });

    test('updates edge connections', () => {
      const n1 = layer.addNode({ id: 'n1', type: 'rect' });
      const n2 = layer.addNode({ id: 'n2', type: 'rect' });
      layer.addNode({ id: 'n3', type: 'rect' });
      const edge = layer.addEdge({ id: 'e1' });
      UnitOfWork.execute(diagram, uow => edge.setStart(new AnchorEndpoint(n1, 'c'), uow));
      UnitOfWork.execute(diagram, uow => edge.setEnd(new AnchorEndpoint(n2, 'c'), uow));

      // Must include all nodes in parsed elements too, otherwise they will be removed
      const elements: ParsedElement[] = [
        { id: 'n1', type: 'node', shape: 'rect', line: 0 },
        { id: 'n2', type: 'node', shape: 'rect', line: 1 },
        { id: 'n3', type: 'node', shape: 'rect', line: 2 },
        { id: 'e1', type: 'edge', from: 'n2', to: 'n3', line: 3 }
      ];

      textToDiagram(elements, diagram);

      const updated = diagram.lookup('e1');
      expect(updated).toBeDefined();
      if (isEdge(updated!)) {
        expect((updated!.start as ConnectedEndpoint).node?.id).toBe('n2');
        expect((updated!.end as ConnectedEndpoint).node?.id).toBe('n3');
      }
    });

    test('updates edge label', () => {
      const edge = layer.addEdge({ id: 'e1' });
      const label = layer.createNode({ id: 'label1', type: 'text' });
      UnitOfWork.execute(diagram, uow => label.setText('Original', uow));
      UnitOfWork.execute(diagram, uow => edge.addChild(label, uow));
      edge.labelNodes.push(label.asLabelNode());

      const elements: ParsedElement[] = [
        { id: 'e1', type: 'edge', label: 'Updated Label', line: 0 }
      ];

      textToDiagram(elements, diagram);

      const updated = diagram.lookup('e1');
      expect(updated).toBeDefined();
      if (isEdge(updated!)) {
        expect(updated!.labelNodes.length).toBe(1);
        expect(updated!.labelNodes[0]!.node().getText()).toBe('Updated Label');
      }
    });
  });

  describe('textToDiagram - remove elements', () => {
    test('removes elements not in parsed data', () => {
      layer.addNode({ id: '1', type: 'rect' });
      layer.addNode({ id: '2', type: 'rect' });
      layer.addNode({ id: '3', type: 'rect' });

      const elements: ParsedElement[] = [{ id: '1', type: 'node', shape: 'rect', line: 0 }];

      textToDiagram(elements, diagram);

      expect(layer.elements.length).toBe(1);
      expect(diagram.lookup('1')).toBeDefined();
      expect(diagram.lookup('2')).toBeUndefined();
      expect(diagram.lookup('3')).toBeUndefined();
    });
  });

  describe('textToDiagram - nested elements', () => {
    test('processes nested children', () => {
      const elements: ParsedElement[] = [
        {
          id: 'parent',
          type: 'node',
          shape: 'group',
          line: 0,
          children: [
            { id: 'child1', type: 'node', shape: 'rect', line: 1 },
            { id: 'child2', type: 'node', shape: 'circle', line: 2 }
          ]
        }
      ];

      textToDiagram(elements, diagram);

      expect(diagram.lookup('parent')).toBeDefined();
      expect(diagram.lookup('child1')).toBeDefined();
      expect(diagram.lookup('child2')).toBeDefined();
    });

    test('updates nested children', () => {
      const parent = layer.addNode({ id: 'parent', type: 'group' });
      const child = layer.createNode({ id: 'child', type: 'text' });
      UnitOfWork.execute(diagram, uow => child.setText('Original', uow));
      UnitOfWork.execute(diagram, uow => parent.addChild(child, uow));

      const elements: ParsedElement[] = [
        {
          id: 'parent',
          type: 'node',
          shape: 'group',
          line: 0,
          children: [{ id: 'child', type: 'node', shape: 'text', name: 'Updated', line: 1 }]
        }
      ];

      textToDiagram(elements, diagram);

      const updated = diagram.lookup('child');
      expect(updated).toBeDefined();
      if (isNode(updated!)) {
        expect(updated!.getText()).toBe('Updated');
      }
    });
  });
});
