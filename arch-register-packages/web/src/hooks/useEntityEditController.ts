import { useState } from 'react';
import type { EntityRecord, EntitySummary } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  createEntityEditState,
  createEntityUpdateBody,
  requiredEntityFieldIds,
  type EntityEditState
} from '../lib/entityEditState';
import { useDeleteEntity, useUpdateEntity } from './useEntities';
import { usePromoteSnapshot } from './useSnapshots';
import { useBypassEntityApproval, useSubmitEntityChangeProposal } from './useEntityChanges';

type Params = {
  workspaceId: string;
  entityId: string;
  entity: EntityRecord | undefined;
  schema: EntitySchema | null;
  approvalRequired: boolean;
  canBypassApproval: boolean;
  onDeleted: () => void;
};

export const useEntityEditController = ({
  workspaceId,
  entityId,
  entity,
  schema,
  approvalRequired,
  canBypassApproval,
  onDeleted
}: Params) => {
  const updateEntity = useUpdateEntity(workspaceId);
  const deleteEntity = useDeleteEntity(workspaceId);
  const promoteSnapshot = usePromoteSnapshot(workspaceId, entityId);
  const submitProposal = useSubmitEntityChangeProposal(workspaceId, entityId);
  const bypassApproval = useBypassEntityApproval(workspaceId, entityId);

  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<EntityEditState>({});
  const [editLinks, setEditLinks] = useState<EntitySummary['_links']>([]);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [saveConfirmMessage, setSaveConfirmMessage] = useState('');
  const [saveConfirmSignificant, setSaveConfirmSignificant] = useState(false);
  const [pendingSaveBody, setPendingSaveBody] = useState<Record<string, unknown> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startEdit = () => {
    if (!entity || !schema) return;
    setEditState(createEntityEditState(entity, schema));
    setEditLinks(entity._links.map(l => ({ ...l })));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditState({});
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

    const body = createEntityUpdateBody(entity, schema, editState, editLinks);

    setPendingSaveBody(body);
    setSaveConfirmMessage('');
    setSaveConfirmSignificant(false);
    setSaveConfirmOpen(true);
  };

  const executeSave = () => {
    if (!pendingSaveBody) return;
    setSaveConfirmOpen(false);
    if (approvalRequired) {
      submitProposal.mutate(
        {
          baseVersion: entity?._version ?? 1,
          proposedState: pendingSaveBody,
          message: saveConfirmMessage || undefined
        },
        {
          onSuccess: () => {
            setEditing(false);
            setEditState({});
            setEditLinks([]);
            setPendingSaveBody(null);
          }
        }
      );
      return;
    }
    updateEntity.mutate(
      { entityId, data: pendingSaveBody },
      {
        onSuccess: () => {
          if (saveConfirmSignificant) {
            promoteSnapshot.mutate({ commitMessage: saveConfirmMessage || undefined });
          }
          setEditing(false);
          setEditState({});
          setEditLinks([]);
          setPendingSaveBody(null);
        }
      }
    );
  };

  const executeBypass = () => {
    const reason = saveConfirmMessage.trim();
    if (!canBypassApproval || !pendingSaveBody || reason === '') return;
    setSaveConfirmOpen(false);
    bypassApproval.mutate(
      {
        baseVersion: entity?._version ?? 1,
        proposedState: pendingSaveBody,
        reason
      },
      {
        onSuccess: () => {
          setEditing(false);
          setEditState({});
          setEditLinks([]);
          setPendingSaveBody(null);
        }
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
    saveConfirmSignificant,
    setSaveConfirmSignificant,
    executeSave,
    executeBypass,
    confirmDelete,
    setConfirmDelete,
    handleDelete,
    doDelete
  };
};
