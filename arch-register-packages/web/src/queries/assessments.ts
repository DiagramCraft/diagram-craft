export const assessmentKeys = {
  all: ['assessments'] as const,
  lists: () => [...assessmentKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...assessmentKeys.lists(), workspaceId] as const,
  details: () => [...assessmentKeys.all, 'detail'] as const,
  detail: (workspaceId: string, assessmentId: string) =>
    [...assessmentKeys.details(), workspaceId, assessmentId] as const
};

export const assessmentResponseKeys = {
  all: ['assessment-responses'] as const,
  lists: () => [...assessmentResponseKeys.all, 'list'] as const,
  list: (workspaceId: string, assessmentId: string) =>
    [...assessmentResponseKeys.lists(), workspaceId, assessmentId] as const
};
