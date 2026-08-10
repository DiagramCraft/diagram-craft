import type {
  EntitySchema,
  EntityTemplate,
  PendingFieldChange,
  SchemaField,
  SchemaGroup,
  SharedFieldGroupLink
} from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import type { SharedFieldGroup } from '@arch-register/api-types/fieldGroupContract';
import { SchemaEditorDialogs } from './SchemaEditorDialogs';
import { EntityTemplateDialog } from '../../dialogs/EntityTemplateDialog';
import type { FieldMigrationChoices } from '../../dialogs/FieldMigrationDialog';

export const SchemaSettingsDialogs = ({
  selected,
  workspaceId,
  fields,
  templates,
  teams,
  lifecycleStates,
  fieldGroups,
  sharedFieldGroupLinks,
  groups,
  confirmDelete,
  errorMessage,
  pendingFieldChanges,
  groupDialogOpen,
  editingGroup,
  accessDialogGroupId,
  templateDialogOpen,
  editingTemplate,
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
  onCloseTemplate,
  onSaveTemplate
}: {
  selected: EntitySchema | null;
  workspaceId: string;
  fields: SchemaField[];
  templates: EntityTemplate[];
  teams: WorkspaceTeam[];
  lifecycleStates: WorkspaceLifecycleState[];
  fieldGroups: SharedFieldGroup[];
  sharedFieldGroupLinks: SharedFieldGroupLink[];
  groups: SchemaGroup[];
  confirmDelete: boolean;
  errorMessage: string | null;
  pendingFieldChanges: PendingFieldChange[] | null;
  groupDialogOpen: boolean;
  editingGroup: SchemaGroup | null;
  accessDialogGroupId: string | null;
  templateDialogOpen: boolean;
  editingTemplate: EntityTemplate | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onCloseError: () => void;
  onCancelMigration: () => void;
  onConfirmMigration: (choices: FieldMigrationChoices) => void;
  onCloseGroup: () => void;
  onSaveGroup: (group: SchemaGroup) => void;
  onAddSharedGroup: (groupId: string) => void;
  onCloseAccess: () => void;
  onSetGroupAccess: (groupId: string, teamIds: string[]) => void;
  onCloseTemplate: () => void;
  onSaveTemplate: (template: EntityTemplate) => void;
}) => (
  <SchemaEditorDialogs
    selectedName={selected?.name ?? null}
    subjectLabel="entity type"
    migrationSubjectLabel="schema"
    migrationItemNoun="entity"
    deleteTitle="Delete entity type?"
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
    extraDialogs={
      selected && (
        <EntityTemplateDialog
          open={templateDialogOpen}
          onClose={onCloseTemplate}
          onSave={onSaveTemplate}
          workspaceId={workspaceId}
          schema={{ ...selected, fields, templates } as EntitySchema}
          template={editingTemplate}
          templates={templates}
          teams={teams}
          lifecycleStates={lifecycleStates}
        />
      )
    }
  />
);
