import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TeamAssignmentInfo, WorkspaceTeam } from '../lib/api';
import { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { orpcClient } from '../lib/orpcClient';
import { workspaceAnalyticsKeys } from './queryKeys';

// Query keys factory
export const workspaceConfigKeys = {
  all: ['workspace-config'] as const,
  lifecycleStates: (workspaceId: string) =>
    [...workspaceConfigKeys.all, 'lifecycle-states', workspaceId] as const,
  teams: (workspaceId: string) => [...workspaceConfigKeys.all, 'teams', workspaceId] as const,
  teamAssignments: (workspaceId: string) =>
    [...workspaceConfigKeys.all, 'team-assignments', workspaceId] as const,
  projectEntityTypes: (workspaceId: string) =>
    [...workspaceConfigKeys.all, 'project-entity-types', workspaceId] as const
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

export const useTeams = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: workspaceConfigKeys.teams(workspaceSlug),
    queryFn: () => orpcClient.config.teams.list({ params: { workspace: workspaceSlug } }),
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
      void queryClient.invalidateQueries({ queryKey: workspaceAnalyticsKeys.detail(workspaceId) });
    }
  });
};

export const useUpdateTeams = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teams: WorkspaceTeam[]) =>
      orpcClient.config.teams.replace({
        params: { workspace: workspaceId },
        body: { teams }
      }),
    onSuccess: updatedTeams => {
      queryClient.setQueryData(workspaceConfigKeys.teams(workspaceId), updatedTeams);
      void queryClient.invalidateQueries({ queryKey: workspaceAnalyticsKeys.detail(workspaceId) });
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

// Combined hook for workspace config
export const useWorkspaceConfig = (workspaceSlug: string, enabled = true) => {
  const lifecycleStates = useLifecycleStates(workspaceSlug, enabled);
  const teams = useTeams(workspaceSlug, enabled);
  const teamAssignments = useTeamAssignments(workspaceSlug, enabled);
  const projectEntityTypes = useProjectEntityTypes(workspaceSlug, enabled);

  return {
    lifecycleStates: lifecycleStates.data ?? [],
    teams: teams.data ?? [],
    teamAssignments: teamAssignments.data ?? [],
    projectEntityTypes: projectEntityTypes.data ?? [],
    isLoading:
      lifecycleStates.isLoading ||
      teams.isLoading ||
      teamAssignments.isLoading ||
      projectEntityTypes.isLoading,
    isError:
      lifecycleStates.isError ||
      teams.isError ||
      teamAssignments.isError ||
      projectEntityTypes.isError
  };
};
