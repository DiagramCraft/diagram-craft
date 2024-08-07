import { Guide, SelectionState } from './selectionState';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DiagramNode } from './diagramNode';
import { TestFactory } from './helpers/testFactory';

describe('SelectionState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('isEmpty()', () => {
    const emptySelection = new SelectionState(TestFactory.createDiagram());
    expect(emptySelection.isEmpty()).toBe(true);
    expect(emptySelection.bounds.w).toBe(0);
    expect(emptySelection.bounds.h).toBe(0);
  });

  test('toggle()', () => {
    const diagram = TestFactory.createDiagram();
    const element: DiagramNode = TestFactory.createNode(diagram);

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
      const selectionState = new SelectionState(TestFactory.createDiagram());
      expect(selectionState.getSelectionType()).toBe('empty');
    });

    test('single node', () => {
      const d = TestFactory.createDiagram();
      const selectionState = new SelectionState(d);
      selectionState.toggle(TestFactory.createNode(d));
      expect(selectionState.getSelectionType()).toBe('single-node');
    });

    test('single edge', () => {
      const d = TestFactory.createDiagram();
      const selectionState = new SelectionState(d);
      selectionState.toggle(TestFactory.createEdge(d));
      expect(selectionState.getSelectionType()).toBe('single-edge');
    });

    test('multiple nodes', () => {
      const d = TestFactory.createDiagram();
      const selectionState = new SelectionState(d);
      selectionState.toggle(TestFactory.createNode(d));
      selectionState.toggle(TestFactory.createNode(d));
      expect(selectionState.getSelectionType()).toBe('nodes');
    });

    test('multiple edges', () => {
      const d = TestFactory.createDiagram();
      const selectionState = new SelectionState(d);
      selectionState.toggle(TestFactory.createEdge(d));
      selectionState.toggle(TestFactory.createEdge(d));
      expect(selectionState.getSelectionType()).toBe('edges');
    });

    test('mixed', () => {
      const d = TestFactory.createDiagram();
      const selectionState = new SelectionState(d);
      selectionState.toggle(TestFactory.createNode(d));
      selectionState.toggle(TestFactory.createEdge(d));
      expect(selectionState.getSelectionType()).toBe('mixed');
    });
  });

  test('isNodesOnly()', () => {
    const d = TestFactory.createDiagram();
    const selectionState = new SelectionState(d);
    selectionState.toggle(TestFactory.createNode(d));
    expect(selectionState.isNodesOnly()).toBe(true);
    selectionState.toggle(TestFactory.createEdge(d));
    expect(selectionState.isNodesOnly()).toBe(false);
  });

  test('isEdgesOnly()', () => {
    const d = TestFactory.createDiagram();
    const selectionState = new SelectionState(d);
    selectionState.toggle(TestFactory.createEdge(d));
    expect(selectionState.isEdgesOnly()).toBe(true);
    selectionState.toggle(TestFactory.createNode(d));
    expect(selectionState.isEdgesOnly()).toBe(false);
  });

  test('set guides', () => {
    const selectionState = new SelectionState(TestFactory.createDiagram());

    const changeCb = vi.fn();
    selectionState.on('change', changeCb);

    const guides: Guide[] = [{} as unknown as Guide];
    selectionState.guides = guides;
    expect(selectionState.guides).toBe(guides);

    vi.advanceTimersByTime(1);
    expect(changeCb).toHaveBeenCalledTimes(1);
  });
});
