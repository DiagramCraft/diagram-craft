import { beforeEach, describe, expect, test } from 'vitest';
import { DiagramRemoveAction } from './diagramActions';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import type { Application } from '../../application';
import type { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { DocumentBuilder } from '@diagram-craft/model/diagram';
import type { MessageDialogCommand } from '@diagram-craft/canvas/context';
import type { EmptyObject } from '@diagram-craft/utils/types';

type TestApplication = Application & {
  executeDialogCallback: () => void;
};

const mockApplication = (document: DiagramDocument): TestApplication => {
  let dialogCallback: ((data: EmptyObject) => void) | undefined;

  return {
    model: {
      activeDocument: document,
      activeDiagram: document.diagrams[0]!,
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      on: (_event: any, _handler: any, _options?: any) => {}
    },
    ui: {
      showDialog: (command: MessageDialogCommand) => {
        dialogCallback = command.onOk;
      }
    },
    executeDialogCallback: () => {
      if (dialogCallback) {
        dialogCallback({});
      }
    }
    // biome-ignore lint/suspicious/noExplicitAny: test mock
  } as any;
};

describe('DiagramRemoveAction', () => {
  let document: DiagramDocument;

  beforeEach(() => {
    document = TestModel.newDocument();
  });

  test('should retain diagram index when undoing removal', () => {
    // Create 4 diagrams: A, B, C, D
    const diagramA = DocumentBuilder.empty('a', 'Diagram A', document).diagram;
    const diagramB = DocumentBuilder.empty('b', 'Diagram B', document).diagram;
    const diagramC = DocumentBuilder.empty('c', 'Diagram C', document).diagram;
    const diagramD = DocumentBuilder.empty('d', 'Diagram D', document).diagram;

    document.addDiagram(diagramA);
    document.addDiagram(diagramB);
    document.addDiagram(diagramC);
    document.addDiagram(diagramD);

    // Verify initial order
    expect(document.diagrams.map(d => d.id)).toEqual(['a', 'b', 'c', 'd']);

    const app = mockApplication(document);
    const action = new DiagramRemoveAction(app);

    // Remove diagram B (index 1)
    action.execute({ diagramId: 'b' });
    app.executeDialogCallback();

    // After removal, order should be A, C, D
    expect(document.diagrams.map(d => d.id)).toEqual(['a', 'c', 'd']);

    // Undo the removal
    diagramA.undoManager.undo();

    // After undo, B should be back at index 1 (between A and C)
    expect(document.diagrams.map(d => d.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  test('should retain diagram index when undoing removal of last diagram', () => {
    const diagramA = DocumentBuilder.empty('a', 'Diagram A', document).diagram;
    const diagramB = DocumentBuilder.empty('b', 'Diagram B', document).diagram;
    const diagramC = DocumentBuilder.empty('c', 'Diagram C', document).diagram;

    document.addDiagram(diagramA);
    document.addDiagram(diagramB);
    document.addDiagram(diagramC);

    expect(document.diagrams.map(d => d.id)).toEqual(['a', 'b', 'c']);

    const app = mockApplication(document);
    const action = new DiagramRemoveAction(app);

    // Remove diagram C (index 2 - last diagram)
    action.execute({ diagramId: 'c' });
    app.executeDialogCallback();

    expect(document.diagrams.map(d => d.id)).toEqual(['a', 'b']);

    // Undo the removal
    diagramA.undoManager.undo();

    // C should be back at the end (index 2)
    expect(document.diagrams.map(d => d.id)).toEqual(['a', 'b', 'c']);
  });

  test('should retain diagram index when undoing removal of first diagram', () => {
    const diagramA = DocumentBuilder.empty('a', 'Diagram A', document).diagram;
    const diagramB = DocumentBuilder.empty('b', 'Diagram B', document).diagram;
    const diagramC = DocumentBuilder.empty('c', 'Diagram C', document).diagram;

    document.addDiagram(diagramA);
    document.addDiagram(diagramB);
    document.addDiagram(diagramC);

    expect(document.diagrams.map(d => d.id)).toEqual(['a', 'b', 'c']);

    const app = mockApplication(document);
    app.model.activeDiagram = diagramB; // Set active to B so A can be removed
    const action = new DiagramRemoveAction(app);

    // Remove diagram A (index 0 - first diagram)
    action.execute({ diagramId: 'a' });
    app.executeDialogCallback();

    expect(document.diagrams.map(d => d.id)).toEqual(['b', 'c']);

    // Undo the removal
    diagramB.undoManager.undo();

    // A should be back at the beginning (index 0)
    expect(document.diagrams.map(d => d.id)).toEqual(['a', 'b', 'c']);
  });

  test('should handle redo after undo', () => {
    const diagramA = DocumentBuilder.empty('a', 'Diagram A', document).diagram;
    const diagramB = DocumentBuilder.empty('b', 'Diagram B', document).diagram;
    const diagramC = DocumentBuilder.empty('c', 'Diagram C', document).diagram;

    document.addDiagram(diagramA);
    document.addDiagram(diagramB);
    document.addDiagram(diagramC);

    const app = mockApplication(document);
    const action = new DiagramRemoveAction(app);

    // Remove diagram B
    action.execute({ diagramId: 'b' });
    app.executeDialogCallback();

    expect(document.diagrams.map(d => d.id)).toEqual(['a', 'c']);

    // Undo
    diagramA.undoManager.undo();
    expect(document.diagrams.map(d => d.id)).toEqual(['a', 'b', 'c']);

    // Redo
    diagramA.undoManager.redo();
    expect(document.diagrams.map(d => d.id)).toEqual(['a', 'c']);

    // Undo again
    diagramA.undoManager.undo();
    expect(document.diagrams.map(d => d.id)).toEqual(['a', 'b', 'c']);
  });
});
