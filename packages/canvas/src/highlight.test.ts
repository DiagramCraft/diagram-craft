import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  addHighlight,
  getHighlights,
  getHighlightValue,
  hasHighlight,
  Highlights,
  removeHighlight
} from './highlight';
import type { DiagramElement } from '@diagram-craft/model/diagramElement';
import { TestModel } from '@diagram-craft/model/test-support/testModel';

describe('highlight.ts', () => {
  let el: DiagramElement;

  beforeEach(() => {
    el = TestModel.newDiagram().newLayer().addEdge();
  });

  test('addHighlight without arg stores entry, hasHighlight true, and emits event', () => {
    // Setup
    const spy = vi.spyOn(el.diagram, 'emitAsync');

    // Act
    addHighlight(el, Highlights.NODE__TOOL_EDIT);

    // Verify
    expect(hasHighlight(el, Highlights.NODE__TOOL_EDIT)).toBe(true);
    expect(getHighlights(el)).toEqual([Highlights.NODE__TOOL_EDIT]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('elementHighlighted', { element: el });
  });

  test('addHighlight with arg stores value, hasHighlight works with and without arg, getHighlightValue returns arg', () => {
    // Setup
    const spy = vi.spyOn(el.diagram, 'emitAsync');

    // Act
    addHighlight(el, Highlights.NODE__ACTIVE_ANCHOR, 'A');

    // Verify
    expect(hasHighlight(el, Highlights.NODE__ACTIVE_ANCHOR)).toBe(true);
    expect(hasHighlight(el, Highlights.NODE__ACTIVE_ANCHOR, 'A')).toBe(true);
    expect(getHighlightValue(el, Highlights.NODE__ACTIVE_ANCHOR)).toBe('A');

    // Re-adding with another arg replaces the previous one (only one per prefix)

    // Act
    addHighlight(el, Highlights.NODE__ACTIVE_ANCHOR, 'B');

    // Verify
    expect(hasHighlight(el, Highlights.NODE__ACTIVE_ANCHOR, 'A')).toBe(false);
    expect(hasHighlight(el, Highlights.NODE__ACTIVE_ANCHOR, 'B')).toBe(true);
    expect(getHighlightValue(el, Highlights.NODE__ACTIVE_ANCHOR)).toBe('B');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('removeHighlight with arg removes that specific entry and emits event', () => {
    // Setup
    const spy = vi.spyOn(el.diagram, 'emitAsync');

    // Act
    addHighlight(el, Highlights.NODE__EDGE_CONNECT, 'left');

    // Verify
    expect(hasHighlight(el, Highlights.NODE__EDGE_CONNECT, 'left')).toBe(true);

    // Act
    removeHighlight(el, Highlights.NODE__EDGE_CONNECT, 'left');

    // Verify
    expect(hasHighlight(el, Highlights.NODE__EDGE_CONNECT)).toBe(false);

    // Two emits: one for add, one for remove
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith('elementHighlighted', { element: el });
  });

  test('removeHighlight without arg removes any entry with same prefix', () => {
    // Act
    addHighlight(el, Highlights.NODE__TOOL_CONVERT, 'x');

    // Verify
    expect(hasHighlight(el, Highlights.NODE__TOOL_CONVERT)).toBe(true);

    // Act
    removeHighlight(el, Highlights.NODE__TOOL_CONVERT);

    // Verify
    expect(hasHighlight(el, Highlights.NODE__TOOL_CONVERT)).toBe(false);
    expect(getHighlights(el)).toEqual([]);
  });

  test('API handles undefined elements gracefully', () => {
    // removeHighlight should not throw
    expect(() => removeHighlight(undefined, Highlights.NODE__DROP_TARGET)).not.toThrow();

    // hasHighlight should return false
    expect(hasHighlight(undefined, Highlights.NODE__DROP_TARGET)).toBe(false);

    // getHighlights should return []
    expect(getHighlights(undefined)).toEqual([]);

    // getHighlightValue should return [] according to current implementation
    expect(getHighlightValue(undefined, Highlights.NODE__DROP_TARGET)).toEqual([]);
  });

  test('highlights are isolated per element (WeakMap store)', () => {
    // Setup
    const el2 = TestModel.newDiagram().newLayer().addEdge();

    // Act
    addHighlight(el, Highlights.NODE__TOOL_EDIT);

    // Verify
    expect(hasHighlight(el, Highlights.NODE__TOOL_EDIT)).toBe(true);
    expect(hasHighlight(el2, Highlights.NODE__TOOL_EDIT)).toBe(false);

    // Act
    addHighlight(el2, Highlights.NODE__TOOL_EDIT);

    // Verify
    expect(hasHighlight(el2, Highlights.NODE__TOOL_EDIT)).toBe(true);

    // Act

    // Removing from el should not affect el2
    removeHighlight(el, Highlights.NODE__TOOL_EDIT);

    // Verify
    expect(hasHighlight(el, Highlights.NODE__TOOL_EDIT)).toBe(false);
    expect(hasHighlight(el2, Highlights.NODE__TOOL_EDIT)).toBe(true);
  });
});
