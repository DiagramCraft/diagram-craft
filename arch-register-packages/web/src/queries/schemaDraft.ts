import type { SnapshotVersionKind } from '@arch-register/api-types/schemaDraftContract';
import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const schemaDraftKeys = {
  all: ['schema-draft'] as const,
  draft: (workspaceId: string) => [...schemaDraftKeys.all, 'draft', workspaceId] as const,
  mode: (workspaceId: string) => [...schemaDraftKeys.all, 'mode', workspaceId] as const,
  publications: (workspaceId: string) =>
    [...schemaDraftKeys.all, 'publications', workspaceId] as const,
  snapshotVersions: (workspaceId: string, kind: string, itemId: string) =>
    [...schemaDraftKeys.all, 'snapshot-versions', workspaceId, kind, itemId] as const
};

export const schemaDraftQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: schemaDraftKeys.draft(workspaceId),
    queryFn: () => orpcClient.schemaDraft.get({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId
  });

export const schemaChangeModeQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: schemaDraftKeys.mode(workspaceId),
    queryFn: () => orpcClient.schemaDraft.getMode({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId
  });

export const schemaPublicationsQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: schemaDraftKeys.publications(workspaceId),
    queryFn: () => orpcClient.schemaPublication.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId
  });

export const snapshotVersionsQuery = (
  workspaceId: string,
  kind: SnapshotVersionKind,
  itemId: string,
  enabled = true
) =>
  queryOptions({
    queryKey: schemaDraftKeys.snapshotVersions(workspaceId, kind, itemId),
    queryFn: () =>
      orpcClient.schemaSnapshotVersion.list({ params: { workspace: workspaceId, kind, itemId } }),
    enabled: enabled && !!workspaceId && !!itemId
  });

export const invalidateSchemaDraftQueries = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: schemaDraftKeys.draft(workspaceId) });
