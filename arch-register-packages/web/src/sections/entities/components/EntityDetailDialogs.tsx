import type { ComponentProps } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { GovernanceInitiationFields } from '../../governance/GovernanceInitiationFields';
import { CollectionPickerDialog } from './CollectionPickerDialog';
import { ProposeEntityDeprecationDialog } from './EntityDeprecationPanel';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { LoadingState } from '../../../components/LoadingState';
import { Banner } from '../../../components/Banner';

type Props = {
  entity: EntityRecord;
  entityName: string;
  workspaceId: string;
  entityId: string;
  viewJsonOpen: boolean;
  setViewJsonOpen: (open: boolean) => void;
  entityJson: unknown;
  entityJsonLoading: boolean;
  saveConfirmOpen: boolean;
  setSaveConfirmOpen: (open: boolean) => void;
  saveConfirmMessage: string;
  setSaveConfirmMessage: (message: string) => void;
  saveConfirmDueDate: string;
  setSaveConfirmDueDate: (date: string) => void;
  saveConfirmSignificant: boolean;
  setSaveConfirmSignificant: (significant: boolean) => void;
  saveError: string;
  isSaving: boolean;
  approvalRequired: boolean;
  canOverrideApproval: boolean;
  changeApprovalLoading: boolean;
  hasChangeApproval: boolean;
  executeSave: () => void;
  executeBypass: () => void;
  confirmDelete: boolean;
  setConfirmDelete: (open: boolean) => void;
  doDelete: () => void;
  collectionPickerOpen: boolean;
  setCollectionPickerOpen: (open: boolean) => void;
  proposeDeprecationOpen: boolean;
  setProposeDeprecationOpen: (open: boolean) => void;
  entityInitiationFields: ComponentProps<typeof GovernanceInitiationFields>['fields'];
  initiationFieldValues: ComponentProps<typeof GovernanceInitiationFields>['values'];
  setInitiationFieldValues: ComponentProps<typeof GovernanceInitiationFields>['onChange'];
};

export const EntityDetailDialogs = ({
  entity,
  entityName,
  workspaceId,
  entityId,
  viewJsonOpen,
  setViewJsonOpen,
  entityJson,
  entityJsonLoading,
  saveConfirmOpen,
  setSaveConfirmOpen,
  saveConfirmMessage,
  setSaveConfirmMessage,
  saveConfirmDueDate,
  setSaveConfirmDueDate,
  saveConfirmSignificant,
  setSaveConfirmSignificant,
  saveError,
  isSaving,
  approvalRequired,
  canOverrideApproval,
  changeApprovalLoading,
  hasChangeApproval,
  executeSave,
  executeBypass,
  confirmDelete,
  setConfirmDelete,
  doDelete,
  collectionPickerOpen,
  setCollectionPickerOpen,
  proposeDeprecationOpen,
  setProposeDeprecationOpen,
  entityInitiationFields,
  initiationFieldValues,
  setInitiationFieldValues
}: Props) => (
  <>
    <Dialog
      open={viewJsonOpen}
      onClose={() => setViewJsonOpen(false)}
      title="Entity JSON (depth 1)"
      width={800}
      buttons={[{ label: 'Close', type: 'cancel', onClick: () => setViewJsonOpen(false) }]}
    >
      {entityJsonLoading ? (
        <LoadingState text="Loading JSON…" size="sm" />
      ) : (
        <pre
          style={{
            margin: 0,
            maxHeight: '70vh',
            overflow: 'auto',
            padding: 12,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: 'var(--cmp-bg)',
            fontSize: 12
          }}
        >
          {JSON.stringify(entityJson ?? {}, null, 2)}
        </pre>
      )}
    </Dialog>

    <Dialog
      open={saveConfirmOpen}
      onClose={() => setSaveConfirmOpen(false)}
      title="Save changes"
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: () => setSaveConfirmOpen(false) },
        {
          label: isSaving ? 'Saving...' : approvalRequired ? 'Request approval' : 'Save',
          type: 'default',
          disabled: isSaving,
          onClick: executeSave
        },
        ...(approvalRequired && canOverrideApproval && !changeApprovalLoading && !hasChangeApproval
          ? [
              {
                label: isSaving ? 'Bypassing...' : 'Bypass approval',
                type: 'danger' as const,
                disabled: isSaving || saveConfirmMessage.trim() === '',
                onClick: executeBypass
              }
            ]
          : [])
      ]}
    >
      <FormElement
        label={approvalRequired && canOverrideApproval ? 'Note / bypass reason' : 'Note'}
        required={approvalRequired && canOverrideApproval}
      >
        <TextInput
          value={saveConfirmMessage}
          onChange={value => setSaveConfirmMessage(value ?? '')}
          placeholder="Describe what changed"
          style={{ width: '100%' }}
        />
      </FormElement>
      {approvalRequired && (
        <FormElement label="Due date (optional)">
          <DateInput
            value={saveConfirmDueDate}
            onChange={value => setSaveConfirmDueDate(value ?? '')}
          />
        </FormElement>
      )}
      <GovernanceInitiationFields
        fields={entityInitiationFields}
        values={initiationFieldValues}
        onChange={setInitiationFieldValues}
      />
      {saveError && <Banner variant="error">{saveError}</Banner>}
      <FormElement label="" required>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={saveConfirmSignificant}
            onChange={event => setSaveConfirmSignificant(event.target.checked)}
          />
          <span style={{ fontSize: 13 }}>Mark as significant version</span>
        </label>
      </FormElement>
    </Dialog>

    <DeleteConfirmationDialog
      open={confirmDelete}
      title="Delete entity?"
      message={
        <>
          The entity <b>{entityName}</b> will be permanently deleted.
        </>
      }
      detail="This can't be undone."
      confirmLabel="Delete entity"
      onConfirm={doDelete}
      onCancel={() => setConfirmDelete(false)}
    />
    {collectionPickerOpen && (
      <CollectionPickerDialog
        open={true}
        workspaceId={workspaceId}
        entityId={entity._uid}
        entityName={entityName}
        onClose={() => setCollectionPickerOpen(false)}
      />
    )}
    <ProposeEntityDeprecationDialog
      open={proposeDeprecationOpen}
      onClose={() => setProposeDeprecationOpen(false)}
      workspaceId={workspaceId}
      entityId={entityId}
      baseVersion={entity._version ?? 1}
    />
  </>
);
