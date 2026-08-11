export const schemaKeys = {
  all: ['schemas'] as const,
  lists: () => [...schemaKeys.all, 'list'] as const,
  workspaceLists: (workspaceId: string) => [...schemaKeys.lists(), workspaceId] as const,
  list: (workspaceId: string) => schemaKeys.workspaceLists(workspaceId),
  details: () => [...schemaKeys.all, 'detail'] as const,
  workspaceDetails: (workspaceId: string) => [...schemaKeys.details(), workspaceId] as const,
  detail: (workspaceId: string, schemaId: string) =>
    [...schemaKeys.workspaceDetails(workspaceId), schemaId] as const,
  versions: (workspaceId: string, schemaId: string) =>
    [...schemaKeys.detail(workspaceId, schemaId), 'versions'] as const
};
