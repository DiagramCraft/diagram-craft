import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import {
  automationRuleRunsQuery,
  automationRulesQuery,
  invalidateAutomationRuleQueries,
  type AutomationRuleInput,
  type AutomationRuleRunFilters
} from '../queries/automationRules';

export type { AutomationRuleInput, AutomationRuleRunFilters } from '../queries/automationRules';

export const useAutomationRules = (workspace: string) =>
  useQuery({
    ...automationRulesQuery(workspace)
  });

export const useAutomationRuleOperations = (workspace: string) => {
  const queryClient = useQueryClient();
  const invalidate = () => invalidateAutomationRuleQueries(queryClient, workspace);
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
    ...automationRuleRunsQuery(workspace, filters, enabled)
  });
