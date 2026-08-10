import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ErrorDialog } from '@diagram-craft/app-components/ErrorDialog';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import type { EntitySchema, EntityTemplate, PendingFieldChange, SchemaGroup, SchemaField, SharedFieldGroupLink } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import type { SharedFieldGroup } from '@arch-register/api-types/fieldGroupContract';
import { GroupDialog } from '../../components/GroupsEditor';
import { TeamAccessPicker } from '../../components/TeamAccessPicker';
import { EntityTemplateDialog } from '../../dialogs/EntityTemplateDialog';
import { FieldMigrationDialog, type FieldMigrationChoices } from '../../dialogs/FieldMigrationDialog';

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
  <>
    <DeleteConfirmationDialog
      open={confirmDelete}
      title="Delete entity type?"
      message={
        selected ? (
          <>
            The entity type <b>{selected.name}</b> will be permanently deleted.
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
    {selected && (
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
    )}
  </>
);
