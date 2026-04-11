import { AbstractAction } from '@diagram-craft/canvas/action';
import { Application } from '../../application';
import { newid } from '@diagram-craft/utils/id';
import { DocumentBuilder } from '@diagram-craft/model/diagram';
import { assert, precondition } from '@diagram-craft/utils/assert';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { StringInputDialogCommand } from '@diagram-craft/canvas-app/dialogs';
import { $tStr, $t } from '@diagram-craft/utils/localize';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

export const diagramActions = (application: Application) => ({
  DIAGRAM_ADD: new DiagramAddAction(application),
  DIAGRAM_REMOVE: new DiagramRemoveAction(application),
  DIAGRAM_RENAME: new DiagramRenameAction(application)
});

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof diagramActions> {}
  }
}

class DiagramAddAction extends AbstractAction<{ parentId?: string }, Application> {
  name = $tStr('action.DIAGRAM_ADD.name', 'Add Diagram');

  execute(props: { parentId?: string }): void {
    const document = this.context.model.activeDocument;
    const activeDiagram = this.context.model.activeDiagram;
    const parent = props.parentId ? document.byId(props.parentId) : undefined;
    const peerDiagrams = parent ? parent.diagrams : document.diagrams;

    const { diagram: newDiagram } = DocumentBuilder.empty(
      newid(),
      `Sheet ${peerDiagrams.length + 1}`,
      document
    );

    newDiagram.viewBox.pan({
      x: (this.context.userState.panelLeft ?? -1) >= 0 ? -280 : -30,
      y: -30
    });

    UnitOfWork.executeWithUndo(activeDiagram, 'Add diagram', uow => {
      document.addDiagram(newDiagram, parent, uow);
    });

    this.context.model.activeDiagram = newDiagram;
  }
}

export class DiagramRemoveAction extends AbstractAction<{ diagramId?: string }, Application> {
  name = $tStr('action.DIAGRAM_REMOVE.name', 'Remove Diagram');

  execute(props: { diagramId?: string }): void {
    assert.present(props.diagramId);

    const document = this.context.model.activeDocument;
    const diagram = document.byId(props.diagramId);
    assert.present(diagram);

    // TODO: This can be improved to choose the "closest" diagram
    const diagramToFallbackTo =
      this.context.model.activeDiagram === diagram
        ? document.diagrams[0]!
        : this.context.model.activeDiagram;

    this.context.ui.showDialog(
      new MessageDialogCommand(
        {
          title: $t('dialog.diagram.delete_title', 'Delete diagram'),
          message: $t(
            'dialog.diagram.delete_message',
            `Are you sure you want to delete ${diagram.name}?`
          ),
          okLabel: $t('common.yes', 'Yes'),
          cancelLabel: $t('common.no', 'No')
        },
        () => {
          this.context.model.activeDiagram = diagramToFallbackTo;
          UnitOfWork.executeWithUndo(diagramToFallbackTo, 'Delete diagram', uow => {
            document.removeDiagram(diagram, uow);
          });
        }
      )
    );
  }
}

class DiagramRenameAction extends AbstractAction<{ diagramId?: string }, Application> {
  name = $tStr('action.DIAGRAM_RENAME.name', 'Rename Diagram');

  execute({ diagramId }: { diagramId?: string }): void {
    precondition.is.present(diagramId);

    const document = this.context.model.activeDocument;
    const diagram = document.byId(diagramId);
    assert.present(diagram);

    this.context.ui.showDialog(
      new StringInputDialogCommand(
        {
          title: $t('dialog.diagram.rename_title', 'Rename diagram'),
          description: $t('dialog.diagram.rename_description', 'Enter a new name for the diagram.'),
          saveButtonLabel: $t('common.rename', 'Rename'),
          value: diagram.name,
          selectOnOpen: true
        },
        async name => {
          UnitOfWork.executeWithUndo(diagram, 'Rename diagram', uow => {
            diagram.setName(name, uow);
          });
        }
      )
    );
  }
}
