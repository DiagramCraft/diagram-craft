import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import type { EntityRelation } from '../lib/api';
import type {
  CreateSavedViewRequest,
  UpdateSavedViewRequest
} from '@arch-register/api-types/viewContract';
import { entityKeys, schemaKeys, snapshotKeys, viewKeys } from './queryKeys';
import { invalidateAuditQueries } from './useAudit';
import { invalidateNotificationQueries } from './useNotifications';
import { orpcClient } from '../lib/orpcClient';

// Hook for fetching entity list
export const useEntities = (
  workspaceId: string,
  options: {
    schemaId?: string | null;
    owner?: string | null;
    lifecycle?: string | null;
    q?: string | null;
    view?: 'summary' | 'full';
    limit?: number | null;
    offset?: number | null;
  } = {}
) => {
  return useQuery({
    queryKey: entityKeys.list(workspaceId, options),
    queryFn: () =>
      orpcClient.entities.list({
        params: { workspace: workspaceId },
        query: {
          _schemaId: options.schemaId ?? undefined,
          owner: options.owner ?? undefined,
          lifecycle: options.lifecycle ?? undefined,
          q: options.q ?? undefined,
          view: options.view,
          limit: options.limit ?? undefined,
          offset: options.offset ?? undefined
        }
      }),
    enabled: !!workspaceId
  });
};

// Hook for fetching a single entity
export const useEntity = (workspaceId: string, entityId: string) => {
  return useQuery({
    queryKey: entityKeys.detail(workspaceId, entityId),
    queryFn: () => orpcClient.entities.get({ params: { workspace: workspaceId, id: entityId } }),
    enabled: !!workspaceId && !!entityId
  });
};

// Hook for fetching entity facets (for filters)
export const useEntityFacets = (workspaceId: string) => {
  return useQuery({
    queryKey: entityKeys.facets(workspaceId),
    queryFn: () => orpcClient.entities.facets({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId
  });
};

// Hook for fetching entity relations
export const useEntityRelations = (workspaceId: string, entityId: string) => {
  return useQuery({
    queryKey: entityKeys.relations(workspaceId, entityId),
    queryFn: () =>
      orpcClient.entities.relations({ params: { workspace: workspaceId, id: entityId } }),
    enabled: !!workspaceId && !!entityId
  });
};

// Hook for fetching entity tree
export const useEntityTree = (
  workspaceId: string,
  options: {
    schemaId?: string | null;
    owner?: string | null;
    lifecycle?: string | null;
    q?: string | null;
  } = {}
) => {
  return useQuery({
    queryKey: entityKeys.tree(workspaceId, options),
    queryFn: () =>
      orpcClient.entities.tree({
        params: { workspace: workspaceId },
        query: {
          _schemaId: options.schemaId ?? undefined,
          owner: options.owner ?? undefined,
          lifecycle: options.lifecycle ?? undefined,
          q: options.q ?? undefined
        }
      }),
    enabled: !!workspaceId
  });
};

// Hook for deleting an entity
export const useDeleteEntity = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entityId: string) =>
      orpcClient.entities.remove({ params: { workspace: workspaceId, id: entityId } }),
    onSuccess: async () => {
      // Invalidate all entity-related queries to refetch
      await queryClient.invalidateQueries({ queryKey: entityKeys.all });
      // Invalidate schema queries to update entity counts in sidebar
      await queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceId) });
      await invalidateAuditQueries(queryClient, workspaceId);
      await invalidateNotificationQueries(queryClient, workspaceId);
    }
  });
};

// Hook for updating an entity
export const useUpdateEntity = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entityId, data }: { entityId: string; data: Record<string, unknown> }) =>
      orpcClient.entities.update({
        params: { workspace: workspaceId, id: entityId },
        body: data
      }),
    onSuccess: async (_, variables) => {
      // Invalidate the specific entity and relations
      await queryClient.invalidateQueries({
        queryKey: entityKeys.detail(workspaceId, variables.entityId)
      });
      await queryClient.invalidateQueries({
        queryKey: entityKeys.relations(workspaceId, variables.entityId)
      });
      await queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

// Hook for cloning an entity
export const useCloneEntity = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entityId: string) =>
      orpcClient.entities.clone({ params: { workspace: workspaceId, id: entityId } }),
    onSuccess: async () => {
      // Invalidate entity lists to show the new clone
      await queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

// Type for per-entity relation data returned by useMultipleEntityRelations
export type EntityRelationData = {
  outgoing: EntityRelation[];
  incoming: EntityRelation[];
  isLoading: boolean;
};

// Hook for fetching relations for multiple entities at once
export const useMultipleEntityRelations = (
  workspaceId: string,
  entityIds: string[]
): Map<string, EntityRelationData> => {
  const results = useQueries({
    queries: entityIds.map(entityId => ({
      queryKey: entityKeys.relations(workspaceId, entityId),
      queryFn: () =>
        orpcClient.entities.relations({ params: { workspace: workspaceId, id: entityId } }),
      enabled: !!workspaceId && !!entityId
    }))
  });

  const map = new Map<string, EntityRelationData>();
  for (let i = 0; i < entityIds.length; i++) {
    const id = entityIds[i]!;
    const result = results[i];
    map.set(id, {
      outgoing: result?.data?.outgoing ?? [],
      incoming: result?.data?.incoming ?? [],
      isLoading: result?.isLoading ?? true
    });
  }
  return map;
};

// Hook for fetching entities by multiple schema IDs
export const useEntitiesBySchema = (workspaceId: string, schemaIds: string[]) => {
  return useQueries({
    queries: schemaIds.map(schemaId => ({
      queryKey: entityKeys.list(workspaceId, { schemaId, view: 'summary' }),
      queryFn: () =>
        orpcClient.entities.list({
          params: { workspace: workspaceId },
          query: { _schemaId: schemaId, view: 'summary' }
        }),
      enabled: !!workspaceId && !!schemaId
    }))
  });
};

// ── Snapshot Hooks ────────────────────────────────────────────

export const useEntitySnapshots = (workspaceId: string, entityId: string, enabled = false) => {
  return useQuery({
    queryKey: snapshotKeys.list(workspaceId, entityId),
    queryFn: () =>
      orpcClient.entities.snapshots.list({ params: { workspace: workspaceId, id: entityId } }),
    enabled: !!workspaceId && !!entityId && enabled
  });
};

export const usePromoteSnapshot = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commitMessage }: { commitMessage?: string }) => {
      const snapshots = await orpcClient.entities.snapshots.list({
        params: { workspace: workspaceId, id: entityId }
      });
      const latestAutosave = snapshots.find(s => s.status === 'autosave');
      if (!latestAutosave) throw new Error('No autosave snapshot found to promote');
      return orpcClient.entities.snapshots.promote({
        params: { workspace: workspaceId, id: entityId, snapshotId: latestAutosave.id },
        body: { commitMessage }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: snapshotKeys.list(workspaceId, entityId) });
    }
  });
};

// ── Saved View Hooks ──────────────────────────────────────────

export const useSavedViews = (workspaceId: string) => {
  return useQuery({
    queryKey: viewKeys.list(workspaceId),
    queryFn: () => orpcClient.views.list({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId
  });
};

export const useCreateSavedView = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateSavedViewRequest) =>
      orpcClient.views.create({ params: { workspace: workspaceId }, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: viewKeys.list(workspaceId) });
    }
  });
};

export const useUpdateSavedView = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSavedViewRequest }) =>
      orpcClient.views.update({ params: { workspace: workspaceId, id }, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: viewKeys.list(workspaceId) });
    }
  });
};

export const useDeleteSavedView = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      orpcClient.views.remove({ params: { workspace: workspaceId, id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: viewKeys.list(workspaceId) });
    }
  });
};
