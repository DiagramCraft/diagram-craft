import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import type { UpdateGovernanceReminderConfigRequest } from '@arch-register/api-types/governanceReminderConfigContract';

export const governanceReminderConfigKeys = {
  all: ['governance-reminder-config'] as const,
  detail: (ws: string) => [...governanceReminderConfigKeys.all, ws] as const
};

export const useGovernanceReminderConfig = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: governanceReminderConfigKeys.detail(workspaceSlug),
    queryFn: () =>
      orpcClient.governanceReminderConfig.list({ params: { workspace: workspaceSlug } }),
    enabled: enabled && !!workspaceSlug,
    staleTime: 60_000
  });
};

export const useUpdateGovernanceReminderConfig = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      caseKind,
      data
    }: {
      caseKind: string;
      data: UpdateGovernanceReminderConfigRequest;
    }) =>
      orpcClient.governanceReminderConfig.update({
        params: { workspace: workspaceSlug, caseKind },
        body: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: governanceReminderConfigKeys.detail(workspaceSlug)
      });
    }
  });
};
