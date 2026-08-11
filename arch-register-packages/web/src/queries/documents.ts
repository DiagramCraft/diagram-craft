import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type {
  DocumentMetadata,
  DocumentTemplateWrite,
  DocumentType,
  DocumentTypeMigrationRequiredError,
  DocumentTypeWrite,
  FieldMigrations
} from '@arch-register/api-types/documentContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { orpcClient } from '../lib/orpcClient';
import { normalizeApiError } from '../lib/http';

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

export type DocumentScope = 'workspace' | 'project' | 'entity';
const DOCUMENT_SCOPES: readonly DocumentScope[] = ['workspace', 'project', 'entity'];

export const documentPickerQueryScopes = (
  allowedScopes: readonly DocumentScope[] = DOCUMENT_SCOPES
): Array<DocumentScope | undefined> => {
  const uniqueScopes = [...new Set(allowedScopes)];
  return uniqueScopes.length === DOCUMENT_SCOPES.length ? [undefined] : uniqueScopes;
};

export const mergeDocumentPickerResults = <T extends { file: { id: string } }>(
  results: readonly (readonly T[])[],
  limit = 8
): T[] =>
  results
    .flat()
    .filter(
      (document, index, all) => all.findIndex(item => item.file.id === document.file.id) === index
    )
    .slice(0, limit);

export const documentKeys = {
  typesRoot: (workspaceId: string) => ['document-types', workspaceId] as const,
  types: (workspaceId: string, includeArchived = false) =>
    ['document-types', workspaceId, includeArchived] as const,
  versions: (workspaceId: string, documentTypeId: string) =>
    ['document-types', workspaceId, documentTypeId, 'versions'] as const,
  templatesRoot: (workspaceId: string) => ['document-templates', workspaceId] as const,
  templates: (workspaceId: string, projectId?: string | null, includeArchived = false) =>
    ['document-templates', workspaceId, projectId ?? 'workspace', includeArchived] as const,
  related: (workspaceId: string, entityId: string) =>
    ['related-content', workspaceId, entityId] as const,
  backlinks: (workspaceId: string, nodeId: string) =>
    ['document-backlinks', workspaceId, nodeId] as const,
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

export const documentTypeVersionsQuery = (workspaceId: string, documentTypeId: string | null) =>
  queryOptions({
    queryKey: documentKeys.versions(workspaceId, documentTypeId ?? ''),
    queryFn: () =>
      orpcClient.documentTypes.listVersions({
        params: { workspace: workspaceId, id: documentTypeId! }
      }),
    enabled: !!workspaceId && !!documentTypeId
  });

export const relatedDocumentContentQuery = (workspaceId: string, entityId: string) =>
  queryOptions({
    queryKey: documentKeys.related(workspaceId, entityId),
    queryFn: () =>
      orpcClient.projects.listRelatedContent({ params: { workspace: workspaceId, entityId } }),
    enabled: !!workspaceId && !!entityId
  });

export const documentBacklinksQuery = (workspaceId: string, nodeId: string) =>
  queryOptions({
    queryKey: documentKeys.backlinks(workspaceId, nodeId),
    queryFn: () =>
      orpcClient.projects.listDocumentBacklinks({ params: { workspace: workspaceId, nodeId } }),
    enabled: !!workspaceId && !!nodeId
  });

export const documentListQuery = (
  workspaceId: string,
  options: DocumentListOptions = {},
  enabled = true
) =>
  queryOptions({
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
    enabled: enabled && !!workspaceId,
    staleTime: 2 * 60 * 1000
  });

export const documentPickerQuery = (
  workspaceId: string,
  options: { q: string; scope?: DocumentScope; documentTypeId?: string; limit?: number },
  enabled: boolean
) =>
  documentListQuery(
    workspaceId,
    {
      q: options.q,
      scope: options.scope,
      documentTypeId: options.documentTypeId,
      limit: options.limit
    },
    enabled
  );

export const invalidateDocumentTypes = async (
  queryClient: QueryClient,
  workspaceId: string,
  documentTypeId?: string
) => {
  await queryClient.invalidateQueries({ queryKey: documentKeys.typesRoot(workspaceId) });
  if (documentTypeId) {
    await queryClient.invalidateQueries({
      queryKey: documentKeys.versions(workspaceId, documentTypeId)
    });
  }
};

export const invalidateDocumentTemplates = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: documentKeys.templatesRoot(workspaceId) });

export const getDocumentTypeMigrationRequired = (
  error: unknown
): DocumentTypeMigrationRequiredError | null => {
  const apiError = normalizeApiError(error);
  const data = apiError.data as { code?: string } | undefined;
  return data?.code === 'DOCUMENT_TYPE_MIGRATION_REQUIRED'
    ? (data as DocumentTypeMigrationRequiredError)
    : null;
};

export type DocumentMutationInput =
  | DocumentTypeWrite
  | DocumentTemplateWrite
  | FieldMigrations
  | DocumentMetadata;

export type MarkdownDocumentFields = Pick<DocumentType, 'fields'> & {
  document_type_id: string | null;
  metadata: DocumentMetadata;
  available_fields: DocumentType['fields'];
  retired_fields: DocumentType['fields'];
};
