import { _test, createResizeCanvasActionToFit } from './canvasResizeHelper';
import { describe, expect, it } from 'vitest';
import { Canvas } from '../diagram';
import { Box } from '@diagram-craft/geometry/box';
import { TestDocumentBuilder } from '../test-support/builder';

describe('ResizeCanvasUndoableAction', () => {
  it('correctly undoes the canvas resize', () => {
    const diagram = TestDocumentBuilder.newDiagram();
    const beforeCanvas = { x: 0, y: 0, w: 100, h: 100 };
    const afterCanvas = { x: 0, y: 0, w: 200, h: 200 };
    diagram.canvas = afterCanvas;

    const action = new _test.ResizeCanvasUndoableAction(diagram, beforeCanvas, afterCanvas);
    action.undo();

    expect(diagram.canvas).toEqual(beforeCanvas);
  });

  it('correctly redoes the canvas resize', () => {
    const diagram = TestDocumentBuilder.newDiagram();
    const beforeCanvas = { x: 0, y: 0, w: 100, h: 100 };
    const afterCanvas = { x: 0, y: 0, w: 200, h: 200 };
    diagram.canvas = beforeCanvas;

    const action = new _test.ResizeCanvasUndoableAction(diagram, beforeCanvas, afterCanvas);
    action.redo();

    expect(diagram.canvas).toEqual(afterCanvas);
  });
});

describe('resizeCanvas', () => {
  it('expands canvas when bbox is outside the current canvas on the left', () => {
    const orig: Canvas = { x: 100, y: 100, w: 200, h: 200 };
    const bbox: Box = { x: 50, y: 150, w: 100, h: 100, r: 0 };

    const result = _test.resizeCanvas(orig, bbox);
    expect(result).toEqual({ x: -50, y: 100, w: 350, h: 200 });
  });

  it('expands canvas when bbox is outside the current canvas on the top', () => {
    const orig: Canvas = { x: 100, y: 100, w: 200, h: 200 };
    const bbox: Box = { x: 150, y: 50, w: 100, h: 100, r: 0 };

    const result = _test.resizeCanvas(orig, bbox);
    expect(result).toEqual({ x: 100, y: -50, w: 200, h: 350 });
  });

  it('expands canvas when bbox is outside the current canvas on the right', () => {
    const orig: Canvas = { x: 100, y: 100, w: 200, h: 200 };
    const bbox: Box = { x: 250, y: 150, w: 100, h: 100, r: 0 };

    const result = _test.resizeCanvas(orig, bbox);
    expect(result).toEqual({ x: 100, y: 100, w: 350, h: 200 });
  });

  it('expands canvas when bbox is outside the current canvas on the bottom', () => {
    const orig: Canvas = { x: 100, y: 100, w: 200, h: 200 };
    const bbox: Box = { x: 150, y: 250, w: 100, h: 100, r: 0 };

    const result = _test.resizeCanvas(orig, bbox);
    expect(result).toEqual({ x: 100, y: 100, w: 200, h: 350 });
  });

  it('does not change canvas when bbox is within the current canvas', () => {
    const orig: Canvas = { x: 100, y: 100, w: 200, h: 200 };
    const bbox: Box = { x: 150, y: 150, w: 100, h: 100, r: 0 };

    const result = _test.resizeCanvas(orig, bbox);
    expect(result).toEqual(orig);
  });

  it('expands canvas correctly when bbox is outside on multiple sides', () => {
    const orig: Canvas = { x: 100, y: 100, w: 200, h: 200 };
    const bbox: Box = { x: 50, y: 50, w: 300, h: 300, r: 0 };

    const result = _test.resizeCanvas(orig, bbox);
    expect(result).toEqual({ x: -50, y: -50, w: 500, h: 500 });
  });
});

describe('createResizeCanvasActionToFit', () => {
  it('returns undefined if the canvas does not need resizing', () => {
    const diagram = TestDocumentBuilder.newDiagram();
    diagram.canvas = { x: 100, y: 100, w: 200, h: 200 };

    const bbox: Box = { x: 150, y: 150, w: 100, h: 100, r: 0 };
    const result = createResizeCanvasActionToFit(diagram, bbox);

    expect(result).toBeUndefined();
  });

  it('returns a ResizeCanvasUndoableAction if the canvas needs resizing', () => {
    const diagram = TestDocumentBuilder.newDiagram();
    diagram.canvas = { x: 100, y: 100, w: 200, h: 200 };

    const bbox: Box = { x: 50, y: 50, w: 300, h: 300, r: 0 };
    const result = createResizeCanvasActionToFit(diagram, bbox);

    expect(result).toBeInstanceOf(_test.ResizeCanvasUndoableAction);
  });
});
