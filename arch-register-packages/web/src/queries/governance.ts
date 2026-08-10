import type { QueryClient } from '@tanstack/react-query';
import type {
  ListGovernanceSubmissionsQuery,
  ListGovernanceTasksQuery
} from '@arch-register/api-types/governanceContract';

export const governanceKeys = {
  all: ['governance'] as const,
  tasks: (workspaceId: string, query: ListGovernanceTasksQuery = {}) =>
    [...governanceKeys.all, 'tasks', workspaceId, query] as const,
  tasksWorkspace: (workspaceId: string) => [...governanceKeys.all, 'tasks', workspaceId] as const,
  count: (workspaceId: string) => [...governanceKeys.all, 'count', workspaceId] as const,
  submissions: (workspaceId: string, query: ListGovernanceSubmissionsQuery = {}) =>
    [...governanceKeys.all, 'submissions', workspaceId, query] as const,
  submissionsWorkspace: (workspaceId: string) =>
    [...governanceKeys.all, 'submissions', workspaceId] as const,
  events: (workspaceId: string, caseId: string) =>
    [...governanceKeys.all, 'events', workspaceId, caseId] as const,
  eventsWorkspace: (workspaceId: string) => [...governanceKeys.all, 'events', workspaceId] as const
};

export const invalidateGovernanceQueries = async (
  queryClient: QueryClient,
  workspaceId: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: governanceKeys.tasksWorkspace(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: governanceKeys.count(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: governanceKeys.submissionsWorkspace(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: governanceKeys.eventsWorkspace(workspaceId) })
  ]);
};
