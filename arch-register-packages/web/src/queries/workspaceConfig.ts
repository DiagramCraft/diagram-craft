import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type {
  TeamAssignmentInfo,
  WorkspaceTeamInput,
  SupportedCurrency,
  AssessmentType
} from '@arch-register/api-types/workspaceConfigContract';
import type {
  WorkspaceCapabilityConfiguration,
  WorkspaceCapabilityConfigurationInput
} from '@arch-register/api-types/workspaceCapabilityContract';
import { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { orpcClient } from '../lib/orpcClient';
import { workspaceAnalyticsKeys } from './workspaceAnalytics';

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
    [...workspaceConfigKeys.all, 'currencies', workspaceId] as const,
  capabilityConfigurations: (workspaceId: string) =>
    [...workspaceConfigKeys.all, 'capability-configurations', workspaceId] as const
};

export const lifecycleStatesQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: workspaceConfigKeys.lifecycleStates(workspaceId),
    queryFn: () => orpcClient.config.lifecycleStates.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 5 * 60 * 1000
  });

export const teamsQuery = (
  workspaceId: string,
  options: { q?: string; limit?: number } = {},
  enabled = true
) =>
  queryOptions({
    queryKey: workspaceConfigKeys.teams(workspaceId, options.q, options.limit),
    queryFn: () =>
      orpcClient.config.teams.list({
        params: { workspace: workspaceId },
        query: { q: options.q, limit: options.limit }
      }),
    enabled: enabled && !!workspaceId,
    staleTime: 5 * 60 * 1000
  });

export const teamAssignmentsQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: workspaceConfigKeys.teamAssignments(workspaceId),
    queryFn: () => orpcClient.config.teamAssignments.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 2 * 60 * 1000
  });

export const projectEntityTypesQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: workspaceConfigKeys.projectEntityTypes(workspaceId),
    queryFn: () =>
      orpcClient.config.projectEntityTypes.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 5 * 60 * 1000
  });

export const assessmentTypesQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: workspaceConfigKeys.assessmentTypes(workspaceId),
    queryFn: () => orpcClient.config.assessmentTypes.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 5 * 60 * 1000
  });

export const currenciesQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: workspaceConfigKeys.currencies(workspaceId),
    queryFn: () => orpcClient.config.currencies.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 5 * 60 * 1000
  });

export const workspaceCapabilityConfigurationsQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: workspaceConfigKeys.capabilityConfigurations(workspaceId),
    queryFn: () =>
      orpcClient.config.capabilityConfigurations.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 5 * 60 * 1000
  });

export const setWorkspaceConfigCache = (
  queryClient: QueryClient,
  key: readonly unknown[],
  value: unknown
) => queryClient.setQueryData(key, value);

export const invalidateWorkspaceAnalyticsAfterConfigChange = (
  queryClient: QueryClient,
  workspaceId: string
) => queryClient.invalidateQueries({ queryKey: workspaceAnalyticsKeys.workspace(workspaceId) });

export type WorkspaceConfigMutation =
  | WorkspaceLifecycleState[]
  | WorkspaceTeamInput[]
  | Array<Pick<TeamAssignmentInfo, 'team_id' | 'user_id' | 'role'>>
  | Array<Pick<AssessmentType, 'id' | 'name'> & { sort_order?: number }>
  | { currencies: SupportedCurrency[]; default_currency: string }
  | WorkspaceCapabilityConfigurationInput;

export type WorkspaceCapabilityConfigurationResult = WorkspaceCapabilityConfiguration;
