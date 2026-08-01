export const relationKeys = {
  all: ['relations'] as const,
  lists: () => [...relationKeys.all, 'list'] as const,
  list: (workspaceId: string, filters: Record<string, unknown>) =>
    [...relationKeys.lists(), workspaceId, filters] as const,
  details: () => [...relationKeys.all, 'detail'] as const,
  workspaceDetails: (workspaceId: string) => [...relationKeys.details(), workspaceId] as const,
  detail: (workspaceId: string, relationId: string) =>
    [...relationKeys.workspaceDetails(workspaceId), relationId] as const
};
