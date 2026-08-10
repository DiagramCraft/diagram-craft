import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ErrorDialog } from '@diagram-craft/app-components/ErrorDialog';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import type {
  PendingFieldChange,
  SharedFieldGroupLink
} from '@arch-register/api-types/schemaContract';
import type {
  RelationSchema,
  RelationSchemaGroup
} from '@arch-register/api-types/relationSchemaContract';
import type { SharedFieldGroup } from '@arch-register/api-types/fieldGroupContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { GroupDialog } from '../../components/GroupsEditor';
import { TeamAccessPicker } from '../../components/TeamAccessPicker';
import {
  FieldMigrationDialog,
  type FieldMigrationChoices
} from '../../dialogs/FieldMigrationDialog';

export const RelationSchemaSettingsDialogs = ({
  selected,
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
  onSetGroupAccess
}: {
  selected: RelationSchema | null;
  fieldGroups: SharedFieldGroup[];
  sharedFieldGroupLinks: SharedFieldGroupLink[];
  groups: RelationSchemaGroup[];
  teams: WorkspaceTeam[];
  confirmDelete: boolean;
  errorMessage: string | null;
  pendingFieldChanges: PendingFieldChange[] | null;
  groupDialogOpen: boolean;
  editingGroup: RelationSchemaGroup | null;
  accessDialogGroupId: string | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onCloseError: () => void;
  onCancelMigration: () => void;
  onConfirmMigration: (choices: FieldMigrationChoices) => void;
  onCloseGroup: () => void;
  onSaveGroup: (group: RelationSchemaGroup) => void;
  onAddSharedGroup: (groupId: string) => void;
  onCloseAccess: () => void;
  onSetGroupAccess: (groupId: string, teamIds: string[]) => void;
}) => (
  <>
    <DeleteConfirmationDialog
      open={confirmDelete}
      title="Delete relation type?"
      message={
        selected ? (
          <>
            The relation type <b>{selected.name}</b> will be permanently deleted.
          </>
        ) : (
          ''
        )
      }
      detail="This can't be undone."
      confirmLabel="Delete type"
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
      subjectLabel="relation type"
      itemNoun="relation"
      onCancel={onCancelMigration}
      onConfirm={onConfirmMigration}
    />
    <GroupDialog
      open={groupDialogOpen}
      onClose={onCloseGroup}
      onSave={onSaveGroup}
      group={editingGroup}
      groups={groups}
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
  </>
);
