import type { ReactNode } from 'react';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ErrorDialog } from '@diagram-craft/app-components/ErrorDialog';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import type {
  PendingFieldChange,
  SharedFieldGroupLink
} from '@arch-register/api-types/schemaContract';
import type { SharedFieldGroup } from '@arch-register/api-types/fieldGroupContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { GroupDialog } from '../../components/GroupsEditor';
import { TeamAccessPicker } from '../../components/TeamAccessPicker';
import {
  FieldMigrationDialog,
  type FieldMigrationChoices
} from '../../dialogs/FieldMigrationDialog';
import type { EditorGroup } from './schemaEditorState';

export const SchemaEditorDialogs = <Group extends EditorGroup>({
  selectedName,
  subjectLabel,
  migrationSubjectLabel = subjectLabel,
  migrationItemNoun = subjectLabel === 'relation type' ? 'relation' : 'entity',
  deleteTitle,
  deleteConfirmLabel,
  fieldGroups,
  sharedFieldGroupLinks,
  groups,
  teams,
  confirmDelete,
  errorMessage,
  pendingFieldChanges,
  groupDialogOpen,
  editingGroup,
  accessDialogGroupId,
  onConfirmDelete,
  onCancelDelete,
  onCloseError,
  onCancelMigration,
  onConfirmMigration,
  onCloseGroup,
  onSaveGroup,
  onAddSharedGroup,
  onCloseAccess,
  onSetGroupAccess,
  extraDialogs
}: {
  selectedName: string | null;
  subjectLabel: string;
  migrationSubjectLabel?: string;
  migrationItemNoun?: string;
  deleteTitle: string;
  deleteConfirmLabel: string;
  fieldGroups: SharedFieldGroup[];
  sharedFieldGroupLinks: SharedFieldGroupLink[];
  groups: Group[];
  teams: WorkspaceTeam[];
  confirmDelete: boolean;
  errorMessage: string | null;
  pendingFieldChanges: PendingFieldChange[] | null;
  groupDialogOpen: boolean;
  editingGroup: Group | null;
  accessDialogGroupId: string | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onCloseError: () => void;
  onCancelMigration: () => void;
  onConfirmMigration: (choices: FieldMigrationChoices) => void;
  onCloseGroup: () => void;
  onSaveGroup: (group: Group) => void;
  onAddSharedGroup: (groupId: string) => void;
  onCloseAccess: () => void;
  onSetGroupAccess: (groupId: string, teamIds: string[]) => void;
  extraDialogs?: ReactNode;
}) => (
  <>
    <DeleteConfirmationDialog
      open={confirmDelete}
      title={deleteTitle}
      message={
        selectedName ? (
          <>
            The {subjectLabel} <b>{selectedName}</b> will be permanently deleted.
          </>
        ) : (
          ''
        )
      }
      detail="This can't be undone."
      confirmLabel={deleteConfirmLabel}
      onConfirm={onConfirmDelete}
      onCancel={onCancelDelete}
    />
    <ErrorDialog
      open={errorMessage !== null}
      title="Something went wrong"
      message={errorMessage}
      onClose={onCloseError}
    />
    <FieldMigrationDialog
      open={pendingFieldChanges !== null}
      pendingChanges={pendingFieldChanges ?? []}
      subjectLabel={migrationSubjectLabel}
      itemNoun={migrationItemNoun}
      onCancel={onCancelMigration}
      onConfirm={onConfirmMigration}
    />
    <GroupDialog
      open={groupDialogOpen}
      onClose={onCloseGroup}
      onSave={group => onSaveGroup(group as Group)}
      group={editingGroup as EditorGroup | null}
      groups={groups as EditorGroup[]}
      sharedGroups={fieldGroups.filter(
        group => !sharedFieldGroupLinks.some(link => link.groupId === group.id)
      )}
      onAddSharedGroup={onAddSharedGroup}
    />
    <Dialog
      open={accessDialogGroupId !== null}
      onClose={onCloseAccess}
      title="Field group access"
      buttons={[{ label: 'Done', type: 'default', onClick: onCloseAccess }]}
    >
      {accessDialogGroupId && (
        <TeamAccessPicker
          teams={teams}
          teamIds={
            sharedFieldGroupLinks.find(link => link.groupId === accessDialogGroupId)?.teamIds ??
            groups.find(group => group.id === accessDialogGroupId)?.accessControl?.teamIds ??
            []
          }
          onChange={teamIds => onSetGroupAccess(accessDialogGroupId, teamIds)}
        />
      )}
    </Dialog>
    {extraDialogs}
  </>
);
