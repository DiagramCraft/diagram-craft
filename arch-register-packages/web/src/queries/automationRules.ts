import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type {
  AutomationAction,
  AutomationCondition,
  AutomationRuleTrigger
} from '@arch-register/api-types/automationRuleContract';
import type { JobRunStatus } from '@arch-register/api-types/jobsContract';
import { orpcClient } from '../lib/orpcClient';

export type AutomationRuleInput = {
  name: string;
  description?: string | null;
  resource_type: 'entity' | 'relation';
  schema_id?: string | null;
  trigger: AutomationRuleTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
};

export type AutomationRuleRunFilters = {
  status?: JobRunStatus;
  plannedFrom?: string;
  plannedTo?: string;
  limit?: number;
  offset?: number;
};

export const automationRuleKeys = {
  all: ['automation-rules'] as const,
  list: (workspaceId: string) => [...automationRuleKeys.all, workspaceId] as const,
  runsWorkspace: (workspaceId: string) =>
    [...automationRuleKeys.list(workspaceId), 'runs'] as const,
  runs: (workspaceId: string, filters: AutomationRuleRunFilters) =>
    [...automationRuleKeys.runsWorkspace(workspaceId), filters] as const
};

export const automationRulesQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: automationRuleKeys.list(workspaceId),
    queryFn: () => orpcClient.automationRules.list({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId
  });

export const automationRuleRunsQuery = (
  workspaceId: string,
  filters: AutomationRuleRunFilters,
  enabled = true
) =>
  queryOptions({
    queryKey: automationRuleKeys.runs(workspaceId, filters),
    queryFn: () =>
      orpcClient.automationRules.runs.list({
        params: { workspace: workspaceId },
        query: {
          status: filters.status,
          plannedFrom: filters.plannedFrom,
          plannedTo: filters.plannedTo,
          limit: filters.limit ?? 50,
          offset: filters.offset ?? 0
        }
      }),
    enabled: enabled && !!workspaceId,
    refetchInterval: 5000
  });

export const invalidateAutomationRuleQueries = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: automationRuleKeys.list(workspaceId) });
