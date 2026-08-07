import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GovernanceFieldDateReminderConfigUpdate } from '@arch-register/api-types/governanceFieldDateReminderConfigContract';
import { orpcClient } from '../lib/orpcClient';

export const governanceFieldDateReminderConfigKeys = {
  all: ['governance-field-date-reminder-config'] as const,
  schema: (workspace: string, schemaId: string) =>
    [...governanceFieldDateReminderConfigKeys.all, workspace, schemaId] as const
};

export const useGovernanceFieldDateReminderConfig = (
  workspaceSlug: string,
  schemaId: string | undefined
) =>
  useQuery({
    queryKey: governanceFieldDateReminderConfigKeys.schema(workspaceSlug, schemaId ?? ''),
    queryFn: () =>
      orpcClient.governanceFieldDateReminderConfig.list({
        params: { workspace: workspaceSlug, id: schemaId! }
      }),
    enabled: Boolean(workspaceSlug && schemaId),
    staleTime: 60_000
  });

export const useUpdateGovernanceFieldDateReminderConfig = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      schemaId,
      fieldId,
      data
    }: {
      schemaId: string;
      fieldId: string;
      data: GovernanceFieldDateReminderConfigUpdate;
    }) =>
      orpcClient.governanceFieldDateReminderConfig.update({
        params: { workspace: workspaceSlug, id: schemaId, fieldId },
        body: data
      }),
    onSuccess: (_result, variables) =>
      queryClient.invalidateQueries({
        queryKey: governanceFieldDateReminderConfigKeys.schema(workspaceSlug, variables.schemaId)
      })
  });
};
