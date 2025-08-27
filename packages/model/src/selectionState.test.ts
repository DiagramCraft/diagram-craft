import { Highlight, SelectionState } from './selectionState';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TestDiagramBuilder, TestModel, TestLayerBuilder } from './test-support/builder';

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
    const emptySelection = new SelectionState(TestModel.newDiagram());
    expect(emptySelection.isEmpty()).toBe(true);
    expect(emptySelection.bounds.w).toBe(0);
    expect(emptySelection.bounds.h).toBe(0);
  });

  test('toggle()', () => {
    const element = layer.addNode();

    const selectionState = new SelectionState(diagram);

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

  describe('getSelectionType()', () => {
    test('empty selection', () => {
      const selectionState = new SelectionState(diagram);
      expect(selectionState.getSelectionType()).toBe('empty');
    });

    test('single node', () => {
      const selectionState = new SelectionState(diagram);
      selectionState.toggle(layer.addNode());
      expect(selectionState.getSelectionType()).toBe('single-node');
    });

    test('single edge', () => {
      const selectionState = new SelectionState(diagram);
      selectionState.toggle(layer.addEdge());
      expect(selectionState.getSelectionType()).toBe('single-edge');
    });

    test('multiple nodes', () => {
      const selectionState = new SelectionState(diagram);
      selectionState.toggle(layer.addNode());
      selectionState.toggle(layer.addNode());
      expect(selectionState.getSelectionType()).toBe('nodes');
    });

    test('multiple edges', () => {
      const selectionState = new SelectionState(diagram);
      selectionState.toggle(layer.addEdge());
      selectionState.toggle(layer.addEdge());
      expect(selectionState.getSelectionType()).toBe('edges');
    });

    test('mixed', () => {
      const selectionState = new SelectionState(diagram);
      selectionState.toggle(layer.addNode());
      selectionState.toggle(layer.addEdge());
      expect(selectionState.getSelectionType()).toBe('mixed');
    });
  });

  test('isNodesOnly()', () => {
    const selectionState = new SelectionState(diagram);
    selectionState.toggle(layer.addNode());
    expect(selectionState.isNodesOnly()).toBe(true);
    selectionState.toggle(layer.addEdge());
    expect(selectionState.isNodesOnly()).toBe(false);
  });

  test('isEdgesOnly()', () => {
    const selectionState = new SelectionState(diagram);
    selectionState.toggle(layer.addEdge());
    expect(selectionState.isEdgesOnly()).toBe(true);
    selectionState.toggle(layer.addNode());
    expect(selectionState.isEdgesOnly()).toBe(false);
  });

  test('set guides', () => {
    const selectionState = new SelectionState(diagram);

    const changeCb = vi.fn();
    selectionState.on('change', changeCb);

    const guides: Highlight[] = [{} as unknown as Highlight];
    selectionState.highlights = guides;
    expect(selectionState.highlights).toBe(guides);

    vi.advanceTimersByTime(1);
    expect(changeCb).toHaveBeenCalledTimes(1);
  });
});
