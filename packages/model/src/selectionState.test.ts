import { Guide, SelectionState } from './selectionState.ts';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DiagramNode } from './diagramNode.ts';
import { DiagramEdge } from './diagramEdge.ts';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from './elementDefinitionRegistry.ts';
import { Diagram } from './index.ts';
import { Layer } from './index.ts';
import { FreeEndpoint } from './index.ts';
import { UnitOfWork } from './index.ts';
import { TestNodeDefinition } from './TestNodeDefinition.ts';

const createNode = (diagram: Diagram) =>
  new DiagramNode(
    '1',
    'rect',
    {
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      r: 0
    },
    diagram,
    diagram.layers.active
  );

const createEdge = (diagram: Diagram) =>
  new DiagramEdge(
    '1',
    new FreeEndpoint({ x: 0, y: 0 }),
    new FreeEndpoint({ x: 10, y: 10 }),
    {},
    [],
    diagram,
    diagram.layers.active
  );

function createDiagram() {
  const registry = new NodeDefinitionRegistry();
  registry.register(new TestNodeDefinition('rect', 'Rectangle'));
  const d = new Diagram('1', 'test', registry, new EdgeDefinitionRegistry());
  d.layers.add(new Layer('default', 'Default', [], d), UnitOfWork.throwaway(d));
  return d;
}

describe('SelectionState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('isEmpty()', () => {
    const emptySelection = new SelectionState(createDiagram());
    expect(emptySelection.isEmpty()).toBe(true);
    expect(emptySelection.bounds.w).toBe(0);
    expect(emptySelection.bounds.h).toBe(0);
  });

  test('toggle()', () => {
    const diagram = createDiagram();
    const element: DiagramNode = createNode(diagram);

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
      const selectionState = new SelectionState(createDiagram());
      expect(selectionState.getSelectionType()).toBe('empty');
    });

    test('single node', () => {
      const d = createDiagram();
      const selectionState = new SelectionState(d);
      selectionState.toggle(createNode(d));
      expect(selectionState.getSelectionType()).toBe('single-node');
    });

    test('single edge', () => {
      const d = createDiagram();
      const selectionState = new SelectionState(d);
      selectionState.toggle(createEdge(d));
      expect(selectionState.getSelectionType()).toBe('single-edge');
    });

    test('multiple nodes', () => {
      const d = createDiagram();
      const selectionState = new SelectionState(d);
      selectionState.toggle(createNode(d));
      selectionState.toggle(createNode(d));
      expect(selectionState.getSelectionType()).toBe('nodes');
    });

    test('multiple edges', () => {
      const d = createDiagram();
      const selectionState = new SelectionState(d);
      selectionState.toggle(createEdge(d));
      selectionState.toggle(createEdge(d));
      expect(selectionState.getSelectionType()).toBe('edges');
    });

    test('mixed', () => {
      const d = createDiagram();
      const selectionState = new SelectionState(d);
      selectionState.toggle(createNode(d));
      selectionState.toggle(createEdge(d));
      expect(selectionState.getSelectionType()).toBe('mixed');
    });
  });

  test('isNodesOnly()', () => {
    const d = createDiagram();
    const selectionState = new SelectionState(d);
    selectionState.toggle(createNode(d));
    expect(selectionState.isNodesOnly()).toBe(true);
    selectionState.toggle(createEdge(d));
    expect(selectionState.isNodesOnly()).toBe(false);
  });

  test('isEdgesOnly()', () => {
    const d = createDiagram();
    const selectionState = new SelectionState(d);
    selectionState.toggle(createEdge(d));
    expect(selectionState.isEdgesOnly()).toBe(true);
    selectionState.toggle(createNode(d));
    expect(selectionState.isEdgesOnly()).toBe(false);
  });

  test('set guides', () => {
    const selectionState = new SelectionState(createDiagram());

    const changeCb = vi.fn();
    selectionState.on('change', changeCb);

    const guides: Guide[] = [{} as unknown as Guide];
    selectionState.guides = guides;
    expect(selectionState.guides).toBe(guides);

    vi.advanceTimersByTime(1);
    expect(changeCb).toHaveBeenCalledTimes(1);
  });
});
