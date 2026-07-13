export const assessmentKeys = {
  all: ['assessments'] as const,
  lists: () => [...assessmentKeys.all, 'list'] as const,
  list: (workspaceId: string, projectId: string) =>
    [...assessmentKeys.lists(), workspaceId, projectId] as const,
  details: () => [...assessmentKeys.all, 'detail'] as const,
  detail: (workspaceId: string, projectId: string, assessmentId: string) =>
    [...assessmentKeys.details(), workspaceId, projectId, assessmentId] as const
};

export const assessmentResponseKeys = {
  all: ['assessment-responses'] as const,
  lists: () => [...assessmentResponseKeys.all, 'list'] as const,
  list: (workspaceId: string, projectId: string, assessmentId: string) =>
    [...assessmentResponseKeys.lists(), workspaceId, projectId, assessmentId] as const
};
