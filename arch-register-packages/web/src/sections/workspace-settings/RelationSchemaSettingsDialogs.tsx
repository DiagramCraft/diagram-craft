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
import { SchemaEditorDialogs } from './SchemaEditorDialogs';
import type { FieldMigrationChoices } from '../../dialogs/FieldMigrationDialog';

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
  <SchemaEditorDialogs
    selectedName={selected?.name ?? null}
    subjectLabel="relation type"
    migrationSubjectLabel="relation type"
    migrationItemNoun="relation"
    deleteTitle="Delete relation type?"
    deleteConfirmLabel="Delete type"
    fieldGroups={fieldGroups}
    sharedFieldGroupLinks={sharedFieldGroupLinks}
    groups={groups}
    teams={teams}
    confirmDelete={confirmDelete}
    errorMessage={errorMessage}
    pendingFieldChanges={pendingFieldChanges}
    groupDialogOpen={groupDialogOpen}
    editingGroup={editingGroup}
    accessDialogGroupId={accessDialogGroupId}
    onConfirmDelete={onConfirmDelete}
    onCancelDelete={onCancelDelete}
    onCloseError={onCloseError}
    onCancelMigration={onCancelMigration}
    onConfirmMigration={onConfirmMigration}
    onCloseGroup={onCloseGroup}
    onSaveGroup={onSaveGroup}
    onAddSharedGroup={onAddSharedGroup}
    onCloseAccess={onCloseAccess}
    onSetGroupAccess={onSetGroupAccess}
  />
);
