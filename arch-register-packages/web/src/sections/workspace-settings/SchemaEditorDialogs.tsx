import type { ReactNode } from 'react';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ErrorDialog } from '@diagram-craft/app-components/ErrorDialog';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { GroupDialog } from '../../components/GroupsEditor';
import { TeamAccessPicker } from '../../components/TeamAccessPicker';
import { FieldMigrationDialog } from '../../dialogs/FieldMigrationDialog';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useSchemaEditor } from './schemaEditorContext';

/** Delete / error / field-migration / field-group dialogs shared by the schema editors. */
export const SchemaEditorDialogs = ({ extraDialogs }: { extraDialogs?: ReactNode }) => {
  const editor = useSchemaEditor();
  const { fieldGroups = [], teams } = useWorkspaceContext();
  const { labels, draft } = editor;
  const groups = draft?.groups ?? [];
  const sharedFieldGroupLinks = draft?.sharedFieldGroupLinks ?? [];
  const selectedName = (editor.selected as { name?: string } | null)?.name ?? null;

  return (
    <>
      <DeleteConfirmationDialog
        open={editor.confirmDelete}
        title={labels.deleteTitle}
        message={
          selectedName ? (
            <>
              The {labels.subject} <b>{selectedName}</b> will be permanently deleted.
            </>
          ) : (
            ''
          )
        }
        detail="This can't be undone."
        confirmLabel={labels.deleteConfirmLabel}
        onConfirm={() => void editor.deleteSelected()}
        onCancel={() => editor.setConfirmDelete(false)}
      />
      <ErrorDialog
        open={editor.errorMessage !== null}
        title="Something went wrong"
        message={editor.errorMessage}
        onClose={() => editor.setErrorMessage(null)}
      />
      <FieldMigrationDialog
        open={editor.pendingFieldChanges !== null}
        pendingChanges={editor.pendingFieldChanges ?? []}
        subjectLabel={labels.migrationSubject ?? labels.subject}
        itemNoun={labels.itemNoun}
        onCancel={() => editor.setPendingFieldChanges(null)}
        onConfirm={editor.confirmFieldMigrations}
      />
      <GroupDialog
        open={editor.groupDialogOpen}
        onClose={() => editor.setGroupDialogOpen(false)}
        onSave={editor.saveGroup}
        group={editor.editingGroup}
        groups={groups}
        sharedGroups={fieldGroups.filter(
          group => !sharedFieldGroupLinks.some(link => link.groupId === group.id)
        )}
        onAddSharedGroup={editor.addSharedFieldGroup}
      />
      <Dialog
        open={editor.accessDialogGroupId !== null}
        onClose={() => editor.setAccessDialogGroupId(null)}
        title="Field group access"
        buttons={[
          { label: 'Done', type: 'default', onClick: () => editor.setAccessDialogGroupId(null) }
        ]}
      >
        {editor.accessDialogGroupId && (
          <TeamAccessPicker
            teams={teams}
            teamIds={
              sharedFieldGroupLinks.find(link => link.groupId === editor.accessDialogGroupId)
                ?.teamIds ??
              groups.find(group => group.id === editor.accessDialogGroupId)?.accessControl
                ?.teamIds ??
              []
            }
            onChange={teamIds => editor.setGroupAccess(editor.accessDialogGroupId!, teamIds)}
          />
        )}
      </Dialog>
      {extraDialogs}
    </>
  );
};
