import { useCallback, useState } from 'react';
import { useCloneEntity, useDeleteEntity } from '../../../hooks/useEntities';
import type { EntityRecord } from '@arch-register/api-types/entityContract';

type UseEntityBrowserEntityActionsProps = {
  workspaceId: string;
  onNavigateToEntity: (entityPublicId: string) => void;
};

export const useEntityBrowserEntityActions = ({
  workspaceId,
  onNavigateToEntity
}: UseEntityBrowserEntityActionsProps) => {
  const [deleteTarget, setDeleteTarget] = useState<EntityRecord | null>(null);
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

  const handleCloneEntity = useCallback(
    async (entity: EntityRecord) => {
      try {
        const cloned = await cloneMutation.mutateAsync(entity._uid);
        onNavigateToEntity(cloned._publicId);
      } catch {
        // Error handling is done by TanStack Query
      }
    },
    [cloneMutation, onNavigateToEntity]
  );

  return {
    confirmDeleteEntity,
    deleteTarget,
    handleCloneEntity,
    handleDeleteEntity,
    setDeleteTarget
  };
};
