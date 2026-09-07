import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { RenameDialog } from '../../components/RenameDialog';
import { MarkdownCloseDialog } from './MarkdownCloseDialog';
import { MarkdownChangeImpactDialog } from './MarkdownChangeImpactDialog';
import type { MarkdownEditorController } from './useMarkdownEditorController';

export type MarkdownEditorDialogsProps = {
  fileName: string;
  controller: MarkdownEditorController;
};

export const MarkdownEditorDialogs = ({ fileName, controller }: MarkdownEditorDialogsProps) => {
  const { file, attachments, close, save } = controller;

  return (
    <>
      <RenameDialog
        open={file.renameOpen}
        currentName={fileName}
        entityType="document"
        onRename={file.onRenameConfirm}
        onCancel={file.cancelRename}
      />

      <DeleteConfirmationDialog
        open={file.deleteOpen}
        title="Delete document?"
        message={
          <>
            The document <b>{fileName}</b> will be permanently deleted.
          </>
        }
        detail="This can't be undone."
        confirmLabel="Delete document"
        onConfirm={file.onDeleteConfirm}
        onCancel={file.cancelDelete}
      />

      <DeleteConfirmationDialog
        open={attachments.attachmentDeleteTarget !== null}
        title="Delete attachment?"
        message={
          <>
            The attachment{' '}
            <b>
              {attachments.attachmentDeleteTarget?.original_filename ??
                attachments.attachmentDeleteTarget?.name ??
                ''}
            </b>{' '}
            will be permanently deleted.
          </>
        }
        detail="This can't be undone."
        confirmLabel="Delete attachment"
        onConfirm={attachments.onDeleteConfirm}
        onCancel={attachments.cancelDelete}
      />

      <MarkdownCloseDialog
        open={close.closeDialogOpen}
        summary={close.closeSummary}
        onCancel={close.cancelClose}
        onCloseWithSelection={diagramIds =>
          void (diagramIds.length > 0
            ? close.revertEligibleDiagramChanges(diagramIds)
            : close.keepDiagramChanges())
        }
      />

      <MarkdownChangeImpactDialog
        open={save.workflow.pendingSaveIntent !== null}
        intent={save.workflow.pendingSaveIntent}
        changeKind={save.workflow.changeKind}
        initiationFields={save.workflow.initiationFields}
        initiationFieldValues={save.workflow.initiationFieldValues}
        onInitiationFieldValuesChange={save.workflow.setInitiationFieldValues}
        onChangeKind={save.workflow.setChangeKind}
        onCancel={save.workflow.cancel}
        onConfirm={() => void save.workflow.confirm()}
      />
    </>
  );
};
