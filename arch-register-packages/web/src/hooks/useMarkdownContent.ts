import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MarkdownContent,
  MarkdownRevisionDetail,
  MarkdownRevisionSummary
} from '@arch-register/api-types/projectContract';
import { orpcClient } from '../lib/orpcClient';
import { invalidateContentScope, type ContentScope } from './useContentScope';
import type { DocumentMetadata } from '@arch-register/api-types/documentContract';

export const markdownContentKeys = {
  detail: (workspaceId: string, nodeId: string) =>
    ['markdown-content', workspaceId, nodeId] as const,
  revisions: (workspaceId: string, nodeId: string) =>
    ['markdown-content', workspaceId, nodeId, 'revisions'] as const,
  revision: (workspaceId: string, nodeId: string, revisionId: string) =>
    ['markdown-content', workspaceId, nodeId, 'revisions', revisionId] as const
};

export const useMarkdownContent = (workspaceId: string, nodeId: string) => {
  return useQuery<MarkdownContent>({
    queryKey: markdownContentKeys.detail(workspaceId, nodeId),
    queryFn: () =>
      orpcClient.projects.getMarkdownContent({ params: { workspace: workspaceId, nodeId } }),
    enabled: !!workspaceId && !!nodeId
  });
};

// Refreshes markdown content/revisions plus whichever content area the node lives in.
const invalidateMarkdownNode = async (
  queryClient: ReturnType<typeof useQueryClient>,
  scope: ContentScope,
  nodeId: string
) => {
  const { workspaceId } = scope;
  await queryClient.invalidateQueries({
    queryKey: markdownContentKeys.detail(workspaceId, nodeId)
  });
  await queryClient.invalidateQueries({
    queryKey: markdownContentKeys.revisions(workspaceId, nodeId)
  });
  await invalidateContentScope(queryClient, scope);
};

export const useSaveMarkdownContent = (scope: ContentScope, nodeId: string) => {
  const queryClient = useQueryClient();
  const { workspaceId } = scope;
  return useMutation({
    mutationFn: ({ body, name, document_type_id, metadata }: { body: string; name?: string; document_type_id?: string | null; metadata?: DocumentMetadata }) =>
      orpcClient.projects.saveMarkdownContent({
        params: { workspace: workspaceId, nodeId },
        body: { body, name, document_type_id, metadata }
      }),
    onSuccess: () => invalidateMarkdownNode(queryClient, scope, nodeId)
  });
};

export const useMigrateMarkdownContent = (scope: ContentScope, nodeId: string) => {
  const queryClient = useQueryClient();
  const { workspaceId } = scope;
  return useMutation({
    mutationFn: (input: { body: string; name?: string; document_type_id: string | null; metadata: DocumentMetadata }) =>
      orpcClient.projects.migrateMarkdownContent({
        params: { workspace: workspaceId, nodeId },
        body: input
      }),
    onSuccess: () => invalidateMarkdownNode(queryClient, scope, nodeId)
  });
};

export const useSaveNewMarkdownContent = (scope: ContentScope) => {
  const queryClient = useQueryClient();
  const { workspaceId } = scope;
  return useMutation({
    mutationFn: (input: { name: string; folder?: string; body: string; document_type_id?: string | null; metadata: DocumentMetadata }) =>
      orpcClient.projects.saveNewMarkdownContent({
        params: { workspace: workspaceId },
        body: {
          ...input,
          scope: scope.kind,
          ...(scope.kind === 'project' ? { project_id: scope.projectId } : {}),
          ...(scope.kind === 'entity' ? { entity_id: scope.entityId } : {})
        }
      }),
    onSuccess: () => invalidateContentScope(queryClient, scope)
  });
};

export const useMarkdownRevisions = (workspaceId: string, nodeId: string) => {
  return useQuery<MarkdownRevisionSummary[]>({
    queryKey: markdownContentKeys.revisions(workspaceId, nodeId),
    queryFn: () =>
      orpcClient.projects.listMarkdownRevisions({ params: { workspace: workspaceId, nodeId } }),
    enabled: !!workspaceId && !!nodeId
  });
};

export const useMarkdownRevision = (
  workspaceId: string,
  nodeId: string,
  revisionId: string | undefined
) => {
  return useQuery<MarkdownRevisionDetail>({
    queryKey: markdownContentKeys.revision(workspaceId, nodeId, revisionId ?? ''),
    queryFn: () =>
      orpcClient.projects.getMarkdownRevision({
        params: { workspace: workspaceId, nodeId, revisionId: revisionId ?? '' }
      }),
    enabled: !!workspaceId && !!nodeId && !!revisionId
  });
};

export const useRestoreMarkdownRevision = (scope: ContentScope, nodeId: string) => {
  const queryClient = useQueryClient();
  const { workspaceId } = scope;
  return useMutation({
    mutationFn: (revisionId: string) =>
      orpcClient.projects.restoreMarkdownRevision({
        params: { workspace: workspaceId, nodeId, revisionId }
      }),
    onSuccess: () => invalidateMarkdownNode(queryClient, scope, nodeId)
  });
};
