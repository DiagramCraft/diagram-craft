import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateEntityQueries } from '../queries/entities';
import { changeCaseKeys, invalidateChangeCaseQueries } from '../queries/changeCases';
import { orpcClient } from '../lib/orpcClient';

export const useChangeCasesByProject = (workspaceId: string, projectId: string, enabled = true) =>
  useQuery({
    queryKey: changeCaseKeys.byProject(workspaceId, projectId),
    queryFn: () =>
      orpcClient.changeCases.listByProject({ params: { workspace: workspaceId, id: projectId } }),
    enabled: !!workspaceId && !!projectId && enabled
  });

export const useChangeCase = (
  workspaceId: string,
  projectId: string,
  caseId: string,
  enabled = true
) =>
  useQuery({
    queryKey: changeCaseKeys.detail(workspaceId, caseId),
    queryFn: () =>
      orpcClient.changeCases.get({
        params: { workspace: workspaceId, id: projectId, caseId }
      }),
    enabled: !!workspaceId && !!projectId && !!caseId && enabled
  });

export const useChangeCaseApplyConflicts = (
  workspaceId: string,
  projectId: string,
  caseId: string,
  enabled = true
) =>
  useQuery({
    queryKey: changeCaseKeys.applyConflicts(workspaceId, caseId),
    queryFn: () =>
      orpcClient.changeCases.checkApplyConflicts({
        params: { workspace: workspaceId, id: projectId, caseId }
      }),
    enabled: !!workspaceId && !!projectId && !!caseId && enabled
  });

export const useCreateChangeCase = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      name: string;
      description?: string | null;
      targetDate?: string | null;
      milestoneId?: string | null;
      commitMessage?: string | null;
      members: { entityId: string; proposedState: Record<string, unknown> }[];
    }) =>
      orpcClient.changeCases.create({
        params: { workspace: workspaceId, id: projectId },
        body: params
      }),
    onSuccess: () => {
      invalidateChangeCaseQueries(queryClient, workspaceId, projectId);
    }
  });
};

export const useAddChangeCaseMember = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      caseId: string;
      entityId: string;
      proposedState: Record<string, unknown>;
    }) =>
      orpcClient.changeCases.addMember({
        params: { workspace: workspaceId, id: projectId, caseId: params.caseId },
        body: { entityId: params.entityId, proposedState: params.proposedState }
      }),
    onSuccess: (_, variables) => {
      invalidateChangeCaseQueries(queryClient, workspaceId, projectId, variables.caseId);
    }
  });
};

export const useRemoveChangeCaseMember = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { caseId: string; memberId: string }) =>
      orpcClient.changeCases.removeMember({
        params: {
          workspace: workspaceId,
          id: projectId,
          caseId: params.caseId,
          memberId: params.memberId
        }
      }),
    onSuccess: (_, variables) => {
      invalidateChangeCaseQueries(queryClient, workspaceId, projectId, variables.caseId);
    }
  });
};

export const useUpdateChangeCaseMember = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      caseId: string;
      memberId: string;
      proposedState: Record<string, unknown>;
    }) =>
      orpcClient.changeCases.updateMember({
        params: {
          workspace: workspaceId,
          id: projectId,
          caseId: params.caseId,
          memberId: params.memberId
        },
        body: { proposedState: params.proposedState }
      }),
    onSuccess: (_, variables) => {
      invalidateChangeCaseQueries(queryClient, workspaceId, projectId, variables.caseId);
    }
  });
};

export const useUpdateChangeCase = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      caseId: string;
      name?: string;
      targetDate?: string | null;
      milestoneId?: string | null;
      commitMessage?: string | null;
    }) =>
      orpcClient.changeCases.update({
        params: { workspace: workspaceId, id: projectId, caseId: params.caseId },
        body: {
          name: params.name,
          targetDate: params.targetDate,
          milestoneId: params.milestoneId,
          commitMessage: params.commitMessage
        }
      }),
    onSuccess: (_, variables) => {
      invalidateChangeCaseQueries(queryClient, workspaceId, projectId, variables.caseId);
    }
  });
};

export const useApplyChangeCase = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      caseId: string;
      resolutions: { memberId: string; resolvedEntityData: Record<string, unknown> }[];
    }) =>
      orpcClient.changeCases.apply({
        params: { workspace: workspaceId, id: projectId, caseId: params.caseId },
        body: { resolutions: params.resolutions }
      }),
    onSuccess: (_, variables) => {
      invalidateChangeCaseQueries(queryClient, workspaceId, projectId, variables.caseId);
      invalidateEntityQueries(queryClient, workspaceId);
    }
  });
};

export const useWithdrawChangeCase = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { caseId: string }) =>
      orpcClient.changeCases.withdraw({
        params: { workspace: workspaceId, id: projectId, caseId: params.caseId }
      }),
    onSuccess: (_, variables) => {
      invalidateChangeCaseQueries(queryClient, workspaceId, projectId, variables.caseId);
    }
  });
};
