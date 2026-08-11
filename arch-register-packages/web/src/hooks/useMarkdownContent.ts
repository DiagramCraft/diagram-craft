import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import type { DocumentMetadata } from '@arch-register/api-types/documentContract';
import { invalidateContentScope, type ContentScope } from '../queries/content';
import {
  invalidateMarkdownNode,
  markdownContentKeys as markdownContentKeysFromQueries,
  markdownContentQuery,
  markdownRevisionQuery,
  markdownRevisionsQuery,
  markdownWorkflowHistoryQuery
} from '../queries/markdownContent';

export const markdownContentKeys = markdownContentKeysFromQueries;
export type { ContentScope } from '../queries/content';

export const useMarkdownContent = (workspaceId: string, nodeId: string) => {
  return useQuery(markdownContentQuery(workspaceId, nodeId));
};

export const useSaveMarkdownContent = (scope: ContentScope, nodeId: string) => {
  const queryClient = useQueryClient();
  const { workspaceId } = scope;
  return useMutation({
    mutationFn: ({
      body,
      name,
      document_type_id,
      metadata,
      change_kind,
      initiation_fields
    }: {
      body: string;
      name?: string;
      document_type_id?: string | null;
      metadata?: DocumentMetadata;
      change_kind?: 'minor' | 'major';
      initiation_fields?: Record<string, unknown>;
    }) =>
      orpcClient.projects.saveMarkdownContent({
        params: { workspace: workspaceId, nodeId },
        body: { body, name, document_type_id, metadata, change_kind, initiation_fields }
      }),
    onSuccess: () => invalidateMarkdownNode(queryClient, scope, nodeId)
  });
};

export const useMigrateMarkdownContent = (scope: ContentScope, nodeId: string) => {
  const queryClient = useQueryClient();
  const { workspaceId } = scope;
  return useMutation({
    mutationFn: (input: {
      body: string;
      name?: string;
      document_type_id: string | null;
      metadata: DocumentMetadata;
      change_kind?: 'minor' | 'major';
      initiation_fields?: Record<string, unknown>;
    }) =>
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
    mutationFn: (input: {
      name: string;
      folder?: string;
      body: string;
      document_type_id?: string | null;
      metadata: DocumentMetadata;
    }) =>
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

export const useMarkdownRevisions = (workspaceId: string, nodeId: string) =>
  useQuery(markdownRevisionsQuery(workspaceId, nodeId));

export const useMarkdownRevision = (
  workspaceId: string,
  nodeId: string,
  revisionId: string | undefined
) => useQuery(markdownRevisionQuery(workspaceId, nodeId, revisionId));

export const useRestoreMarkdownRevision = (scope: ContentScope, nodeId: string) => {
  const queryClient = useQueryClient();
  const { workspaceId } = scope;
  return useMutation({
    mutationFn: (input: {
      revisionId: string;
      change_kind?: 'minor' | 'major';
      initiation_fields?: Record<string, unknown>;
    }) =>
      orpcClient.projects.restoreMarkdownRevision({
        params: { workspace: workspaceId, nodeId, revisionId: input.revisionId },
        body: {
          change_kind: input.change_kind ?? 'major',
          initiation_fields: input.initiation_fields
        }
      }),
    onSuccess: () => invalidateMarkdownNode(queryClient, scope, nodeId)
  });
};

export const useMarkdownWorkflowHistory = (workspaceId: string, nodeId: string) =>
  useQuery(markdownWorkflowHistoryQuery(workspaceId, nodeId));
