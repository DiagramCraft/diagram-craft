import { _test, type DiagramBounds } from './diagramBounds';
import { describe, expect, it } from 'vitest';
import { Box } from '@diagram-craft/geometry/box';
import { TestModel } from './test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

describe('ResizeCanvasUndoableAction', () => {
  it('correctly undoes the canvas resize', () => {
    const diagram = TestModel.newDiagram();
    const beforeCanvas = { x: 0, y: 0, w: 100, h: 100 };
    const afterCanvas = { x: 0, y: 0, w: 200, h: 200 };
    UnitOfWork.executeSilently(diagram, uow => diagram.setBounds(beforeCanvas, uow));

    // Act
    UnitOfWork.executeWithUndo(diagram, 'Resize', uow => diagram.setBounds(afterCanvas, uow));
    diagram.undoManager.undo();

    // Verify
    expect(diagram.bounds).toEqual(beforeCanvas);
  });

  it('correctly redoes the canvas resize', () => {
    const diagram = TestModel.newDiagram();
    const beforeCanvas = { x: 0, y: 0, w: 100, h: 100 };
    const afterCanvas = { x: 0, y: 0, w: 200, h: 200 };
    UnitOfWork.executeSilently(diagram, uow => diagram.setBounds(beforeCanvas, uow));

    // Act
    UnitOfWork.executeWithUndo(diagram, 'Resize', uow => diagram.setBounds(afterCanvas, uow));
    diagram.undoManager.undo();
    diagram.undoManager.redo();

    // Verify
    expect(diagram.bounds).toEqual(afterCanvas);
  });
});

describe('resizeCanvas', () => {
  it('expands canvas when bbox is outside the current canvas on the left', () => {
    const orig: DiagramBounds = { x: 100, y: 100, w: 200, h: 200 };
    const bbox: Box = { x: 50, y: 150, w: 100, h: 100, r: 0 };

    const result = _test.resizeDiagramBounds(orig, bbox);
    expect(result).toEqual({ x: -50, y: 100, w: 350, h: 200 });
  });

  it('expands canvas when bbox is outside the current canvas on the top', () => {
    const orig: DiagramBounds = { x: 100, y: 100, w: 200, h: 200 };
    const bbox: Box = { x: 150, y: 50, w: 100, h: 100, r: 0 };

    const result = _test.resizeDiagramBounds(orig, bbox);
    expect(result).toEqual({ x: 100, y: -50, w: 200, h: 350 });
  });

  it('expands canvas when bbox is outside the current canvas on the right', () => {
    const orig: DiagramBounds = { x: 100, y: 100, w: 200, h: 200 };
    const bbox: Box = { x: 250, y: 150, w: 100, h: 100, r: 0 };

    const result = _test.resizeDiagramBounds(orig, bbox);
    expect(result).toEqual({ x: 100, y: 100, w: 350, h: 200 });
  });

  it('expands canvas when bbox is outside the current canvas on the bottom', () => {
    const orig: DiagramBounds = { x: 100, y: 100, w: 200, h: 200 };
    const bbox: Box = { x: 150, y: 250, w: 100, h: 100, r: 0 };

    const result = _test.resizeDiagramBounds(orig, bbox);
    expect(result).toEqual({ x: 100, y: 100, w: 200, h: 350 });
  });

  it('does not change canvas when bbox is within the current canvas', () => {
    const orig: DiagramBounds = { x: 100, y: 100, w: 200, h: 200 };
    const bbox: Box = { x: 150, y: 150, w: 100, h: 100, r: 0 };

    const result = _test.resizeDiagramBounds(orig, bbox);
    expect(result).toEqual(orig);
  });

  it('expands canvas correctly when bbox is outside on multiple sides', () => {
    const orig: DiagramBounds = { x: 100, y: 100, w: 200, h: 200 };
    const bbox: Box = { x: 50, y: 50, w: 300, h: 300, r: 0 };

    const result = _test.resizeDiagramBounds(orig, bbox);
    expect(result).toEqual({ x: -50, y: -50, w: 500, h: 500 });
  });
});
