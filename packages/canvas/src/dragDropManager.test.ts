// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { resolveCanvasDragElementId } from './dragDropManager';

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
