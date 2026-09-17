import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type {
  ListGovernanceCasesQuery,
  ListGovernanceSubmissionsQuery,
  ListGovernanceTasksQuery
} from '@arch-register/api-types/governanceContract';
import { orpcClient } from '../lib/orpcClient';

export const governanceKeys = {
  all: ['governance'] as const,
  cases: (workspaceId: string, query: ListGovernanceCasesQuery = {}) =>
    [...governanceKeys.all, 'cases', workspaceId, query] as const,
  casesWorkspace: (workspaceId: string) => [...governanceKeys.all, 'cases', workspaceId] as const,
  case: (workspaceId: string, caseId: string) =>
    [...governanceKeys.all, 'case', workspaceId, caseId] as const,
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

/** Lists governance cases visible to the current user — unlike `governanceTasksQuery`
 *  (`governance.assignments.mine`), this isn't scoped to the current user's own assignments, so
 *  it's what backs a workspace-wide "all open items" view (Data Stewardship's "My work", #3298). */
export const governanceCasesQuery = (
  workspaceId: string,
  query: ListGovernanceCasesQuery = {},
  enabled = true
) =>
  queryOptions({
    queryKey: governanceKeys.cases(workspaceId, query),
    queryFn: () => orpcClient.governance.cases.list({ params: { workspace: workspaceId }, query }),
    enabled: enabled && !!workspaceId,
    staleTime: 15 * 1000
  });

export const governanceCaseQuery = (workspaceId: string, caseId: string | null, enabled = true) =>
  queryOptions({
    queryKey: governanceKeys.case(workspaceId, caseId ?? ''),
    queryFn: () =>
      orpcClient.governance.cases.get({ params: { workspace: workspaceId, id: caseId! } }),
    enabled: enabled && !!workspaceId && !!caseId
  });

export const governanceTasksQuery = (
  workspaceId: string,
  query: ListGovernanceTasksQuery = {},
  enabled = true
) =>
  queryOptions({
    queryKey: governanceKeys.tasks(workspaceId, query),
    queryFn: () =>
      orpcClient.governance.assignments.mine({ params: { workspace: workspaceId }, query }),
    enabled: enabled && !!workspaceId,
    staleTime: 15 * 1000
  });

export const governanceTaskCountQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: governanceKeys.count(workspaceId),
    queryFn: () => orpcClient.governance.assignments.count({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 15 * 1000
  });

export const governanceCaseEventsQuery = (
  workspaceId: string,
  caseId: string | null,
  enabled = true
) =>
  queryOptions({
    queryKey: governanceKeys.events(workspaceId, caseId ?? ''),
    queryFn: () =>
      orpcClient.governance.cases.events({ params: { workspace: workspaceId, id: caseId! } }),
    enabled: enabled && !!workspaceId && !!caseId
  });

export const governanceSubmissionsQuery = (
  workspaceId: string,
  query: ListGovernanceSubmissionsQuery = {},
  enabled = true
) =>
  queryOptions({
    queryKey: governanceKeys.submissions(workspaceId, query),
    queryFn: () =>
      orpcClient.governance.submissions.mine({ params: { workspace: workspaceId }, query }),
    enabled: enabled && !!workspaceId,
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000
  });

export const invalidateGovernanceQueries = async (
  queryClient: QueryClient,
  workspaceId: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: governanceKeys.casesWorkspace(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: governanceKeys.tasksWorkspace(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: governanceKeys.count(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: governanceKeys.submissionsWorkspace(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: governanceKeys.eventsWorkspace(workspaceId) })
  ]);
};
