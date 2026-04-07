// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { Drag, DragEvents, DragDopManager, resolveCanvasDragElementId } from './dragDropManager';

class TestDrag extends Drag {
  constructor() {
    super();
  }

  onDrag(_event: DragEvents.DragStart): void {}

  onDragEnd(_event: DragEvents.DragEnd): void {}

  cancel(): void {}
}

describe('resolveCanvasDragElementId', () => {
  it('returns the diagram element id for descendants inside the editable canvas', () => {
    const canvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    canvas.classList.add('editable-canvas');

    const node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    node.id = 'node-parent-node';

    const child = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    node.appendChild(child);
    canvas.appendChild(node);
    document.body.appendChild(canvas);

    expect(resolveCanvasDragElementId(child)).toBe('parent-node');
  });

  it('strips internal redraw suffixes from canvas element ids', () => {
    const canvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    canvas.classList.add('editable-canvas');

    const node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    node.id = 'node-parent-node---redraw';
    canvas.appendChild(node);
    document.body.appendChild(canvas);

    expect(resolveCanvasDragElementId(node)).toBe('parent-node');
  });

  it('returns undefined for elements outside the editable canvas', () => {
    const node = document.createElement('div');
    node.id = 'node-parent-node';
    document.body.appendChild(node);

    expect(resolveCanvasDragElementId(node)).toBeUndefined();
  });

  it('returns undefined when hovering the canvas background', () => {
    const canvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    canvas.classList.add('editable-canvas');
    document.body.appendChild(canvas);

    expect(resolveCanvasDragElementId(canvas)).toBeUndefined();
  });
});

describe('DragDopManager', () => {
  it('runs the end callback when a drag is cleared without emitting dragEnd', () => {
    const manager = new DragDopManager();
    const drag = new TestDrag();
    const onEnd = vi.fn();

    manager.initiate(drag, onEnd);
    manager.clear();

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(manager.current()).toBeUndefined();
  });

  it('does not run the end callback twice when dragEnd is emitted before clear', () => {
    const manager = new DragDopManager();
    const drag = new TestDrag();
    const onEnd = vi.fn();

    manager.initiate(drag, onEnd);
    drag.emit('dragEnd');
    manager.clear();

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(manager.current()).toBeUndefined();
  });
});
