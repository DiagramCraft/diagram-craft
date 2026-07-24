import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AutomationAction,
  AutomationCondition,
  AutomationRuleTrigger
} from '@arch-register/api-types/automationRuleContract';
import type { JobRunStatus } from '@arch-register/api-types/jobsContract';
import { orpcClient } from '../lib/orpcClient';

const keys = {
  list: (workspace: string) => ['automation-rules', workspace] as const,
  runs: (workspace: string, filters: AutomationRuleRunFilters) =>
    ['automation-rules', workspace, 'runs', filters] as const
};

export type AutomationRuleInput = {
  name: string;
  description?: string | null;
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

export const useAutomationRules = (workspace: string) =>
  useQuery({
    queryKey: keys.list(workspace),
    queryFn: () => orpcClient.automationRules.list({ params: { workspace } }),
    enabled: !!workspace
  });

export const useAutomationRuleOperations = (workspace: string) => {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: keys.list(workspace) });
  const create = useMutation({
    mutationFn: (body: AutomationRuleInput) =>
      orpcClient.automationRules.create({ params: { workspace }, body }),
    onSuccess: invalidate
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: AutomationRuleInput & { id: string }) =>
      orpcClient.automationRules.update({ params: { workspace, id }, body }),
    onSuccess: invalidate
  });
  const remove = useMutation({
    mutationFn: (id: string) => orpcClient.automationRules.remove({ params: { workspace, id } }),
    onSuccess: invalidate
  });
  return { create, update, remove };
};

export const useAutomationRuleRuns = (
  workspace: string,
  filters: AutomationRuleRunFilters,
  enabled = true
) =>
  useQuery({
    queryKey: keys.runs(workspace, filters),
    queryFn: () =>
      orpcClient.automationRules.runs.list({
        params: { workspace },
        query: {
          status: filters.status,
          plannedFrom: filters.plannedFrom,
          plannedTo: filters.plannedTo,
          limit: filters.limit ?? 50,
          offset: filters.offset ?? 0
        }
      }),
    enabled: enabled && !!workspace,
    refetchInterval: 5000
  });
