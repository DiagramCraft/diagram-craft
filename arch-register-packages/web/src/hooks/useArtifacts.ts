import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiSpecificationRevision,
  Artifact,
  ArtifactSourceKind,
  ArtifactStatus
} from '@arch-register/api-types/artifactContract';
import {
  apiSpecificationQuery,
  apiSpecificationRevisionListQuery,
  artifactRevisionContentQuery,
  entityArtifactsQuery,
  invalidateArtifactEntity,
  type ApiSpecificationFilters
} from '../queries/artifacts';
import { orpcClient } from '../lib/orpcClient';

export type { ApiSpecificationFilters } from '../queries/artifacts';

export const selectApiSpecificationArtifacts = (artifacts: Artifact[]) =>
  [...artifacts]
    .filter(artifact => artifact.artifactType === 'api-specification')
    .sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) || right.id.localeCompare(left.id)
    );

export type ApiSpecificationSourceState = {
  artifact: Artifact;
  revisions: ApiSpecificationRevision[];
};

export const resolveApiSpecificationSelection = (
  sources: ApiSpecificationSourceState[],
  selectedArtifactId?: string,
  selectedRevisionId?: string
) => {
  const selectedSource = selectedArtifactId
    ? sources.find(source => source.artifact.id === selectedArtifactId)
    : selectedRevisionId
      ? sources.find(source =>
          source.revisions.some(revision => revision.revision.id === selectedRevisionId)
        )
      : sources.length === 1
        ? sources[0]
        : undefined;

  if (!selectedSource) return { artifact: undefined, revision: undefined };

  const revision = selectedRevisionId
    ? selectedSource.revisions.find(candidate => candidate.revision.id === selectedRevisionId)
    : selectedSource.revisions.find(candidate => candidate.isCurrent);

  return { artifact: selectedSource.artifact, revision };
};

export const getArtifactStatusLabel = (status: ArtifactStatus) => {
  switch (status) {
    case 'not_configured':
      return 'Not configured';
    case 'link_only':
      return 'Link only';
    case 'pending':
      return 'Pending';
    case 'current':
      return 'Current';
    case 'stale':
      return 'Stale';
    case 'failed':
      return 'Failed';
    case 'invalid':
      return 'Invalid';
    case 'unsupported':
      return 'Unsupported';
  }
};

export const useEntityArtifacts = (workspaceId: string, entityId: string, enabled = true) =>
  useQuery(entityArtifactsQuery(workspaceId, entityId, enabled));

export const useApiSpecificationRevisionLists = (
  workspaceId: string,
  entityId: string,
  artifactIds: string[],
  enabled = true
) =>
  useQueries({
    queries: artifactIds.map(artifactId =>
      apiSpecificationRevisionListQuery(workspaceId, entityId, artifactId, enabled)
    )
  });

export type ApiSpecificationSourceInput = {
  kind: Extract<ArtifactSourceKind, 'link' | 'url'>;
  location: string;
};

export const useCreateApiSpecificationSource = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ kind, location }: ApiSpecificationSourceInput) =>
      orpcClient.artifacts.create({
        params: { workspace: workspaceId, entityId },
        body: {
          artifactType: 'api-specification',
          kind,
          location
        }
      }),
    onSuccess: async () => invalidateArtifactEntity(queryClient, workspaceId, entityId)
  });
};

export const useRefreshApiSpecification = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (artifactId: string) =>
      orpcClient.artifacts.refresh({
        params: { workspace: workspaceId, entityId, artifactId }
      }),
    onSuccess: async () => invalidateArtifactEntity(queryClient, workspaceId, entityId)
  });
};

export type UploadApiSpecificationInput = {
  content: string;
  mediaType: string;
  sourceRevision: string;
};

export const useUploadApiSpecification = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, mediaType, sourceRevision }: UploadApiSpecificationInput) => {
      const artifact = await orpcClient.artifacts.create({
        params: { workspace: workspaceId, entityId },
        body: {
          artifactType: 'api-specification',
          kind: 'document',
          mediaType
        }
      });
      const revision = await orpcClient.artifacts.createRevision({
        params: { workspace: workspaceId, entityId, artifactId: artifact.id },
        body: { content, mediaType, sourceRevision }
      });
      return { artifact, revision };
    },
    onSuccess: async () => invalidateArtifactEntity(queryClient, workspaceId, entityId)
  });
};

export const useApiSpecificationProjection = (
  workspaceId: string,
  entityId: string,
  artifactId: string,
  revisionId: string,
  query: ApiSpecificationFilters,
  enabled = true
) => useQuery(apiSpecificationQuery(workspaceId, entityId, artifactId, revisionId, query, enabled));

export const useArtifactRevisionContent = (
  workspaceId: string,
  entityId: string,
  artifactId: string,
  revisionId: string,
  enabled = true
) => useQuery(artifactRevisionContentQuery(workspaceId, entityId, artifactId, revisionId, enabled));
