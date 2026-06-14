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
  details: () => [...entityKeys.all, 'detail'] as const,
  detail: (workspaceId: string, entityId: string) =>
    [...entityKeys.details(), workspaceId, entityId] as const,
  facets: (workspaceId: string) => [...entityKeys.all, 'facets', workspaceId] as const,
  relations: (workspaceId: string, entityId: string) =>
    [...entityKeys.all, 'relations', workspaceId, entityId] as const,
  tree: (workspaceId: string, filters: Record<string, unknown>) =>
    [...entityKeys.all, 'tree', workspaceId, filters] as const,
};

export const viewKeys = {
  all: ['views'] as const,
  lists: () => [...viewKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...viewKeys.lists(), workspaceId] as const,
};

export const snapshotKeys = {
  all: ['snapshots'] as const,
  list: (workspaceId: string, entityId: string) =>
    [...snapshotKeys.all, workspaceId, entityId] as const,
  byProject: (workspaceId: string, projectId: string) =>
    [...snapshotKeys.all, 'by-project', workspaceId, projectId] as const,
};
