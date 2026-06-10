import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TeamAssignmentInfo, WorkspaceTeam } from '../lib/api';
import {
  listLifecycleStatesORPC,
  listTeamsORPC,
  listTeamAssignmentsORPC,
  updateLifecycleStatesORPC,
  updateTeamsORPC,
  updateTeamAssignmentsORPC
} from '../lib/workspaceConfigORPCClient';
import { WorkspaceLifecycleState } from '@arch-register/api-types/workspaces';

// Query keys factory
export const workspaceConfigKeys = {
  all: ['workspace-config'] as const,
  lifecycleStates: (workspaceId: string) =>
    [...workspaceConfigKeys.all, 'lifecycle-states', workspaceId] as const,
  teams: (workspaceId: string) => [...workspaceConfigKeys.all, 'teams', workspaceId] as const,
  teamAssignments: (workspaceId: string) =>
    [...workspaceConfigKeys.all, 'team-assignments', workspaceId] as const
};

// Hook for fetching lifecycle states
export const useLifecycleStates = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: workspaceConfigKeys.lifecycleStates(workspaceSlug),
    queryFn: () => listLifecycleStatesORPC(workspaceSlug),
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

export const useTeams = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: workspaceConfigKeys.teams(workspaceSlug),
    queryFn: () => listTeamsORPC(workspaceSlug),
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

export const useTeamAssignments = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: workspaceConfigKeys.teamAssignments(workspaceSlug),
    queryFn: () => listTeamAssignmentsORPC(workspaceSlug),
    enabled: enabled && !!workspaceSlug,
    staleTime: 2 * 60 * 1000
  });
};

// Hook for updating lifecycle states
export const useUpdateLifecycleStates = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (states: WorkspaceLifecycleState[]) =>
      updateLifecycleStatesORPC(workspaceId, states),
    onSuccess: updatedStates => {
      // Update the cache with the new states
      queryClient.setQueryData(workspaceConfigKeys.lifecycleStates(workspaceId), updatedStates);
    }
  });
};

export const useUpdateTeams = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teams: WorkspaceTeam[]) => updateTeamsORPC(workspaceId, teams),
    onSuccess: updatedTeams => {
      queryClient.setQueryData(workspaceConfigKeys.teams(workspaceId), updatedTeams);
    }
  });
};

export const useUpdateTeamAssignments = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assignments: Array<Pick<TeamAssignmentInfo, 'team_id' | 'user_id' | 'role'>>) =>
      updateTeamAssignmentsORPC(workspaceId, assignments),
    onSuccess: updatedAssignments => {
      queryClient.setQueryData(
        workspaceConfigKeys.teamAssignments(workspaceId),
        updatedAssignments
      );
    }
  });
};

// Combined hook for workspace config
export const useWorkspaceConfig = (workspaceSlug: string, enabled = true) => {
  const lifecycleStates = useLifecycleStates(workspaceSlug, enabled);
  const teams = useTeams(workspaceSlug, enabled);
  const teamAssignments = useTeamAssignments(workspaceSlug, enabled);

  return {
    lifecycleStates: lifecycleStates.data ?? [],
    teams: teams.data ?? [],
    teamAssignments: teamAssignments.data ?? [],
    isLoading: lifecycleStates.isLoading || teams.isLoading || teamAssignments.isLoading,
    isError: lifecycleStates.isError || teams.isError || teamAssignments.isError
  };
};
