import { type QueryClient } from '@tanstack/react-query';

export const schemaKeys = {
  all: ['schemas'] as const,
  lists: () => [...schemaKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...schemaKeys.lists(), workspaceId] as const,
  details: () => [...schemaKeys.all, 'detail'] as const,
  detail: (workspaceId: string, schemaId: string) =>
    [...schemaKeys.details(), workspaceId, schemaId] as const,
};

export const entityKeys = {
  all: ['entities'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  list: (workspaceId: string, filters: Record<string, unknown>) =>
    [...entityKeys.lists(), workspaceId, filters] as const,
  count: (workspaceId: string, filters: Record<string, unknown>) =>
    [...entityKeys.all, 'count', workspaceId, filters] as const,
  details: () => [...entityKeys.all, 'detail'] as const,
  detail: (workspaceId: string, entityId: string) =>
    [...entityKeys.details(), workspaceId, entityId] as const,
  facets: (workspaceId: string) => [...entityKeys.all, 'facets', workspaceId] as const,
  timelineMarkers: (workspaceId: string) =>
    [...entityKeys.all, 'timelineMarkers', workspaceId] as const,
  relations: (workspaceId: string, entityId: string) =>
    [...entityKeys.all, 'relations', workspaceId, entityId] as const,
  batchRelations: (workspaceId: string, ids: string[]) =>
    [...entityKeys.all, 'batch-relations', workspaceId, ids] as const,
  dependents: (workspaceId: string, entityId: string, transitive: boolean) =>
    [...entityKeys.all, 'dependents', workspaceId, entityId, transitive] as const,
  tree: (workspaceId: string, filters: Record<string, unknown>) =>
    [...entityKeys.all, 'tree', workspaceId, filters] as const,
};

export const viewKeys = {
  all: ['views'] as const,
  lists: () => [...viewKeys.all, 'list'] as const,
  list: (
    workspaceId: string,
    options?: {
      projectId?: string;
      includeWorkspace?: boolean;
    }
  ) => [...viewKeys.lists(), workspaceId, options ?? {}] as const,
};

export const snapshotKeys = {
  all: ['snapshots'] as const,
  list: (workspaceId: string, entityId: string) =>
    [...snapshotKeys.all, workspaceId, entityId] as const,
  byProject: (workspaceId: string, projectId: string) =>
    [...snapshotKeys.all, 'by-project', workspaceId, projectId] as const,
};

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...projectKeys.lists(), workspaceId] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (workspaceId: string, projectId: string) =>
    [...projectKeys.details(), workspaceId, projectId] as const,
};

export const projectEntityKeys = {
  all: (workspaceId: string, projectId: string) =>
    ['project-entities', workspaceId, projectId] as const,
  entityProjects: (workspaceId: string, entityId: string) =>
    ['entity-projects', workspaceId, entityId] as const,
  entityDiagramFiles: (workspaceId: string, entityId: string) =>
    ['entity-diagram-files', workspaceId, entityId] as const,
};

export const assessmentKeys = {
  all: ['assessments'] as const,
  lists: () => [...assessmentKeys.all, 'list'] as const,
  list: (workspaceId: string, projectId: string) =>
    [...assessmentKeys.lists(), workspaceId, projectId] as const,
  details: () => [...assessmentKeys.all, 'detail'] as const,
  detail: (workspaceId: string, projectId: string, assessmentId: string) =>
    [...assessmentKeys.details(), workspaceId, projectId, assessmentId] as const,
};

export const assessmentResponseKeys = {
  all: ['assessment-responses'] as const,
  lists: () => [...assessmentResponseKeys.all, 'list'] as const,
  list: (workspaceId: string, projectId: string, assessmentId: string) =>
    [...assessmentResponseKeys.lists(), workspaceId, projectId, assessmentId] as const,
};

export const entityContentKeys = {
  all: (workspaceId: string, entityId: string) =>
    ['entity-content', workspaceId, entityId] as const,
};

export const workspaceContentKeys = {
  all: (workspaceId: string) => ['workspace-content', workspaceId] as const,
};

export const projectFileKeys = {
  all: ['project-files'] as const,
  lists: () => [...projectFileKeys.all, 'list'] as const,
  list: (workspaceId: string, projectId: string) =>
    [...projectFileKeys.lists(), workspaceId, projectId] as const,
  detail: (workspaceId: string, fileId: string) =>
    [...projectFileKeys.all, 'detail', workspaceId, fileId] as const,
  content: (workspaceId: string, fileId: string) =>
    [...projectFileKeys.all, 'content', workspaceId, fileId] as const
};

export const auditKeys = {
  all: ['audit'] as const,
  logs: () => [...auditKeys.all, 'log'] as const,
  workspaceLogs: (workspaceId: string) => [...auditKeys.logs(), workspaceId] as const,
  log: (workspaceId: string, options: Record<string, unknown>) =>
    [...auditKeys.workspaceLogs(workspaceId), options] as const,
  stats: (workspaceId: string) => [...auditKeys.all, 'stats', workspaceId] as const,
};

export const workspaceAnalyticsKeys = {
  all: ['workspace-analytics'] as const,
  workspace: (workspaceId: string) => [...workspaceAnalyticsKeys.all, workspaceId] as const,
  detail: (workspaceId: string, staleAfterDays: number) =>
    [...workspaceAnalyticsKeys.workspace(workspaceId), staleAfterDays] as const
};

// ── Domain invalidation helpers ───────────────────────────────
//
// Each helper covers all queries that may be stale after a mutation in that domain.
// Audit invalidation is bundled into the broad helpers because every mutation that
// reaches these helpers produces an audit entry.

export const invalidateAuditQueries = async (queryClient: QueryClient, workspaceId: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: auditKeys.workspaceLogs(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: auditKeys.stats(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: workspaceAnalyticsKeys.workspace(workspaceId) }),
  ]);
};

/** Refreshes the detail and relations for one specific entity. */
export const invalidateEntityDetails = async (
  queryClient: QueryClient,
  workspaceId: string,
  entityId: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspaceId, entityId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.relations(workspaceId, entityId) }),
  ]);
};

/** Refreshes all workspace-scoped entity views (lists, tree, facets) and audit. */
export const invalidateEntityQueries = async (queryClient: QueryClient, workspaceId: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: entityKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: ['entities', 'tree'] as const }),
    queryClient.invalidateQueries({ queryKey: entityKeys.facets(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: auditKeys.workspaceLogs(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: auditKeys.stats(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: workspaceAnalyticsKeys.workspace(workspaceId) }),
  ]);
};

/** Evicts all entity caches. Use for delete, where the entity no longer exists. */
export const invalidateAllEntityCaches = async (queryClient: QueryClient, workspaceId: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: entityKeys.all }),
    queryClient.invalidateQueries({ queryKey: auditKeys.workspaceLogs(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: auditKeys.stats(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: workspaceAnalyticsKeys.workspace(workspaceId) }),
  ]);
};

/** Refreshes project list and, if projectId is given, the project's files and entities. Includes audit. */
export const invalidateProjectQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  projectId?: string
) => {
  const tasks: Promise<void>[] = [
    queryClient.invalidateQueries({ queryKey: projectKeys.list(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: auditKeys.workspaceLogs(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: auditKeys.stats(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: workspaceAnalyticsKeys.workspace(workspaceId) }),
  ];
  if (projectId) {
    tasks.push(
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(workspaceId, projectId) }),
      queryClient.invalidateQueries({ queryKey: projectFileKeys.list(workspaceId, projectId) }),
      queryClient.invalidateQueries({ queryKey: projectEntityKeys.all(workspaceId, projectId) }),
    );
  }
  await Promise.all(tasks);
};

/** Evicts all project caches. Use for delete, where the project no longer exists. */
export const invalidateAllProjectCaches = async (queryClient: QueryClient, workspaceId: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: projectKeys.all }),
    queryClient.invalidateQueries({ queryKey: auditKeys.workspaceLogs(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: auditKeys.stats(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: workspaceAnalyticsKeys.workspace(workspaceId) }),
  ]);
};

/** Refreshes snapshot queries for an entity and optionally a project timeline. Includes audit. */
export const invalidateSnapshotQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  entityId: string,
  projectId?: string | null
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: snapshotKeys.list(workspaceId, entityId) }),
    queryClient.invalidateQueries({ queryKey: auditKeys.workspaceLogs(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: auditKeys.stats(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: workspaceAnalyticsKeys.workspace(workspaceId) }),
    ...(projectId
      ? [queryClient.invalidateQueries({ queryKey: snapshotKeys.byProject(workspaceId, projectId) })]
      : []),
  ]);
};
