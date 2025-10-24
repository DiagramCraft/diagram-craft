import { describe, test, expect, beforeEach } from 'vitest';
import { NavigateNodeAction } from './navigateNodeAction';
import { ActionContext } from '@diagram-craft/canvas/action';
import { model } from '@diagram-craft/canvas/modelState';
import {
  TestDiagramBuilder,
  TestModel,
  TestLayerBuilder
} from '@diagram-craft/model/test-support/builder';

const context: ActionContext = { model };

describe('NavigateNodeAction', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    layer = diagram.newLayer();
    model.activeDiagram = diagram;
  });

  test('should find closest node to the east', () => {
    // Setup: Create nodes in a horizontal line
    layer.addNode({ id: 'node1', bounds: { x: 0, y: 50, w: 50, h: 50, r: 0 } });
    layer.addNode({ id: 'node2', bounds: { x: 100, y: 50, w: 50, h: 50, r: 0 } });
    layer.addNode({ id: 'node3', bounds: { x: 200, y: 50, w: 50, h: 50, r: 0 } });
    diagram.selection.setElements([layer.elements[0]!]);

    // Act: Execute the navigate east action
    const action = new NavigateNodeAction(context, 'e');
    action.execute();

    // Verify: Should select node2 (the closest node to the east)
    expect(diagram.selection.nodes).toHaveLength(1);
    expect(diagram.selection.nodes[0]!.id).toBe('node2');
  });

  test('should extend selection when extendSelection is true', () => {
    // Setup: Create two nodes and select the first one
    layer.addNode({ id: 'node1', bounds: { x: 0, y: 50, w: 50, h: 50, r: 0 } });
    layer.addNode({ id: 'node2', bounds: { x: 100, y: 50, w: 50, h: 50, r: 0 } });
    diagram.selection.setElements([layer.elements[0]!]);

    // Act: Execute the navigate east action with extend selection
    const action = new NavigateNodeAction(context, 'e', true);
    action.execute();

    // Verify: Should have both nodes selected
    expect(diagram.selection.nodes).toHaveLength(2);
    expect(diagram.selection.nodes.map(n => n.id)).toContain('node1');
    expect(diagram.selection.nodes.map(n => n.id)).toContain('node2');
  });

  test('should not find any node if none are in the right direction', () => {
    // Setup: Create nodes where the second node is to the west, not east
    layer.addNode({ id: 'node1', bounds: { x: 0, y: 50, w: 50, h: 50, r: 0 } });
    layer.addNode({
      id: 'node2',
      bounds: { x: -100, y: 50, w: 50, h: 50, r: 0 } // To the west
    });
    diagram.selection.setElements([layer.elements[0]!]);

    // Act: Execute the navigate east action (but there's no node to the east)
    const action = new NavigateNodeAction(context, 'e');
    action.execute();

    // Verify: Should still have only the original node selected
    expect(diagram.selection.nodes).toHaveLength(1);
    expect(diagram.selection.nodes[0]!.id).toBe('node1');
  });

  test('should navigate from the most recently selected node when multiple are selected', () => {
    // Setup: Create three nodes and select node1 first, then add node2 to selection
    layer.addNode({ id: 'node1', bounds: { x: 0, y: 50, w: 50, h: 50, r: 0 } });
    layer.addNode({ id: 'node2', bounds: { x: 100, y: 50, w: 50, h: 50, r: 0 } });
    layer.addNode({ id: 'node3', bounds: { x: 200, y: 50, w: 50, h: 50, r: 0 } });
    diagram.selection.setElements([layer.elements[0]!]);
    diagram.selection.toggle(layer.elements[1]!);

    // Verify setup: Should have both selected with node2 being the most recent
    expect(diagram.selection.nodes).toHaveLength(2);
    expect(diagram.selection.nodes.at(-1)!.id).toBe('node2');

    // Act: Navigate east - should navigate from node2 (most recent) to node3
    const action = new NavigateNodeAction(context, 'e');
    action.execute();

    // Verify: Should select only node3 (since extendSelection is false)
    expect(diagram.selection.nodes).toHaveLength(1);
    expect(diagram.selection.nodes[0]!.id).toBe('node3');
  });

  test('should skip label nodes when navigating', () => {
    // Setup: Create regular node, label node, and another regular node in a line
    layer.addNode({ id: 'node1', bounds: { x: 0, y: 50, w: 50, h: 50, r: 0 } });
    const labelNode = layer.addNode({ bounds: { x: 100, y: 50, w: 50, h: 50, r: 0 } });
    layer.addNode({ id: 'node3', bounds: { x: 200, y: 50, w: 50, h: 50, r: 0 } });

    // Mock the label node to return true for isLabelNode()
    const mockLabelNode = labelNode as any;
    mockLabelNode.isLabelNode = () => true;

    diagram.selection.setElements([layer.elements[0]!]);

    // Act: Navigate east - should skip the label node and go to node3
    const action = new NavigateNodeAction(context, 'e');
    action.execute();

    // Verify: Should select node3, skipping the label node
    expect(diagram.selection.nodes).toHaveLength(1);
    expect(diagram.selection.nodes[0]!.id).toBe('node3');
  });
});
