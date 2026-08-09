import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  TeamAssignmentInfo,
  WorkspaceTeamInput,
  SupportedCurrency,
  AssessmentType
} from '@arch-register/api-types/workspaceConfigContract';
import { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { orpcClient } from '../lib/orpcClient';
import { workspaceAnalyticsKeys } from '../queries/workspaceAnalytics';

// Query keys factory
export const workspaceConfigKeys = {
  all: ['workspace-config'] as const,
  lifecycleStates: (workspaceId: string) =>
    [...workspaceConfigKeys.all, 'lifecycle-states', workspaceId] as const,
  teams: (workspaceId: string, q?: string, limit?: number) =>
    [...workspaceConfigKeys.all, 'teams', workspaceId, q ?? '', limit ?? null] as const,
  teamAssignments: (workspaceId: string) =>
    [...workspaceConfigKeys.all, 'team-assignments', workspaceId] as const,
  projectEntityTypes: (workspaceId: string) =>
    [...workspaceConfigKeys.all, 'project-entity-types', workspaceId] as const,
  assessmentTypes: (workspaceId: string) =>
    [...workspaceConfigKeys.all, 'assessment-types', workspaceId] as const,
  currencies: (workspaceId: string) =>
    [...workspaceConfigKeys.all, 'currencies', workspaceId] as const
};

// Hook for fetching lifecycle states
export const useLifecycleStates = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: workspaceConfigKeys.lifecycleStates(workspaceSlug),
    queryFn: () => orpcClient.config.lifecycleStates.list({ params: { workspace: workspaceSlug } }),
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

export const useTeams = (
  workspaceSlug: string,
  enabled = true,
  options: { q?: string; limit?: number } = {}
) => {
  return useQuery({
    queryKey: workspaceConfigKeys.teams(workspaceSlug, options.q, options.limit),
    queryFn: () =>
      orpcClient.config.teams.list({
        params: { workspace: workspaceSlug },
        query: { q: options.q, limit: options.limit }
      }),
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

export const useTeamAssignments = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: workspaceConfigKeys.teamAssignments(workspaceSlug),
    queryFn: () => orpcClient.config.teamAssignments.list({ params: { workspace: workspaceSlug } }),
    enabled: enabled && !!workspaceSlug,
    staleTime: 2 * 60 * 1000
  });
};

// Hook for updating lifecycle states
export const useUpdateLifecycleStates = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (states: WorkspaceLifecycleState[]) =>
      orpcClient.config.lifecycleStates.replace({
        params: { workspace: workspaceId },
        body: { states }
      }),
    onSuccess: updatedStates => {
      // Update the cache with the new states
      queryClient.setQueryData(workspaceConfigKeys.lifecycleStates(workspaceId), updatedStates);
      void queryClient.invalidateQueries({
        queryKey: workspaceAnalyticsKeys.workspace(workspaceId)
      });
    }
  });
};

export const useUpdateTeams = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teams: WorkspaceTeamInput[]) =>
      orpcClient.config.teams.replace({
        params: { workspace: workspaceId },
        body: { teams }
      }),
    onSuccess: updatedTeams => {
      queryClient.setQueryData(workspaceConfigKeys.teams(workspaceId), updatedTeams);
      void queryClient.invalidateQueries({
        queryKey: workspaceAnalyticsKeys.workspace(workspaceId)
      });
    }
  });
};

export const useUpdateTeamAssignments = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assignments: Array<Pick<TeamAssignmentInfo, 'team_id' | 'user_id' | 'role'>>) =>
      orpcClient.config.teamAssignments.replace({
        params: { workspace: workspaceId },
        body: { assignments }
      }),
    onSuccess: updatedAssignments => {
      queryClient.setQueryData(
        workspaceConfigKeys.teamAssignments(workspaceId),
        updatedAssignments
      );
    }
  });
};

export const useProjectEntityTypes = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: workspaceConfigKeys.projectEntityTypes(workspaceSlug),
    queryFn: () =>
      orpcClient.config.projectEntityTypes.list({ params: { workspace: workspaceSlug } }),
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000
  });
};

export const useAssessmentTypes = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: workspaceConfigKeys.assessmentTypes(workspaceSlug),
    queryFn: () => orpcClient.config.assessmentTypes.list({ params: { workspace: workspaceSlug } }),
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000
  });
};

export const useUpdateAssessmentTypes = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (types: Array<Pick<AssessmentType, 'id' | 'name'> & { sort_order?: number }>) =>
      orpcClient.config.assessmentTypes.replace({
        params: { workspace: workspaceId },
        body: { types }
      }),
    onSuccess: value => {
      queryClient.setQueryData(workspaceConfigKeys.assessmentTypes(workspaceId), value);
    }
  });
};

export const useSupportedCurrencies = (workspaceSlug: string, enabled = true) =>
  useQuery({
    queryKey: workspaceConfigKeys.currencies(workspaceSlug),
    queryFn: () => orpcClient.config.currencies.list({ params: { workspace: workspaceSlug } }),
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000
  });

export const useUpdateSupportedCurrencies = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { currencies: SupportedCurrency[]; default_currency: string }) =>
      orpcClient.config.currencies.replace({
        params: { workspace: workspaceId },
        body: input
      }),
    onSuccess: value => {
      queryClient.setQueryData(workspaceConfigKeys.currencies(workspaceId), value);
    }
  });
};

// Combined hook for workspace config
export const useWorkspaceConfig = (workspaceSlug: string, enabled = true) => {
  const lifecycleStates = useLifecycleStates(workspaceSlug, enabled);
  const teams = useTeams(workspaceSlug, enabled);
  const teamAssignments = useTeamAssignments(workspaceSlug, enabled);
  const projectEntityTypes = useProjectEntityTypes(workspaceSlug, enabled);
  const assessmentTypes = useAssessmentTypes(workspaceSlug, enabled);
  const currencies = useSupportedCurrencies(workspaceSlug, enabled);

  return {
    lifecycleStates: lifecycleStates.data ?? [],
    teams: teams.data ?? [],
    teamAssignments: teamAssignments.data ?? [],
    projectEntityTypes: projectEntityTypes.data ?? [],
    assessmentTypes: assessmentTypes.data ?? [],
    currencies: currencies.data ?? { currencies: [], default_currency: 'USD' },
    isLoading:
      lifecycleStates.isLoading ||
      teams.isLoading ||
      teamAssignments.isLoading ||
      projectEntityTypes.isLoading ||
      assessmentTypes.isLoading ||
      currencies.isLoading,
    isError:
      lifecycleStates.isError ||
      teams.isError ||
      teamAssignments.isError ||
      projectEntityTypes.isError ||
      assessmentTypes.isError ||
      currencies.isError
  };
};
