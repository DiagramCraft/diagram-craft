import { Selection, type Highlight } from './selection';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TestDiagramBuilder, TestModel, TestLayerBuilder } from './test-support/testModel';

describe('SelectionState', () => {
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

    const selectionState = new Selection(diagram);

    const changeCb = vi.fn();
    const addCb = vi.fn();
    const removeCb = vi.fn();

    selectionState.on('change', changeCb);
    selectionState.on('add', addCb);
    selectionState.on('remove', removeCb);

    selectionState.toggle(element);
    expect(selectionState.isEmpty()).toBe(false);
    expect(selectionState.bounds.w).toBe(10);
    expect(selectionState.bounds.h).toBe(10);

    vi.advanceTimersByTime(1);
    expect(addCb).toHaveBeenCalledTimes(1);
    expect(removeCb).toHaveBeenCalledTimes(0);
    expect(changeCb).toHaveBeenCalledTimes(1);

    changeCb.mockReset();
    addCb.mockReset();
    removeCb.mockReset();

    selectionState.toggle(element);
    expect(selectionState.isEmpty()).toBe(true);
    expect(selectionState.bounds.w).toBe(0);
    expect(selectionState.bounds.h).toBe(0);

    vi.advanceTimersByTime(1);
    expect(addCb).toHaveBeenCalledTimes(0);
    expect(removeCb).toHaveBeenCalledTimes(1);
    expect(changeCb).toHaveBeenCalledTimes(1);
  });

  describe('type', () => {
    test('empty selection', () => {
      const selectionState = new Selection(diagram);
      expect(selectionState.type).toBe('empty');
    });

    test('single node', () => {
      const selectionState = new Selection(diagram);
      selectionState.toggle(layer.addNode());
      expect(selectionState.type).toBe('single-node');
    });

    test('single edge', () => {
      const selectionState = new Selection(diagram);
      selectionState.toggle(layer.addEdge());
      expect(selectionState.type).toBe('single-edge');
    });

    test('multiple nodes', () => {
      const selectionState = new Selection(diagram);
      selectionState.toggle(layer.addNode());
      selectionState.toggle(layer.addNode());
      expect(selectionState.type).toBe('nodes');
    });

    test('multiple edges', () => {
      const selectionState = new Selection(diagram);
      selectionState.toggle(layer.addEdge());
      selectionState.toggle(layer.addEdge());
      expect(selectionState.type).toBe('edges');
    });

    test('mixed', () => {
      const selectionState = new Selection(diagram);
      selectionState.toggle(layer.addNode());
      selectionState.toggle(layer.addEdge());
      expect(selectionState.type).toBe('mixed');
    });
  });

  test('isNodesOnly()', () => {
    const selectionState = new Selection(diagram);
    selectionState.toggle(layer.addNode());
    expect(selectionState.isNodesOnly()).toBe(true);
    selectionState.toggle(layer.addEdge());
    expect(selectionState.isNodesOnly()).toBe(false);
  });

  test('isEdgesOnly()', () => {
    const selectionState = new Selection(diagram);
    selectionState.toggle(layer.addEdge());
    expect(selectionState.isEdgesOnly()).toBe(true);
    selectionState.toggle(layer.addNode());
    expect(selectionState.isEdgesOnly()).toBe(false);
  });

  test('set guides', () => {
    const selectionState = new Selection(diagram);

    const changeCb = vi.fn();
    selectionState.on('change', changeCb);

    const guides: Highlight[] = [{} as unknown as Highlight];
    selectionState.highlights = guides;
    expect(selectionState.highlights).toBe(guides);

    vi.advanceTimersByTime(1);
    expect(changeCb).toHaveBeenCalledTimes(1);
  });
});
