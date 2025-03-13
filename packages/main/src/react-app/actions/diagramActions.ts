import { AbstractAction } from '@diagram-craft/canvas/action';
import { Application } from '../../application';
import { newid } from '@diagram-craft/utils/id';
import { DocumentBuilder } from '@diagram-craft/model/diagram';
import { assert, precondition } from '@diagram-craft/utils/assert';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { StringInputDialogCommand } from '@diagram-craft/canvas-app/dialogs';
import { makeUndoableAction } from '@diagram-craft/model/undoManager';

export const diagramActions = (application: Application) => ({
  DIAGRAM_ADD: new DiagramAddAction(application),
  DIAGRAM_REMOVE: new DiagramRemoveAction(application),
  DIAGRAM_RENAME: new DiagramRenameAction(application)
});

declare global {
  interface ActionMap extends ReturnType<typeof diagramActions> {}
}

class DiagramAddAction extends AbstractAction<{ parentId?: string }, Application> {
  constructor(application: Application) {
    super(application);
  }

  execute(props: { parentId?: string }): void {
    const document = this.context.model.activeDocument;
    const diagram = this.context.model.activeDiagram;
    const undoManager = diagram.undoManager;

    const id = newid();
    const parent = props.parentId ? document.getById(props.parentId) : undefined;

    undoManager.addAndExecute(
      makeUndoableAction('Add diagram', {
        redo: () => {
          const peerDiagrams = parent ? parent.diagrams : document.topLevelDiagrams;

          const { diagram: newDiagram } = DocumentBuilder.empty(
            id,
            `Sheet ${peerDiagrams.length + 1}`,
            document
          );

          newDiagram.viewBox.pan({
            x: (this.context.userState.panelLeft ?? -1) >= 0 ? -280 : -30,
            y: -30
          });

          document.addDiagram(newDiagram, parent);

          this.context.model.activeDiagram = newDiagram;
        },
        undo: () => {
          const d = document.getById(id);
          assert.present(d);
          document.removeDiagram(d);
        }
      })
    );
  }
}

class DiagramRemoveAction extends AbstractAction<{ diagramId?: string }, Application> {
  constructor(application: Application) {
    super(application);
  }

  execute(props: { diagramId?: string }): void {
    assert.present(props.diagramId);

    const document = this.context.model.activeDocument;
    const diagram = document.getById(props.diagramId);
    assert.present(diagram);

    // TODO: This can be improved to choose the "closest" diagram
    const diagramToFallbackTo =
      this.context.model.activeDiagram === diagram
        ? document.topLevelDiagrams[0]
        : this.context.model.activeDiagram;

    const undoManager = diagramToFallbackTo.undoManager;

    const parent = document.getDiagramPath(diagram).at(-2);

    this.context.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Delete diagram',
          message: `Are you sure you want to delete ${diagram.name}?`,
          okLabel: 'Yes',
          cancelLabel: 'No'
        },
        () => {
          // TODO: Retain index
          undoManager.addAndExecute(
            makeUndoableAction('Delete diagram', {
              redo: () => {
                this.context.model.activeDiagram = diagramToFallbackTo;
                document.removeDiagram(diagram);
              },
              undo: () => document.addDiagram(diagram, parent)
            })
          );
        }
      )
    );
  }
}

class DiagramRenameAction extends AbstractAction<{ diagramId?: string }, Application> {
  constructor(context: Application) {
    super(context);
  }

  execute({ diagramId }: { diagramId?: string }): void {
    precondition.is.present(diagramId);

    const document = this.context.model.activeDocument;
    const diagram = document.getById(diagramId);
    assert.present(diagram);

    const undoManager = this.context.model.activeDiagram.undoManager;

    this.context.ui.showDialog(
      new StringInputDialogCommand(
        {
          title: 'Rename diagram',
          description: 'Enter a new name for the diagram.',
          saveButtonLabel: 'Rename',
          value: diagram.name
        },
        async name => {
          const oldName = diagram.name;

          undoManager.addAndExecute(
            makeUndoableAction('Rename diagram', {
              redo: () => {
                diagram.name = name;
                document.changeDiagram(diagram);
              },
              undo: () => {
                diagram.name = oldName;
                document.changeDiagram(diagram);
              }
            })
          );
        }
      )
    );
  }
}
