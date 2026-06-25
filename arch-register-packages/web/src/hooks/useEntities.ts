import { useMemo } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import type { EntityRelation } from '../lib/api';
import type {
  CreateSavedViewRequest,
  FilterCondition,
  UpdateSavedViewRequest
} from '@arch-register/api-types/viewContract';
import {
  entityKeys,
  schemaKeys,
  snapshotKeys,
  viewKeys,
  invalidateEntityDetails,
  invalidateEntityQueries,
  invalidateAllEntityCaches,
  invalidateSnapshotQueries
} from './queryKeys';
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
    conditions?: FilterCondition[];
    view?: 'summary' | 'full';
    limit?: number | null;
    offset?: number | null;
  } = {},
  queryOptions?: { enabled?: boolean }
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
          conditions: options.conditions?.length
            ? JSON.stringify(options.conditions)
            : undefined,
          view: options.view,
          limit: options.limit ?? undefined,
          offset: options.offset ?? undefined
        }
      }),
    enabled: queryOptions?.enabled ?? !!workspaceId
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
      await invalidateAllEntityCaches(queryClient, workspaceId);
      // Schema counts change when an entity is removed
      await queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceId) });
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
      await invalidateEntityDetails(queryClient, workspaceId, variables.entityId);
      await invalidateEntityQueries(queryClient, workspaceId);
      await invalidateSnapshotQueries(queryClient, workspaceId, variables.entityId);
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
      await invalidateEntityQueries(queryClient, workspaceId);
    }
  });
};

// Type for per-entity relation data returned by useMultipleEntityRelations
export type EntityRelationData = {
  outgoing: EntityRelation[];
  incoming: EntityRelation[];
  isLoading: boolean;
};

// Hook for fetching relations for multiple entities at once (single batch request)
export const useMultipleEntityRelations = (
  workspaceId: string,
  entityIds: string[]
): Map<string, EntityRelationData> => {
  const sortedIds = useMemo(() => [...entityIds].sort(), [entityIds]);

  const { data, isLoading } = useQuery({
    queryKey: entityKeys.batchRelations(workspaceId, sortedIds),
    queryFn: () =>
      orpcClient.entities.batchRelations({
        params: { workspace: workspaceId },
        body: { ids: sortedIds }
      }),
    enabled: !!workspaceId && sortedIds.length > 0
  });

  return useMemo(() => {
    const map = new Map<string, EntityRelationData>();
    for (const id of entityIds) {
      const rel = data?.[id];
      map.set(id, {
        outgoing: rel?.outgoing ?? [],
        incoming: rel?.incoming ?? [],
        isLoading
      });
    }
    return map;
  }, [data, isLoading, entityIds]);
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
      invalidateSnapshotQueries(queryClient, workspaceId, entityId);
      queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspaceId, entityId) });
    }
  });
};

export const useCreateFutureUpdate = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      projectId: string;
      targetDate?: string | null;
      commitMessage?: string | null;
      proposedState: Record<string, unknown>;
    }) =>
      orpcClient.entities.snapshots.create({
        params: { workspace: workspaceId, id: entityId },
        body: params
      }),
    onSuccess: (_, variables) => {
      invalidateSnapshotQueries(queryClient, workspaceId, entityId, variables.projectId);
    }
  });
};

export const useUpdateSnapshot = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      snapshotId: string;
      projectId?: string | null;
      proposedState?: Record<string, unknown>;
      targetDate?: string | null;
      commitMessage?: string | null;
    }) =>
      orpcClient.entities.snapshots.update({
        params: { workspace: workspaceId, id: entityId, snapshotId: params.snapshotId },
        body: {
          proposedState: params.proposedState,
          targetDate: params.targetDate,
          commitMessage: params.commitMessage
        }
      }),
    onSuccess: (_, variables) => {
      invalidateSnapshotQueries(queryClient, workspaceId, entityId, variables.projectId);
    }
  });
};

export const useRestoreSnapshot = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { snapshotId: string; commitMessage?: string }) =>
      orpcClient.entities.snapshots.restore({
        params: { workspace: workspaceId, id: entityId, snapshotId: params.snapshotId },
        body: { commitMessage: params.commitMessage }
      }),
    onSuccess: () => {
      invalidateEntityDetails(queryClient, workspaceId, entityId);
      invalidateSnapshotQueries(queryClient, workspaceId, entityId);
    }
  });
};

export const useApplySnapshot = (workspaceId: string, entityId: string, projectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      snapshotId: string;
      resolvedEntityData: Record<string, unknown>;
    }) =>
      orpcClient.entities.snapshots.apply({
        params: { workspace: workspaceId, id: entityId, snapshotId: params.snapshotId },
        body: { resolvedEntityData: params.resolvedEntityData }
      }),
    onSuccess: () => {
      invalidateSnapshotQueries(queryClient, workspaceId, entityId, projectId);
      invalidateEntityDetails(queryClient, workspaceId, entityId);
      invalidateEntityQueries(queryClient, workspaceId);
    }
  });
};

export const useProjectFutureSnapshots = (workspaceId: string, projectId: string) => {
  return useQuery({
    queryKey: snapshotKeys.byProject(workspaceId, projectId),
    queryFn: () =>
      orpcClient.entities.snapshots.listByProject({
        params: { workspace: workspaceId, projectId }
      }),
    enabled: !!workspaceId && !!projectId
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
