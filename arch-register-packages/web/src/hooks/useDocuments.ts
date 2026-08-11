import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DocumentTemplateWrite,
  DocumentTypeWrite,
  FieldMigrations
} from '@arch-register/api-types/documentContract';
import { orpcClient } from '../lib/orpcClient';
import {
  documentBacklinksQuery,
  documentKeys as documentKeysFromQueries,
  documentListQuery,
  documentPickerQuery,
  documentPickerQueryScopes as documentPickerQueryScopesFromQueries,
  documentTemplatesQuery,
  documentTypeVersionsQuery,
  documentTypesQuery,
  getDocumentTypeMigrationRequired as getDocumentTypeMigrationRequiredFromQueries,
  invalidateDocumentTemplates,
  invalidateDocumentTypes,
  mergeDocumentPickerResults as mergeDocumentPickerResultsFromQueries,
  relatedDocumentContentQuery,
  type DocumentListOptions,
  type DocumentScope
} from '../queries/documents';

export const documentKeys = documentKeysFromQueries;
export const documentPickerQueryScopes = documentPickerQueryScopesFromQueries;
export const mergeDocumentPickerResults = mergeDocumentPickerResultsFromQueries;
export const getDocumentTypeMigrationRequired = getDocumentTypeMigrationRequiredFromQueries;
export type {
  DocumentListOptions,
  DocumentScope,
  MarkdownDocumentFields
} from '../queries/documents';

export const useDocumentTypes = (workspaceId: string, includeArchived = false) =>
  useQuery(documentTypesQuery(workspaceId, includeArchived));

export const useDocumentTypeVersions = (workspaceId: string, documentTypeId: string | null) =>
  useQuery(documentTypeVersionsQuery(workspaceId, documentTypeId));

export const useDocumentTemplates = (
  workspaceId: string,
  projectId?: string | null,
  includeArchived = false
) => useQuery(documentTemplatesQuery(workspaceId, projectId, includeArchived));

export const useRelatedDocumentContent = (workspaceId: string, entityId: string) =>
  useQuery(relatedDocumentContentQuery(workspaceId, entityId));

export const useDocumentBacklinks = (workspaceId: string, nodeId: string) =>
  useQuery(documentBacklinksQuery(workspaceId, nodeId));

export const useDocumentList = (
  workspaceId: string,
  options: DocumentListOptions = {},
  queryOptions?: { enabled?: boolean }
) => useQuery(documentListQuery(workspaceId, options, queryOptions?.enabled ?? true));

export const useDocumentPickerSearch = (
  workspaceId: string,
  options: {
    q: string;
    documentTypeId?: string;
    allowedScopes?: readonly DocumentScope[];
    limit?: number;
  },
  queryOptions?: { enabled?: boolean }
) => {
  const allowedScopes: readonly DocumentScope[] = options.allowedScopes ?? [
    'workspace',
    'project',
    'entity'
  ];
  const queryScopes = documentPickerQueryScopes(allowedScopes);
  const enabled =
    (queryOptions?.enabled ?? true) &&
    !!workspaceId &&
    !!options.q.trim() &&
    queryScopes.length > 0;

  const queries = useQueries({
    queries: queryScopes.map(scope =>
      documentPickerQuery(
        workspaceId,
        { q: options.q, scope, documentTypeId: options.documentTypeId, limit: options.limit },
        enabled
      )
    )
  });

  const documents = mergeDocumentPickerResults(
    queries.map(query => query.data ?? []),
    options.limit ?? 8
  );

  return {
    data: documents,
    isLoading: queries.some(query => query.isLoading),
    isError: queries.some(query => query.isError)
  };
};

export const useCreateDocumentType = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DocumentTypeWrite) =>
      orpcClient.documentTypes.create({ params: { workspace: workspaceId }, body }),
    onSuccess: () => invalidateDocumentTypes(queryClient, workspaceId)
  });
};

export const useUpdateDocumentType = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body
    }: {
      id: string;
      body: DocumentTypeWrite & { fieldMigrations?: FieldMigrations };
    }) => orpcClient.documentTypes.update({ params: { workspace: workspaceId, id }, body }),
    onSuccess: async (_data, variables) => {
      await invalidateDocumentTypes(queryClient, workspaceId, variables.id);
    }
  });
};

export const useArchiveDocumentType = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      orpcClient.documentTypes.archive({
        params: { workspace: workspaceId, id },
        body: { archived }
      }),
    onSuccess: () => invalidateDocumentTypes(queryClient, workspaceId)
  });
};

export const useDeleteDocumentType = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      orpcClient.documentTypes.remove({ params: { workspace: workspaceId, id } }),
    onSuccess: () => invalidateDocumentTypes(queryClient, workspaceId)
  });
};

export const useCreateDocumentTemplate = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DocumentTemplateWrite) =>
      orpcClient.documentTemplates.create({ params: { workspace: workspaceId }, body }),
    onSuccess: () => invalidateDocumentTemplates(queryClient, workspaceId)
  });
};

export const useArchiveDocumentTemplate = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      orpcClient.documentTemplates.archive({
        params: { workspace: workspaceId, id },
        body: { archived }
      }),
    onSuccess: () => invalidateDocumentTemplates(queryClient, workspaceId)
  });
};

export const useUpdateDocumentTemplate = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: DocumentTemplateWrite }) =>
      orpcClient.documentTemplates.update({ params: { workspace: workspaceId, id }, body }),
    onSuccess: () => invalidateDocumentTemplates(queryClient, workspaceId)
  });
};

export const useDeleteDocumentTemplate = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      orpcClient.documentTemplates.remove({ params: { workspace: workspaceId, id } }),
    onSuccess: () => invalidateDocumentTemplates(queryClient, workspaceId)
  });
};
