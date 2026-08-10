import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { RenameDialog } from '../../components/RenameDialog';
import { MarkdownCloseDialog } from './MarkdownCloseDialog';
import { MarkdownChangeImpactDialog } from './MarkdownChangeImpactDialog';
import type { MarkdownEditorController } from './useMarkdownEditorController';

export type MarkdownEditorDialogsProps = {
  fileName: string;
  controller: MarkdownEditorController;
};

export const MarkdownEditorDialogs = ({ fileName, controller }: MarkdownEditorDialogsProps) => (
  <>
    <RenameDialog
      open={controller.renameOpen}
      currentName={fileName}
      entityType="document"
      onRename={controller.onRenameConfirm}
      onCancel={controller.cancelRename}
    />

    <DeleteConfirmationDialog
      open={controller.deleteOpen}
      title="Delete document?"
      message={
        <>
          The document <b>{fileName}</b> will be permanently deleted.
        </>
      }
      detail="This can't be undone."
      confirmLabel="Delete document"
      onConfirm={controller.onDeleteConfirm}
      onCancel={controller.cancelDelete}
    />

    <DeleteConfirmationDialog
      open={controller.attachmentDeleteTarget !== null}
      title="Delete attachment?"
      message={
        <>
          The attachment{' '}
          <b>
            {controller.attachmentDeleteTarget?.original_filename ??
              controller.attachmentDeleteTarget?.name ??
              ''}
          </b>{' '}
          will be permanently deleted.
        </>
      }
      detail="This can't be undone."
      confirmLabel="Delete attachment"
      onConfirm={controller.onAttachmentDeleteConfirm}
      onCancel={controller.cancelAttachmentDelete}
    />

    <MarkdownCloseDialog
      open={controller.closeDialogOpen}
      summary={controller.closeSummary}
      onCancel={controller.cancelClose}
      onCloseWithSelection={diagramIds =>
        void (diagramIds.length > 0
          ? controller.revertEligibleDiagramChanges(diagramIds)
          : controller.keepDiagramChanges())
      }
    />

    <MarkdownChangeImpactDialog
      open={controller.pendingSaveIntent !== null}
      intent={controller.pendingSaveIntent}
      changeKind={controller.changeKind}
      initiationFields={controller.documentInitiationFields}
      initiationFieldValues={controller.initiationFieldValues}
      onInitiationFieldValuesChange={controller.setInitiationFieldValues}
      onChangeKind={controller.setChangeKind}
      onCancel={controller.cancelChangeImpact}
      onConfirm={() => void controller.confirmChangeImpact()}
    />
  </>
);
