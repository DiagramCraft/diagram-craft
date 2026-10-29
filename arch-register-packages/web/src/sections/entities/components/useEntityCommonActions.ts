import { useCallback, useMemo } from 'react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import {
  useCreatePinnedEntity,
  useDeletePinnedEntity,
  usePinnedEntities
} from '../../../hooks/useNotifications';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import type { EntityCommonActions, EntityRef } from './entityMenu';

const publicId = (entity: EntityRef) => entity._publicId ?? entity._uid;

/** Shared open / copy link / pin handlers backing the common entries of every entity menu. */
export const useEntityCommonActions = (): EntityCommonActions => {
  const { workspaceSlug } = useWorkspaceContext();
  const navigate = useNavigate();
  const router = useRouter();
  const { data: pinned = [] } = usePinnedEntities(workspaceSlug);
  const createPin = useCreatePinnedEntity(workspaceSlug);
  const deletePin = useDeletePinnedEntity(workspaceSlug);

  const pinnedIds = useMemo(() => new Set(pinned.map(p => p.entity_public_id)), [pinned]);

  const href = useCallback(
    (entity: EntityRef) =>
      router.buildLocation(entityDetailRoute(workspaceSlug, asEntityPublicId(publicId(entity))))
        .href,
    [router, workspaceSlug]
  );

  return useMemo(
    () => ({
      open: entity =>
        void navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(publicId(entity)))),
      openInNewTab: entity => void window.open(href(entity), '_blank', 'noopener'),
      copyLink: entity =>
        void navigator.clipboard.writeText(new URL(href(entity), window.location.origin).href),
      isPinned: entity => pinnedIds.has(publicId(entity)),
      togglePin: entity =>
        pinnedIds.has(publicId(entity))
          ? deletePin.mutate(entity._uid)
          : createPin.mutate({
              entityId: entity._uid,
              entityPublicId: publicId(entity),
              entityName: entity._name ?? entity._slug,
              entitySlug: entity._slug,
              schemaId: entity._schema.id
            })
    }),
    [navigate, workspaceSlug, href, pinnedIds, createPin, deletePin]
  );
};
