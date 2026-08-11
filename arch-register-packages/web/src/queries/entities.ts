import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntityLandscapeDiffState } from '@arch-register/api-types/entityContract';
import { invalidateAuditQueries } from './audit';
import { schemaKeys } from './schemaKeys';
import { invalidateNotificationQueries } from './notifications';
import { orpcClient } from '../lib/orpcClient';
import { toEntityListQuery, type EntityListOptions } from '../hooks/entityListQuery';

export const entityKeys = {
  all: ['entities'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  workspaceLists: (workspaceId: string) => [...entityKeys.lists(), workspaceId] as const,
  list: (workspaceId: string, filters: Record<string, unknown>) =>
    [...entityKeys.workspaceLists(workspaceId), filters] as const,
  counts: (workspaceId: string) => [...entityKeys.all, 'count', workspaceId] as const,
  count: (workspaceId: string, filters: Record<string, unknown>) =>
    [...entityKeys.counts(workspaceId), filters] as const,
  details: () => [...entityKeys.all, 'detail'] as const,
  workspaceDetails: (workspaceId: string) => [...entityKeys.details(), workspaceId] as const,
  detail: (workspaceId: string, entityId: string) =>
    [...entityKeys.workspaceDetails(workspaceId), entityId] as const,
  json: (workspaceId: string, entityId: string, depth: number) =>
    [...entityKeys.workspaceDetails(workspaceId), 'json', entityId, depth] as const,
  facets: (workspaceId: string) => [...entityKeys.all, 'facets', workspaceId] as const,
  timelineMarkers: (workspaceId: string) =>
    [...entityKeys.all, 'timelineMarkers', workspaceId] as const,
  workspaceRelations: (workspaceId: string) =>
    [...entityKeys.all, 'relations', workspaceId] as const,
  relations: (workspaceId: string, entityId: string) =>
    [...entityKeys.workspaceRelations(workspaceId), entityId] as const,
  workspaceBatchRelations: (workspaceId: string) =>
    [...entityKeys.all, 'batch-relations', workspaceId] as const,
  batchRelations: (workspaceId: string, ids: string[]) =>
    [...entityKeys.workspaceBatchRelations(workspaceId), ids] as const,
  workspaceTypedRelations: (workspaceId: string) =>
    [...entityKeys.all, 'typed-relations', workspaceId] as const,
  typedRelations: (workspaceId: string, entityId: string) =>
    [...entityKeys.workspaceTypedRelations(workspaceId), entityId] as const,
  workspaceDependents: (workspaceId: string) =>
    [...entityKeys.all, 'dependents', workspaceId] as const,
  dependents: (workspaceId: string, entityId: string, transitive: boolean) =>
    [...entityKeys.workspaceDependents(workspaceId), entityId, transitive] as const,
  trees: (workspaceId: string) => [...entityKeys.all, 'tree', workspaceId] as const,
  tree: (workspaceId: string, filters: Record<string, unknown>) =>
    [...entityKeys.trees(workspaceId), filters] as const,
  landscapeDiff: (workspaceId: string, from: unknown, to: unknown) =>
    [...entityKeys.all, 'landscapeDiff', workspaceId, from, to] as const
};

export const entityDetailQuery = (workspaceId: string, entityId: string) =>
  queryOptions({
    queryKey: entityKeys.detail(workspaceId, entityId),
    queryFn: () => orpcClient.entities.get({ params: { workspace: workspaceId, id: entityId } }),
    enabled: !!workspaceId && !!entityId
  });

export const entitiesQuery = (
  workspaceId: string,
  options: EntityListOptions = {},
  enabled = true
) =>
  queryOptions({
    queryKey: entityKeys.list(workspaceId, options),
    queryFn: () =>
      orpcClient.entities.list({
        params: { workspace: workspaceId },
        query: {
          ...toEntityListQuery(options),
          view: options.view,
          limit: options.limit ?? undefined,
          offset: options.offset ?? undefined
        }
      }),
    enabled: enabled && !!workspaceId
  });

export const entityJsonQuery = (workspaceId: string, entityId: string, enabled = true) =>
  queryOptions({
    queryKey: entityKeys.json(workspaceId, entityId, 1),
    queryFn: () =>
      orpcClient.entities.json({
        params: { workspace: workspaceId, id: entityId },
        query: { depth: 1 }
      }),
    enabled: enabled && !!workspaceId && !!entityId
  });

export const entityLandscapeDiffQuery = (
  workspaceId: string,
  from: EntityLandscapeDiffState | null,
  to: EntityLandscapeDiffState | null,
  enabled = true
) =>
  queryOptions({
    queryKey: entityKeys.landscapeDiff(workspaceId, from, to),
    queryFn: () =>
      orpcClient.entities.diff({
        params: { workspace: workspaceId },
        body: { from: from!, to: to! }
      }),
    enabled: enabled && !!workspaceId && !!from && !!to
  });

export const entityFacetsQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: entityKeys.facets(workspaceId),
    queryFn: () => orpcClient.entities.facets({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId
  });

export const entityTimelineMarkersQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: entityKeys.timelineMarkers(workspaceId),
    queryFn: () => orpcClient.entities.timelineMarkers({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId
  });

export const entityCountQuery = (
  workspaceId: string,
  options: EntityListOptions = {},
  enabled = true
) =>
  queryOptions({
    queryKey: entityKeys.count(workspaceId, options),
    queryFn: () =>
      orpcClient.entities.count({
        params: { workspace: workspaceId },
        query: toEntityListQuery(options)
      }),
    enabled: enabled && !!workspaceId
  });

export const entityRelationsQuery = (workspaceId: string, entityId: string) =>
  queryOptions({
    queryKey: entityKeys.relations(workspaceId, entityId),
    queryFn: () =>
      orpcClient.entities.relations({ params: { workspace: workspaceId, id: entityId } }),
    enabled: !!workspaceId && !!entityId
  });

export const entityDependentsQuery = (workspaceId: string, entityId: string, transitive: boolean) =>
  queryOptions({
    queryKey: entityKeys.dependents(workspaceId, entityId, transitive),
    queryFn: () =>
      orpcClient.entities.dependents({
        params: { workspace: workspaceId, id: entityId },
        query: { transitive: transitive ? 'true' : 'false' }
      }),
    enabled: !!workspaceId && !!entityId
  });

export const entityTreeQuery = (
  workspaceId: string,
  options: EntityListOptions = {},
  enabled = true
) =>
  queryOptions({
    queryKey: entityKeys.tree(workspaceId, options),
    queryFn: () =>
      orpcClient.entities.tree({
        params: { workspace: workspaceId },
        query: toEntityListQuery(options)
      }),
    enabled: enabled && !!workspaceId
  });

export const entityBatchRelationsQuery = (workspaceId: string, ids: string[]) =>
  queryOptions({
    queryKey: entityKeys.batchRelations(workspaceId, ids),
    queryFn: () =>
      orpcClient.entities.batchRelations({
        params: { workspace: workspaceId },
        body: { ids }
      }),
    enabled: !!workspaceId && ids.length > 0
  });

export const entitiesBySchemaQuery = (
  workspaceId: string,
  schemaId: string,
  conditions: FilterCondition[] = [],
  view: 'summary' | 'full' = 'summary',
  enabled = true
) =>
  queryOptions({
    queryKey: entityKeys.list(workspaceId, { schemaId, view, conditions }),
    queryFn: async () => {
      const page = await orpcClient.entities.list({
        params: { workspace: workspaceId },
        query: { ...toEntityListQuery({ schemaId, conditions }), view }
      });
      return page.items;
    },
    enabled: enabled && !!workspaceId && !!schemaId
  });

export const hydratedEntitiesBySchemaQuery = (
  workspaceId: string,
  schemaId: string,
  enabled = true
) =>
  queryOptions({
    queryKey: entityKeys.list(workspaceId, { schemaId, view: 'full' }),
    queryFn: async () => {
      const page = await orpcClient.entities.list({
        params: { workspace: workspaceId },
        query: { ...toEntityListQuery({ schemaId }), view: 'full' }
      });
      return page.items;
    },
    enabled: enabled && !!workspaceId && !!schemaId
  });

export const entityCountsBySchemaQuery = (
  workspaceId: string,
  schemaId: string,
  conditions: FilterCondition[] = []
) =>
  queryOptions({
    queryKey: entityKeys.count(workspaceId, { schemaId, conditions }),
    queryFn: () =>
      orpcClient.entities.count({
        params: { workspace: workspaceId },
        query: toEntityListQuery({ schemaId, conditions })
      }),
    enabled: !!workspaceId && !!schemaId
  });

export const invalidateEntityDetails = async (
  queryClient: QueryClient,
  workspaceId: string,
  entityId: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspaceId, entityId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.json(workspaceId, entityId, 1) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.relations(workspaceId, entityId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.typedRelations(workspaceId, entityId) })
  ]);
};

export const invalidateEntityQueries = async (queryClient: QueryClient, workspaceId: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceLists(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceDetails(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.counts(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.trees(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.facets(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.timelineMarkers(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceRelations(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceTypedRelations(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceBatchRelations(workspaceId) }),
    invalidateAuditQueries(queryClient, workspaceId)
  ]);
};

export const invalidateDeletedEntity = async (
  queryClient: QueryClient,
  workspaceId: string,
  entityId: string
) => {
  await Promise.all([
    invalidateEntityQueries(queryClient, workspaceId),
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceDetails(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceRelations(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceBatchRelations(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceDependents(workspaceId) }),
    queryClient.removeQueries({ queryKey: entityKeys.detail(workspaceId, entityId) }),
    queryClient.removeQueries({ queryKey: entityKeys.relations(workspaceId, entityId) })
  ]);
};

export const invalidateEntityDeletion = async (
  queryClient: QueryClient,
  workspaceId: string,
  entityId: string
) => {
  await Promise.all([
    invalidateDeletedEntity(queryClient, workspaceId, entityId),
    queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceId) }),
    invalidateNotificationQueries(queryClient, workspaceId)
  ]);
};
