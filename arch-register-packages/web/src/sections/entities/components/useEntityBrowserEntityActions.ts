import { useCallback, useState } from 'react';
import { useCloneEntity, useDeleteEntity } from '../../../hooks/useEntities';
import type { EntityRecord } from '@arch-register/api-types/entityContract';

type UseEntityBrowserEntityActionsProps = {
  workspaceId: string;
  onNavigateToEntity: (entityPublicId: string) => void;
  projectId?: string;
};

export const useEntityBrowserEntityActions = ({
  workspaceId,
  onNavigateToEntity,
  projectId
}: UseEntityBrowserEntityActionsProps) => {
  const [deleteTarget, setDeleteTarget] = useState<EntityRecord | null>(null);
  const [mergeSource, setMergeSource] = useState<EntityRecord | null>(null);
  const [cloneTarget, setCloneTarget] = useState<EntityRecord | null>(null);
  const deleteMutation = useDeleteEntity(workspaceId);
  const cloneMutation = useCloneEntity(workspaceId);

  const handleDeleteEntity = useCallback((entity: EntityRecord) => {
    setDeleteTarget(entity);
  }, []);

  const confirmDeleteEntity = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteTarget(null);
    try {
      await deleteMutation.mutateAsync(deleteTarget._uid);
    } catch {
      // Error handling is done by TanStack Query
    }
  }, [deleteMutation, deleteTarget]);

  const handleCloneEntity = useCallback((entity: EntityRecord) => {
    setCloneTarget(entity);
  }, []);

  const confirmCloneEntity = useCallback(async () => {
    if (!cloneTarget) return;
    setCloneTarget(null);
    try {
      const cloned = await cloneMutation.mutateAsync({
        entityId: cloneTarget._uid,
        projectId
      });
      onNavigateToEntity(cloned._publicId);
    } catch {
      // Error handling is done by TanStack Query
    }
  }, [cloneMutation, cloneTarget, onNavigateToEntity, projectId]);

  const handleMergeEntity = useCallback((entity: EntityRecord) => {
    setMergeSource(entity);
  }, []);

  return {
    cloneTarget,
    confirmCloneEntity,
    setCloneTarget,
    confirmDeleteEntity,
    deleteTarget,
    handleCloneEntity,
    handleDeleteEntity,
    setDeleteTarget,
    mergeSource,
    handleMergeEntity,
    setMergeSource
  };
};
