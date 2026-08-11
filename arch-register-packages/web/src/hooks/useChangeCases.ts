import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateEntityQueries } from '../queries/entities';
import {
  changeCaseApplyConflictsQuery,
  changeCaseQuery,
  changeCasesByEntityQuery,
  changeCasesByProjectQuery,
  invalidateChangeCaseQueries
} from '../queries/changeCases';
import { orpcClient } from '../lib/orpcClient';
import type { SaveChangeCaseDraftRequest } from '@arch-register/api-types/changeCaseContract';

export const useChangeCasesByProject = (workspaceId: string, projectId: string, enabled = true) =>
  useQuery(changeCasesByProjectQuery(workspaceId, projectId, enabled));

export const useChangeCasesByEntity = (workspaceId: string, entityId: string, enabled = true) =>
  useQuery(changeCasesByEntityQuery(workspaceId, entityId, enabled));

export const changeCasesByEntityQueryOptions = changeCasesByEntityQuery;

export const useChangeCase = (
  workspaceId: string,
  projectId: string,
  caseId: string,
  enabled = true
) => useQuery(changeCaseQuery(workspaceId, projectId, caseId, enabled));

export const useChangeCaseApplyConflicts = (
  workspaceId: string,
  projectId: string,
  caseId: string,
  enabled = true
) => useQuery(changeCaseApplyConflictsQuery(workspaceId, projectId, caseId, enabled));

export const useCreateChangeCase = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      name: string;
      description?: string | null;
      targetDate?: string | null;
      milestoneId?: string | null;
      commitMessage?: string | null;
      members: {
        entityId?: string;
        draftId?: string;
        proposedState: Record<string, unknown>;
      }[];
      newEntities: { draftId: string; state: Record<string, unknown> }[];
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
      invalidateChangeCaseQueries(
        queryClient,
        workspaceId,
        projectId,
        variables.caseId,
        variables.entityId
      );
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

export const useSaveChangeCaseDraft = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { caseId: string; draft: SaveChangeCaseDraftRequest }) =>
      orpcClient.changeCases.saveDraft({
        params: { workspace: workspaceId, id: projectId, caseId: params.caseId },
        body: params.draft
      }),
    onSuccess: (_, variables) => {
      invalidateChangeCaseQueries(queryClient, workspaceId, projectId, variables.caseId);
      invalidateEntityQueries(queryClient, workspaceId);
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
