import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BaselineLinkTargetType,
  CreateBaselineRequest
} from '@arch-register/api-types/baselineContract';
import { orpcClient } from '../lib/orpcClient';
import { baselineKeys, invalidateBaselineQueries } from '../queries/baselines';

export const useBaselines = (workspaceId: string, includeDeleted = false) =>
  useQuery({
    queryKey: baselineKeys.list(workspaceId, includeDeleted),
    queryFn: () =>
      orpcClient.baselines.list({
        params: { workspace: workspaceId },
        query: { includeDeleted }
      }),
    enabled: !!workspaceId
  });

export const useBaseline = (workspaceId: string, id: string) =>
  useQuery({
    queryKey: baselineKeys.detail(workspaceId, id),
    queryFn: () => orpcClient.baselines.get({ params: { workspace: workspaceId, id } }),
    enabled: !!workspaceId && !!id
  });

export const useCreateBaseline = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBaselineRequest) =>
      orpcClient.baselines.create({ params: { workspace: workspaceId }, body }),
    onSuccess: () => invalidateBaselineQueries(queryClient, workspaceId)
  });
};

export const useBaselineDiff = (workspaceId: string) =>
  useMutation({
    mutationFn: (body: {
      from: { kind: 'baseline'; id: string } | { kind: 'current' };
      to: { kind: 'baseline'; id: string } | { kind: 'current' };
    }) =>
      orpcClient.baselines.diff({ params: { workspace: workspaceId }, body })
  });

export const useSupersedeBaseline = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, replacementId }: { id: string; replacementId: string }) =>
      orpcClient.baselines.supersede({
        params: { workspace: workspaceId, id },
        body: { replacementId }
      }),
    onSuccess: () => invalidateBaselineQueries(queryClient, workspaceId)
  });
};

export const useDeleteBaseline = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      orpcClient.baselines.remove({ params: { workspace: workspaceId, id } }),
    onSuccess: () => invalidateBaselineQueries(queryClient, workspaceId)
  });
};

export const useCreateBaselineLink = (workspaceId: string, baselineId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { targetType: BaselineLinkTargetType; targetId: string }) =>
      orpcClient.baselines.links.create({
        params: { workspace: workspaceId, id: baselineId },
        body
      }),
    onSuccess: () => invalidateBaselineQueries(queryClient, workspaceId)
  });
};

export const useDeleteBaselineLink = (workspaceId: string, baselineId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) =>
      orpcClient.baselines.links.remove({
        params: { workspace: workspaceId, id: baselineId, linkId }
      }),
    onSuccess: () => invalidateBaselineQueries(queryClient, workspaceId)
  });
};
