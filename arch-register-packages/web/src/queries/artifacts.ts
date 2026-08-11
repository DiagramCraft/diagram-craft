import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { ApiSpecificationProjectionQuery } from '@arch-register/api-types/artifactContract';
import { orpcClient } from '../lib/orpcClient';

export const artifactKeys = {
  all: ['artifacts'] as const,
  workspaceEntities: (workspaceId: string) => [...artifactKeys.all, workspaceId] as const,
  entity: (workspaceId: string, entityId: string) =>
    [...artifactKeys.workspaceEntities(workspaceId), entityId] as const,
  apiSpecificationRevisions: (workspaceId: string, entityId: string, artifactId: string) =>
    [
      ...artifactKeys.entity(workspaceId, entityId),
      'api-specification-revisions',
      artifactId
    ] as const,
  apiSpecification: (
    workspaceId: string,
    entityId: string,
    artifactId: string,
    revisionId: string,
    query: Record<string, unknown>
  ) =>
    [
      ...artifactKeys.entity(workspaceId, entityId),
      'api-specification',
      artifactId,
      revisionId,
      query
    ] as const,
  revisionContent: (
    workspaceId: string,
    entityId: string,
    artifactId: string,
    revisionId: string
  ) =>
    [
      ...artifactKeys.entity(workspaceId, entityId),
      'revision-content',
      artifactId,
      revisionId
    ] as const
};

export type ApiSpecificationFilters = Pick<
  ApiSpecificationProjectionQuery,
  'q' | 'resource' | 'action' | 'kind' | 'tag' | 'deprecated'
> & {
  limit: number;
  offset: number;
};

export const entityArtifactsQuery = (workspaceId: string, entityId: string, enabled = true) =>
  queryOptions({
    queryKey: artifactKeys.entity(workspaceId, entityId),
    queryFn: () => orpcClient.artifacts.list({ params: { workspace: workspaceId, entityId } }),
    enabled: enabled && !!workspaceId && !!entityId,
    refetchInterval: query =>
      query.state.data?.artifacts.some(artifact => artifact.status === 'pending') ? 2_000 : false
  });

export const apiSpecificationRevisionListQuery = (
  workspaceId: string,
  entityId: string,
  artifactId: string,
  enabled = true
) =>
  queryOptions({
    queryKey: artifactKeys.apiSpecificationRevisions(workspaceId, entityId, artifactId),
    queryFn: () =>
      orpcClient.artifacts.listApiSpecificationRevisions({
        params: { workspace: workspaceId, entityId, artifactId }
      }),
    enabled: enabled && !!workspaceId && !!entityId && !!artifactId
  });

export const apiSpecificationQuery = (
  workspaceId: string,
  entityId: string,
  artifactId: string,
  revisionId: string,
  query: ApiSpecificationFilters,
  enabled = true
) =>
  queryOptions({
    queryKey: artifactKeys.apiSpecification(workspaceId, entityId, artifactId, revisionId, query),
    queryFn: () =>
      orpcClient.artifacts.listApiSpecification({
        params: { workspace: workspaceId, entityId, artifactId, revisionId },
        query
      }),
    enabled: enabled && !!workspaceId && !!entityId && !!artifactId && !!revisionId
  });

export const artifactRevisionContentQuery = (
  workspaceId: string,
  entityId: string,
  artifactId: string,
  revisionId: string,
  enabled = true
) =>
  queryOptions({
    queryKey: artifactKeys.revisionContent(workspaceId, entityId, artifactId, revisionId),
    queryFn: () =>
      orpcClient.artifacts.getRevisionContent({
        params: { workspace: workspaceId, entityId, artifactId, revisionId }
      }),
    enabled: enabled && !!workspaceId && !!entityId && !!artifactId && !!revisionId
  });

export const invalidateArtifactEntity = (
  queryClient: QueryClient,
  workspaceId: string,
  entityId: string
) => queryClient.invalidateQueries({ queryKey: artifactKeys.entity(workspaceId, entityId) });
