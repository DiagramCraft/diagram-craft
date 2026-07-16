import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DocumentMetadata,
  DocumentTemplateWrite,
  DocumentType,
  DocumentTypeWrite
} from '@arch-register/api-types/documentContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { orpcClient } from '../lib/orpcClient';

export type DocumentListOptions = {
  q?: string;
  scope?: 'workspace' | 'project' | 'entity';
  projectId?: string;
  entityId?: string;
  documentTypeId?: string;
  conditions?: FilterCondition[];
  sort?: string;
  sortDir?: 'asc' | 'desc';
  limit?: number;
};

export const documentKeys = {
  typesRoot: (workspaceId: string) => ['document-types', workspaceId] as const,
  types: (workspaceId: string, includeArchived = false) =>
    ['document-types', workspaceId, includeArchived] as const,
  templatesRoot: (workspaceId: string) => ['document-templates', workspaceId] as const,
  templates: (workspaceId: string, projectId?: string | null, includeArchived = false) =>
    ['document-templates', workspaceId, projectId ?? 'workspace', includeArchived] as const,
  related: (workspaceId: string, entityId: string) =>
    ['related-content', workspaceId, entityId] as const,
  list: (workspaceId: string, options: DocumentListOptions = {}) =>
    ['documents', workspaceId, options] as const
};

export const documentTypesQuery = (workspaceId: string, includeArchived = false) =>
  queryOptions({
    queryKey: documentKeys.types(workspaceId, includeArchived),
    queryFn: () =>
      orpcClient.documentTypes.list({
        params: { workspace: workspaceId },
        query: { include_archived: includeArchived }
      }),
    enabled: !!workspaceId
  });

export const documentTemplatesQuery = (
  workspaceId: string,
  projectId?: string | null,
  includeArchived = false
) =>
  queryOptions({
    queryKey: documentKeys.templates(workspaceId, projectId, includeArchived),
    queryFn: () =>
      orpcClient.documentTemplates.list({
        params: { workspace: workspaceId },
        query: { project_id: projectId, include_archived: includeArchived }
      }),
    enabled: !!workspaceId
  });

export const useDocumentTypes = (workspaceId: string, includeArchived = false) =>
  useQuery(documentTypesQuery(workspaceId, includeArchived));

export const useDocumentTemplates = (
  workspaceId: string,
  projectId?: string | null,
  includeArchived = false
) => useQuery(documentTemplatesQuery(workspaceId, projectId, includeArchived));

export const useRelatedDocumentContent = (workspaceId: string, entityId: string) =>
  useQuery({
    queryKey: documentKeys.related(workspaceId, entityId),
    queryFn: () =>
      orpcClient.projects.listRelatedContent({ params: { workspace: workspaceId, entityId } }),
    enabled: !!workspaceId && !!entityId
  });

export const useDocumentList = (
  workspaceId: string,
  options: DocumentListOptions = {},
  queryOptions?: { enabled?: boolean }
) =>
  useQuery({
    queryKey: documentKeys.list(workspaceId, options),
    queryFn: () =>
      orpcClient.projects.listDocuments({
        params: { workspace: workspaceId },
        query: {
          q: options.q,
          scope: options.scope,
          project_id: options.projectId,
          entity_id: options.entityId,
          document_type_id: options.documentTypeId,
          conditions: options.conditions,
          sort: options.sort,
          sort_dir: options.sortDir,
          limit: options.limit
        }
      }),
    enabled: queryOptions?.enabled ?? !!workspaceId
  });

export const useCreateDocumentType = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DocumentTypeWrite) =>
      orpcClient.documentTypes.create({ params: { workspace: workspaceId }, body }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: documentKeys.typesRoot(workspaceId) })
  });
};

export const useUpdateDocumentType = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: DocumentTypeWrite }) =>
      orpcClient.documentTypes.update({ params: { workspace: workspaceId, id }, body }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: documentKeys.typesRoot(workspaceId) })
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: documentKeys.typesRoot(workspaceId) })
  });
};

export const useDeleteDocumentType = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      orpcClient.documentTypes.remove({ params: { workspace: workspaceId, id } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: documentKeys.typesRoot(workspaceId) })
  });
};

export const useCreateDocumentTemplate = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DocumentTemplateWrite) =>
      orpcClient.documentTemplates.create({ params: { workspace: workspaceId }, body }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: documentKeys.templatesRoot(workspaceId) })
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: documentKeys.templatesRoot(workspaceId) })
  });
};

export const useUpdateDocumentTemplate = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: DocumentTemplateWrite }) =>
      orpcClient.documentTemplates.update({ params: { workspace: workspaceId, id }, body }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: documentKeys.templatesRoot(workspaceId) })
  });
};

export const useDeleteDocumentTemplate = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      orpcClient.documentTemplates.remove({ params: { workspace: workspaceId, id } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: documentKeys.templatesRoot(workspaceId) })
  });
};

export type MarkdownDocumentFields = Pick<DocumentType, 'fields'> & {
  document_type_id: string | null;
  metadata: DocumentMetadata;
  available_fields: DocumentType['fields'];
  retired_fields: DocumentType['fields'];
};
