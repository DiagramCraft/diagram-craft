import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  TeamAssignmentInfo,
  WorkspaceTeamInput,
  SupportedCurrency,
  AssessmentType
} from '@arch-register/api-types/workspaceConfigContract';
import { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { orpcClient } from '../lib/orpcClient';
import {
  assessmentTypesQuery,
  currenciesQuery,
  invalidateWorkspaceAnalyticsAfterConfigChange,
  lifecycleStatesQuery,
  projectEntityTypesQuery,
  setWorkspaceConfigCache,
  teamAssignmentsQuery,
  teamsQuery,
  workspaceConfigKeys as workspaceConfigKeysFromQueries
} from '../queries/workspaceConfig';

export const workspaceConfigKeys = workspaceConfigKeysFromQueries;

// Hook for fetching lifecycle states
export const useLifecycleStates = (workspaceSlug: string, enabled = true) => {
  return useQuery(lifecycleStatesQuery(workspaceSlug, enabled));
};

export const useTeams = (
  workspaceSlug: string,
  enabled = true,
  options: { q?: string; limit?: number } = {}
) => {
  return useQuery(teamsQuery(workspaceSlug, options, enabled));
};

export const useTeamAssignments = (workspaceSlug: string, enabled = true) => {
  return useQuery(teamAssignmentsQuery(workspaceSlug, enabled));
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
      setWorkspaceConfigCache(
        queryClient,
        workspaceConfigKeys.lifecycleStates(workspaceId),
        updatedStates
      );
      void invalidateWorkspaceAnalyticsAfterConfigChange(queryClient, workspaceId);
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
      setWorkspaceConfigCache(queryClient, workspaceConfigKeys.teams(workspaceId), updatedTeams);
      void invalidateWorkspaceAnalyticsAfterConfigChange(queryClient, workspaceId);
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
      setWorkspaceConfigCache(
        queryClient,
        workspaceConfigKeys.teamAssignments(workspaceId),
        updatedAssignments
      );
    }
  });
};

export const useProjectEntityTypes = (workspaceSlug: string, enabled = true) => {
  return useQuery(projectEntityTypesQuery(workspaceSlug, enabled));
};

export const useAssessmentTypes = (workspaceSlug: string, enabled = true) => {
  return useQuery(assessmentTypesQuery(workspaceSlug, enabled));
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
      setWorkspaceConfigCache(queryClient, workspaceConfigKeys.assessmentTypes(workspaceId), value);
    }
  });
};

export const useSupportedCurrencies = (workspaceSlug: string, enabled = true) =>
  useQuery(currenciesQuery(workspaceSlug, enabled));

export const useUpdateSupportedCurrencies = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { currencies: SupportedCurrency[]; default_currency: string }) =>
      orpcClient.config.currencies.replace({
        params: { workspace: workspaceId },
        body: input
      }),
    onSuccess: value => {
      setWorkspaceConfigCache(queryClient, workspaceConfigKeys.currencies(workspaceId), value);
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
