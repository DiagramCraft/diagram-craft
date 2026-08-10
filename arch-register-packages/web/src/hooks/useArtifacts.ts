import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiSpecificationProjectionQuery,
  Artifact,
  ArtifactSourceKind,
  ArtifactStatus
} from '@arch-register/api-types/artifactContract';
import { artifactKeys } from '../queries/artifacts';
import { orpcClient } from '../lib/orpcClient';

export type ApiSpecificationFilters = Pick<
  ApiSpecificationProjectionQuery,
  'q' | 'resource' | 'action' | 'kind' | 'tag' | 'deprecated'
> & {
  limit: number;
  offset: number;
};

export const selectApiSpecificationArtifacts = (artifacts: Artifact[]) =>
  [...artifacts]
    .filter(artifact => artifact.artifactType === 'api-specification')
    .sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) ||
        Number(Boolean(right.currentRevisionId)) - Number(Boolean(left.currentRevisionId)) ||
        right.id.localeCompare(left.id)
    );

export const selectApiSpecificationArtifact = (artifacts: Artifact[]) =>
  selectApiSpecificationArtifacts(artifacts)[0];

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
  useQuery({
    queryKey: artifactKeys.entity(workspaceId, entityId),
    queryFn: () =>
      orpcClient.artifacts.list({
        params: { workspace: workspaceId, entityId }
      }),
    enabled: enabled && !!workspaceId && !!entityId,
    refetchInterval: query =>
      query.state.data?.artifacts.some(artifact => artifact.status === 'pending') ? 2_000 : false
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: artifactKeys.entity(workspaceId, entityId)
      });
    }
  });
};

export const useRefreshApiSpecification = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (artifactId: string) =>
      orpcClient.artifacts.refresh({
        params: { workspace: workspaceId, entityId, artifactId }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: artifactKeys.entity(workspaceId, entityId)
      });
    }
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: artifactKeys.entity(workspaceId, entityId)
      });
    }
  });
};

export const useApiSpecificationProjection = (
  workspaceId: string,
  entityId: string,
  artifactId: string,
  revisionId: string,
  query: ApiSpecificationFilters,
  enabled = true
) =>
  useQuery({
    queryKey: artifactKeys.apiSpecification(workspaceId, entityId, artifactId, revisionId, query),
    queryFn: () =>
      orpcClient.artifacts.listApiSpecification({
        params: { workspace: workspaceId, entityId, artifactId, revisionId },
        query
      }),
    enabled: enabled && !!workspaceId && !!entityId && !!artifactId && !!revisionId
  });

export const useArtifactRevisionContent = (
  workspaceId: string,
  entityId: string,
  artifactId: string,
  revisionId: string,
  enabled = true
) =>
  useQuery({
    queryKey: artifactKeys.revisionContent(workspaceId, entityId, artifactId, revisionId),
    queryFn: () =>
      orpcClient.artifacts.getRevisionContent({
        params: { workspace: workspaceId, entityId, artifactId, revisionId }
      }),
    enabled: enabled && !!workspaceId && !!entityId && !!artifactId && !!revisionId
  });
