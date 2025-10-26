import { Selection } from './selection';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TestDiagramBuilder, TestModel, TestLayerBuilder } from './test-support/testModel';
import { UnitOfWork } from './unitOfWork';

describe('selection', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    layer = diagram.newLayer();

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('isEmpty()', () => {
    const emptySelection = new Selection(TestModel.newDiagram());
    expect(emptySelection.isEmpty()).toBe(true);
    expect(emptySelection.bounds.w).toBe(0);
    expect(emptySelection.bounds.h).toBe(0);
  });

  test('toggle()', () => {
    const element = layer.addNode();
    const selection = new Selection(diagram);

    const changeCb = vi.fn();
    const addCb = vi.fn();
    const removeCb = vi.fn();

    selection.on('change', changeCb);
    selection.on('add', addCb);
    selection.on('remove', removeCb);

    selection.toggle(element);
    expect(selection.isEmpty()).toBe(false);

    vi.advanceTimersByTime(1);
    expect(addCb).toHaveBeenCalledTimes(1);
    expect(removeCb).toHaveBeenCalledTimes(0);

    changeCb.mockReset();
    addCb.mockReset();
    removeCb.mockReset();

    selection.toggle(element);
    expect(selection.isEmpty()).toBe(true);

    vi.advanceTimersByTime(1);
    expect(addCb).toHaveBeenCalledTimes(0);
    expect(removeCb).toHaveBeenCalledTimes(1);
  });

  describe('type', () => {
    test('returns correct type for different selections', () => {
      const selection = new Selection(diagram);
      expect(selection.type).toBe('empty');

      selection.toggle(layer.addNode());
      expect(selection.type).toBe('single-node');

      selection.toggle(layer.addNode());
      expect(selection.type).toBe('nodes');

      selection.clear();
      selection.toggle(layer.addEdge());
      expect(selection.type).toBe('single-edge');

      selection.toggle(layer.addEdge());
      expect(selection.type).toBe('edges');

      selection.toggle(layer.addNode());
      expect(selection.type).toBe('mixed');
    });
  });

  test('isNodesOnly() and isEdgesOnly()', () => {
    const selection = new Selection(diagram);
    selection.toggle(layer.addNode());
    expect(selection.isNodesOnly()).toBe(true);
    expect(selection.isEdgesOnly()).toBe(false);

    selection.clear();
    selection.toggle(layer.addEdge());
    expect(selection.isNodesOnly()).toBe(false);
    expect(selection.isEdgesOnly()).toBe(true);

    selection.toggle(layer.addNode());
    expect(selection.isNodesOnly()).toBe(false);
    expect(selection.isEdgesOnly()).toBe(false);
  });

  test('nodes and edges getters', () => {
    const selection = new Selection(diagram);
    const node1 = layer.addNode();
    const node2 = layer.addNode();
    const edge1 = layer.addEdge();
    const edge2 = layer.addEdge();

    selection.setElements([node1, edge1, node2, edge2]);

    expect(selection.nodes).toHaveLength(2);
    expect(selection.nodes).toContain(node1);
    expect(selection.nodes).toContain(node2);

    expect(selection.edges).toHaveLength(2);
    expect(selection.edges).toContain(edge1);
    expect(selection.edges).toContain(edge2);
  });

  test('filter()', () => {
    const selection = new Selection(diagram);
    const node1 = layer.addNode({ id: 'node-1' });
    const node2 = layer.addNode({ id: 'node-2' });
    const edge = layer.addEdge({ id: 'edge-1' });

    selection.setElements([node1, node2, edge]);

    expect(selection.filter('all', e => e.id.startsWith('node'))).toHaveLength(2);
    expect(selection.filter('nodes', e => e.id === 'node-1')).toHaveLength(1);
    expect(selection.filter('edges')).toHaveLength(1);
  });

  test('setDragging() and isDragging()', () => {
    const selection = new Selection(diagram);
    expect(selection.isDragging()).toBe(false);

    selection.setDragging(true);
    expect(selection.isDragging()).toBe(true);

    selection.setDragging(false);
    expect(selection.isDragging()).toBe(false);
  });

  test('source', () => {
    const selection = new Selection(diagram);
    const node = layer.addNode({ bounds: { x: 10, y: 20, w: 50, h: 60, r: 0 } });

    selection.setElements([node]);

    expect(selection.source.elementIds).toEqual([node.id]);
    expect(selection.source.elementBoxes[0]).toEqual(node.bounds);
  });

  test('isChanged()', () => {
    const selection = new Selection(diagram);
    const node = layer.addNode({ bounds: { x: 0, y: 0, w: 10, h: 10, r: 0 } });

    selection.setElements([node]);
    expect(selection.isChanged()).toBe(false);

    node.setBounds({ x: 20, y: 30, w: 10, h: 10, r: 0 }, UnitOfWork.immediate(diagram));
    expect(selection.isChanged()).toBe(true);
  });

  test('clear()', () => {
    const selection = new Selection(diagram);
    const node = layer.addNode();

    selection.setElements([node]);

    selection.clear();

    expect(selection.isEmpty()).toBe(true);
  });

  test('getParents()', () => {
    const selection = new Selection(diagram);
    const parent = layer.addNode();
    const child = layer.addNode();
    const grandchild = layer.addNode();

    parent.addChild(child, UnitOfWork.immediate(diagram));
    child.addChild(grandchild, UnitOfWork.immediate(diagram));

    selection.setElements([grandchild]);

    const parents = selection.getParents();
    expect(parents.size).toBe(2);
    expect(parents.has(parent)).toBe(true);
    expect(parents.has(child)).toBe(true);
  });

  test('rebaseline()', () => {
    const selection = new Selection(diagram);
    const node = layer.addNode({ bounds: { x: 0, y: 0, w: 10, h: 10, r: 0 } });

    selection.setElements([node]);
    node.setBounds({ x: 20, y: 30, w: 10, h: 10, r: 0 }, UnitOfWork.immediate(diagram));

    expect(selection.isChanged()).toBe(true);

    selection.rebaseline();
    expect(selection.isChanged()).toBe(false);
  });

  test('forceRotation()', () => {
    const selection = new Selection(diagram);
    const node = layer.addNode({ bounds: { x: 0, y: 0, w: 10, h: 10, r: 0 } });

    selection.setElements([node]);
    selection.forceRotation(45);

    expect(selection.bounds.r).toBe(45);

    const boundsBeforeRecalc = selection.bounds;
    node.setBounds({ x: 20, y: 30, w: 50, h: 60, r: 0 }, UnitOfWork.immediate(diagram));
    selection.recalculateBoundingBox();

    expect(selection.bounds).toEqual(boundsBeforeRecalc);

    selection.forceRotation(undefined);
    selection.recalculateBoundingBox();
    expect(selection.bounds.r).toBe(0);
  });

  test('toJSON()', () => {
    const selection = new Selection(diagram);
    const node = layer.addNode();
    const edge = layer.addEdge();

    selection.setElements([node, edge]);

    const json = selection.toJSON();
    expect(json.bounds).toBeDefined();
    expect(json.elements).toHaveLength(2);
    expect(json.type).toBe('mixed');
  });

  test('filterSelectionToVisibleElements()', () => {
    const selection = new Selection(diagram);
    const layer2 = diagram.newLayer();

    const node1 = layer.addNode();
    const node2 = layer2.addNode();

    selection.setElements([node1, node2]);
    diagram.layers.toggleVisibility(layer2);
    selection.filterSelectionToVisibleElements();

    expect(selection.elements).toHaveLength(1);
    expect(selection.elements).toContain(node1);
  });

  test('locked elements', () => {
    const selection = new Selection(diagram);
    const lockedLayer = diagram.newLayer();
    lockedLayer.locked = true;

    const node = lockedLayer.addNode();

    selection.setElements([node]);
    expect(selection.isEmpty()).toBe(true);

    selection.toggle(node);
    expect(selection.isEmpty()).toBe(true);
  });

  test('setElements with rebaseline option', () => {
    const selection = new Selection(diagram);
    const node = layer.addNode({ bounds: { x: 10, y: 20, w: 30, h: 40, r: 0 } });

    selection.setElements([node], false);
    expect(selection.source.elementIds).toHaveLength(0);

    selection.setElements([node], true);
    expect(selection.source.elementIds).toEqual([node.id]);
  });
});
