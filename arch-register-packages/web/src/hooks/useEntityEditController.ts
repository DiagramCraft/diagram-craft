import { useState } from 'react';
import type { EntityRecord, EntitySummary } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  createEntityEditState,
  createEntityUpdateBody,
  requiredEntityFieldIds,
  type EntityEditState,
  type TypedRelationEditState
} from '../lib/entityEditState';
import { useDeleteEntity, useUpdateEntity } from './useEntities';
import { usePromoteEntityVersion } from './useEntityVersions';
import { useBypassEntityApproval, useSubmitEntityChangeApproval } from './useEntityChanges';

type Params = {
  workspaceId: string;
  entityId: string;
  entity: EntityRecord | undefined;
  schema: EntitySchema | null;
  approvalRequired: boolean;
  canBypassApproval: boolean;
  initiationFieldValues: Record<string, unknown>;
  onDeleted: () => void;
};

export const useEntityEditController = ({
  workspaceId,
  entityId,
  entity,
  schema,
  approvalRequired,
  canBypassApproval,
  initiationFieldValues,
  onDeleted
}: Params) => {
  const updateEntity = useUpdateEntity(workspaceId);
  const deleteEntity = useDeleteEntity(workspaceId);
  const promoteEntityVersion = usePromoteEntityVersion(workspaceId, entityId);
  const submitProposal = useSubmitEntityChangeApproval(workspaceId, entityId);
  const bypassApproval = useBypassEntityApproval(workspaceId, entityId);

  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<EntityEditState>({});
  const [typedRelationEditState, setTypedRelationEditState] = useState<TypedRelationEditState>({});
  const [editLinks, setEditLinks] = useState<EntitySummary['_links']>([]);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [saveConfirmMessage, setSaveConfirmMessage] = useState('');
  const [saveConfirmDueDate, setSaveConfirmDueDate] = useState('');
  const [saveConfirmSignificant, setSaveConfirmSignificant] = useState(false);
  const [pendingSaveBody, setPendingSaveBody] = useState<Record<string, unknown> | null>(null);
  const [saveError, setSaveError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startEdit = () => {
    if (!entity || !schema) return;
    setEditState(createEntityEditState(entity, schema));
    setTypedRelationEditState({});
    setEditLinks(entity._links.map(l => ({ ...l })));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditState({});
    setTypedRelationEditState({});
    setEditLinks([]);
    setValidationErrors(new Set());
  };

  const saveEdit = () => {
    if (!entity || !schema) return;

    const errors = requiredEntityFieldIds(editState, schema);
    if (errors.size > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors(new Set());

    const body = createEntityUpdateBody(
      entity,
      schema,
      editState,
      editLinks,
      typedRelationEditState
    );

    setPendingSaveBody(body);
    setSaveConfirmMessage('');
    setSaveConfirmDueDate('');
    setSaveConfirmSignificant(false);
    setSaveError('');
    setSaveConfirmOpen(true);
  };

  const handleSaveSuccess = () => {
    setSaveConfirmOpen(false);
    setEditing(false);
    setEditState({});
    setTypedRelationEditState({});
    setEditLinks([]);
    setPendingSaveBody(null);
  };

  const handleSaveError = (error: unknown) => {
    setSaveError(error instanceof Error ? error.message : 'Unable to save entity');
  };

  const executeSave = () => {
    if (!pendingSaveBody) return;
    setSaveError('');
    if (approvalRequired) {
      submitProposal.mutate(
        {
          baseVersion: entity?._version ?? 1,
          proposedState: pendingSaveBody,
          message: saveConfirmMessage ?? undefined,
          dueAt: saveConfirmDueDate || undefined,
          initiationFields: initiationFieldValues
        },
        {
          onSuccess: handleSaveSuccess,
          onError: handleSaveError
        }
      );
      return;
    }
    updateEntity.mutate(
      { entityId, data: pendingSaveBody },
      {
        onSuccess: () => {
          if (saveConfirmSignificant) {
            promoteEntityVersion.mutate({ commitMessage: saveConfirmMessage ?? undefined });
          }
          handleSaveSuccess();
        },
        onError: handleSaveError
      }
    );
  };

  const executeBypass = () => {
    const reason = saveConfirmMessage.trim();
    if (!canBypassApproval || !pendingSaveBody || reason === '') return;
    setSaveError('');
    bypassApproval.mutate(
      {
        baseVersion: entity?._version ?? 1,
        proposedState: pendingSaveBody,
        reason
      },
      {
        onSuccess: handleSaveSuccess,
        onError: handleSaveError
      }
    );
  };

  const handleDelete = () => setConfirmDelete(true);

  const doDelete = () => {
    setConfirmDelete(false);
    deleteEntity.mutate(entityId, { onSuccess: onDeleted });
  };

  return {
    editing,
    editState,
    setEditState,
    typedRelationEditState,
    setTypedRelationEditState,
    editLinks,
    setEditLinks,
    validationErrors,
    setValidationErrors,
    startEdit,
    cancelEdit,
    saveEdit,
    isSaving: updateEntity.isPending || submitProposal.isPending || bypassApproval.isPending,
    saveConfirmOpen,
    setSaveConfirmOpen,
    saveConfirmMessage,
    setSaveConfirmMessage,
    saveConfirmDueDate,
    setSaveConfirmDueDate,
    saveConfirmSignificant,
    setSaveConfirmSignificant,
    saveError,
    executeSave,
    executeBypass,
    confirmDelete,
    setConfirmDelete,
    handleDelete,
    doDelete
  };
};
