import { describe, test, expect, beforeEach } from 'vitest';
import { textToDiagram, _test } from './textToDiagram';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { AnchorEndpoint, ConnectedEndpoint } from '@diagram-craft/model/endpoint';
import type { ParsedElement } from './parser';
import { isNode, isEdge } from '@diagram-craft/model/diagramElement';
import type { TestLayerBuilder } from '@diagram-craft/model/test-support/testModel';
import type { TestDiagramBuilder } from '@diagram-craft/model/test-support/testModel';

const { parsePropsString, parseMetadataString, updateOrCreateLabelNode } = _test;

describe('textToDiagram', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;

  beforeEach(() => {
    const setup = TestModel.newDiagramWithLayer();
    diagram = setup.diagram;
    layer = setup.layer;
  });

  describe('parsePropsString', () => {
    test('parses simple key-value pair', () => {
      const result = parsePropsString('color=red');
      expect(result).toEqual({ color: 'red' });
    });

    test('parses nested properties', () => {
      const result = parsePropsString('fill.color=#ff0000');
      expect(result).toEqual({ fill: { color: '#ff0000' } });
    });

    test('parses multiple properties', () => {
      const result = parsePropsString('fill.color=#ff0000;stroke.width=2');
      expect(result).toEqual({
        fill: { color: '#ff0000' },
        stroke: { width: 2 }
      });
    });

    test('parses boolean values', () => {
      const result = parsePropsString('enabled=true;disabled=false');
      expect(result).toEqual({ enabled: true, disabled: false });
    });

    test('parses numeric values', () => {
      const result = parsePropsString('width=100;height=200.5');
      expect(result).toEqual({ width: 100, height: 200.5 });
    });

    test('parses deeply nested properties', () => {
      const result = parsePropsString('arrow.start.type=SQUARE_ARROW_OUTLINE');
      expect(result).toEqual({
        arrow: { start: { type: 'SQUARE_ARROW_OUTLINE' } }
      });
    });

    test('handles empty string', () => {
      const result = parsePropsString('');
      expect(result).toEqual({});
    });

    test('skips invalid pairs', () => {
      const result = parsePropsString('valid=true;;novalue=;=nokey');
      // Empty string value is parsed as 0, which is valid
      expect(result).toEqual({ valid: true, novalue: 0 });
    });

    test('handles multiple nested levels', () => {
      const result = parsePropsString('a.b.c.d=value');
      expect(result).toEqual({
        a: { b: { c: { d: 'value' } } }
      });
    });
  });

  describe('parseMetadataString', () => {
    test('parses name metadata', () => {
      const result = parseMetadataString('name=TestNode');
      expect(result).toEqual({ name: 'TestNode' });
    });

    test('ignores unknown metadata keys', () => {
      const result = parseMetadataString('name=Test;unknown=value');
      expect(result).toEqual({ name: 'Test' });
    });

    test('handles empty string', () => {
      const result = parseMetadataString('');
      expect(result).toEqual({});
    });

    test('skips invalid pairs', () => {
      const result = parseMetadataString('name=Valid;;novalue=');
      expect(result).toEqual({ name: 'Valid' });
    });
  });

  describe('updateOrCreateLabelNode', () => {
    test('updates existing single label node', () => {
      const edge = layer.addEdge({ id: 'e1' });
      const labelNode = layer.createNode({ id: 'label1', type: 'text' });
      labelNode.setText('Original', UnitOfWork.immediate(diagram));

      edge.addChild(labelNode, UnitOfWork.immediate(diagram));
      edge.labelNodes.push(labelNode.asLabelNode());

      const uow = new UnitOfWork(diagram, true);
      const result = updateOrCreateLabelNode(edge, 'Updated', uow, layer);
      uow.commit();

      expect(result.id).toBe('label1');
      expect(result.getText()).toBe('Updated');
    });

    test('creates new label node when none exists', () => {
      const edge = layer.addEdge({ id: 'e1' });

      const uow = new UnitOfWork(diagram, true);
      const result = updateOrCreateLabelNode(edge, 'New Label', uow, layer);
      uow.commit();

      expect(result.getText()).toBe('New Label');
      expect(edge.labelNodes.length).toBe(1);
      expect(edge.labelNodes[0]!.id).toBe(result.id);
    });

    test('replaces multiple label nodes with single one', () => {
      const edge = layer.addEdge({ id: 'e1' });
      const label1 = layer.createNode({ id: 'label1', type: 'text' });
      const label2 = layer.createNode({ id: 'label2', type: 'text' });

      label1.setText('Label 1', UnitOfWork.immediate(diagram));
      label2.setText('Label 2', UnitOfWork.immediate(diagram));

      edge.addChild(label1, UnitOfWork.immediate(diagram));
      edge.addChild(label2, UnitOfWork.immediate(diagram));
      edge.labelNodes.push(label1.asLabelNode());
      edge.labelNodes.push(label2.asLabelNode());

      const uow = new UnitOfWork(diagram, true);
      const result = updateOrCreateLabelNode(edge, 'Single Label', uow, layer);
      uow.commit();

      expect(result.getText()).toBe('Single Label');
      expect(edge.labelNodes.length).toBe(1);
    });

    test('throws error when called on non-edge element', () => {
      const node = layer.addNode({ id: 'n1', type: 'rect' });
      const uow = new UnitOfWork(diagram, true);

      expect(() => {
        updateOrCreateLabelNode(node, 'Test', uow, layer);
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
          props: 'fill.color=#ff0000;stroke.width=2',
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

    test('adds node with metadata', () => {
      const elements: ParsedElement[] = [
        { id: '1', type: 'node', shape: 'rect', metadata: 'name=TestNode', line: 0 }
      ];

      textToDiagram(elements, diagram);

      const node = diagram.lookup('1');
      expect(node).toBeDefined();
      if (isNode(node!)) {
        expect(node!.metadata.name).toBe('TestNode');
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

    test('adds edge without connections', () => {
      const elements: ParsedElement[] = [{ id: 'e1', type: 'edge', line: 0 }];

      textToDiagram(elements, diagram);

      expect(layer.elements.length).toBe(1);
      const edge = diagram.lookup('e1');
      expect(edge).toBeDefined();
      expect(isEdge(edge!)).toBe(true);
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

    test('adds edge with props', () => {
      const elements: ParsedElement[] = [
        {
          id: 'e1',
          type: 'edge',
          props: 'arrow.start.type=SQUARE_ARROW_OUTLINE',
          line: 0
        }
      ];

      textToDiagram(elements, diagram);

      const edge = diagram.lookup('e1');
      expect(edge).toBeDefined();
      if (isEdge(edge!)) {
        expect(edge!.renderProps.arrow?.start?.type).toBe('SQUARE_ARROW_OUTLINE');
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
      node.setText('Original', UnitOfWork.immediate(diagram));

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
      node.updateProps(props => {
        props.fill = { color: '#ff0000' };
      }, UnitOfWork.immediate(diagram));

      const elements: ParsedElement[] = [
        { id: '1', type: 'node', shape: 'rect', props: 'fill.color=#00ff00', line: 0 }
      ];

      textToDiagram(elements, diagram);

      const updated = diagram.lookup('1');
      expect(updated).toBeDefined();
      if (isNode(updated!)) {
        expect(updated!.renderProps.fill?.color).toBe('#00ff00');
      }
    });

    test('updates node metadata', () => {
      layer.addNode({ id: '1', type: 'rect' });

      const elements: ParsedElement[] = [
        { id: '1', type: 'node', shape: 'rect', metadata: 'name=NewName', line: 0 }
      ];

      textToDiagram(elements, diagram);

      const updated = diagram.lookup('1');
      expect(updated).toBeDefined();
      if (isNode(updated!)) {
        expect(updated!.metadata.name).toBe('NewName');
      }
    });

    test('updates node stylesheets', () => {
      layer.addNode({ id: '1', type: 'rect' });

      const elements: ParsedElement[] = [
        {
          id: '1',
          type: 'node',
          shape: 'rect',
          stylesheet: 'new-style',
          textStylesheet: 'h2',
          line: 0
        }
      ];

      textToDiagram(elements, diagram);

      const updated = diagram.lookup('1');
      expect(updated).toBeDefined();
      if (isNode(updated!)) {
        expect(updated!.metadata.style).toBe('new-style');
        expect(updated!.metadata.textStyle).toBe('h2');
      }
    });

    test('updates edge connections', () => {
      const n1 = layer.addNode({ id: 'n1', type: 'rect' });
      const n2 = layer.addNode({ id: 'n2', type: 'rect' });
      layer.addNode({ id: 'n3', type: 'rect' });
      const edge = layer.addEdge({ id: 'e1' });
      edge.setStart(new AnchorEndpoint(n1, 'c'), UnitOfWork.immediate(diagram));
      edge.setEnd(new AnchorEndpoint(n2, 'c'), UnitOfWork.immediate(diagram));

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
      label.setText('Original', UnitOfWork.immediate(diagram));
      edge.addChild(label, UnitOfWork.immediate(diagram));
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

    test('removes edge label when not specified', () => {
      const edge = layer.addEdge({ id: 'e1' });
      const label = layer.createNode({ id: 'label1', type: 'text' });
      label.setText('Label', UnitOfWork.immediate(diagram));
      edge.addChild(label, UnitOfWork.immediate(diagram));
      edge.labelNodes.push(label.asLabelNode());

      const elements: ParsedElement[] = [{ id: 'e1', type: 'edge', line: 0 }];

      textToDiagram(elements, diagram);

      const updated = diagram.lookup('e1');
      expect(updated).toBeDefined();
      if (isEdge(updated!)) {
        expect(updated!.labelNodes.length).toBe(0);
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

    test('updates selection when removing selected elements', () => {
      const n1 = layer.addNode({ id: '1', type: 'rect' });
      const n2 = layer.addNode({ id: '2', type: 'rect' });

      diagram.selection.setElements([n1, n2]);
      expect(diagram.selection.elements.length).toBe(2);

      const elements: ParsedElement[] = [{ id: '1', type: 'node', shape: 'rect', line: 0 }];

      textToDiagram(elements, diagram);

      expect(diagram.selection.elements.length).toBe(1);
      expect(diagram.selection.elements[0]?.id).toBe('1');
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
      child.setText('Original', UnitOfWork.immediate(diagram));
      parent.addChild(child, UnitOfWork.immediate(diagram));

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

  describe('textToDiagram - undo/redo support', () => {
    test('creates undoable action for additions', () => {
      const elements: ParsedElement[] = [{ id: '1', type: 'node', shape: 'rect', line: 0 }];

      textToDiagram(elements, diagram);

      expect(diagram.lookup('1')).toBeDefined();
      expect(layer.elements.length).toBe(1);

      diagram.undoManager.undo();
      expect(layer.elements.length).toBe(0);

      diagram.undoManager.redo();
      expect(layer.elements.length).toBe(1);
    });

    test('creates undoable action for updates', () => {
      const node = layer.addNode({ id: '1', type: 'text' });
      node.setText('Original', UnitOfWork.immediate(diagram));

      const elements: ParsedElement[] = [
        { id: '1', type: 'node', shape: 'text', name: 'Updated', line: 0 }
      ];

      textToDiagram(elements, diagram);

      const updated = diagram.lookup('1');
      if (isNode(updated!)) {
        expect(updated!.getText()).toBe('Updated');
      }

      diagram.undoManager.undo();
      const reverted = diagram.lookup('1');
      if (isNode(reverted!)) {
        expect(reverted!.getText()).toBe('Original');
      }

      diagram.undoManager.redo();
      const reapplied = diagram.lookup('1');
      if (isNode(reapplied!)) {
        expect(reapplied!.getText()).toBe('Updated');
      }
    });

    test('handles mixed operations without errors', () => {
      // Add initial nodes
      const n1 = layer.addNode({ id: '1', type: 'rect' });
      n1.setText('Original', UnitOfWork.immediate(diagram));
      layer.addNode({ id: '2', type: 'rect' });

      // Perform add, update, and remove in one operation
      const elements: ParsedElement[] = [
        { id: '1', type: 'node', shape: 'rect', name: 'Updated', line: 0 },
        { id: '3', type: 'node', shape: 'circle', line: 1 }
      ];

      // Should not throw
      expect(() => {
        textToDiagram(elements, diagram);
      }).not.toThrow();

      // Verify the operations were applied
      expect(layer.elements.length).toBe(2);
      const updated1 = diagram.lookup('1');
      if (isNode(updated1!)) {
        expect(updated1!.getText()).toBe('Updated');
      }
      expect(diagram.lookup('2')).toBeUndefined();
      expect(diagram.lookup('3')).toBeDefined();
    });
  });

  describe('textToDiagram - edge cases', () => {
    test('handles empty elements array', () => {
      layer.addNode({ id: '1', type: 'rect' });

      textToDiagram([], diagram);

      expect(layer.elements.length).toBe(0);
    });

    test('handles edge with non-existent node references', () => {
      const elements: ParsedElement[] = [
        { id: 'e1', type: 'edge', from: 'nonexistent1', to: 'nonexistent2', line: 0 }
      ];

      textToDiagram(elements, diagram);

      const edge = diagram.lookup('e1');
      expect(edge).toBeDefined();
      // Edge should be created but with free endpoints since nodes don't exist
      expect(isEdge(edge!)).toBe(true);
    });

    test('handles mixed add, update, and remove operations', () => {
      layer.addNode({ id: '1', type: 'rect' });
      layer.addNode({ id: '2', type: 'rect' });

      const elements: ParsedElement[] = [
        { id: '1', type: 'node', shape: 'rect', name: 'Updated 1', line: 0 },
        { id: '3', type: 'node', shape: 'circle', line: 1 }
      ];

      textToDiagram(elements, diagram);

      expect(layer.elements.length).toBe(2);
      expect(diagram.lookup('1')).toBeDefined();
      expect(diagram.lookup('2')).toBeUndefined();
      expect(diagram.lookup('3')).toBeDefined();

      const node1 = diagram.lookup('1');
      if (isNode(node1!)) {
        expect(node1!.getText()).toBe('Updated 1');
      }
    });
  });
});
