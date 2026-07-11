import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  entityKeys,
  snapshotKeys,
  invalidateEntityDetails,
  invalidateEntityQueries,
  invalidateSnapshotQueries
} from './queryKeys';
import { orpcClient } from '../lib/orpcClient';

export const useEntitySnapshots = (workspaceId: string, entityId: string, enabled = false) =>
  useQuery({
    queryKey: snapshotKeys.list(workspaceId, entityId),
    queryFn: () =>
      orpcClient.entities.snapshots.list({ params: { workspace: workspaceId, id: entityId } }),
    enabled: !!workspaceId && !!entityId && enabled
  });

export const usePromoteSnapshot = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commitMessage }: { commitMessage?: string }) => {
      const snapshots = await orpcClient.entities.snapshots.list({
        params: { workspace: workspaceId, id: entityId }
      });
      const latestAutosave = snapshots.find(s => s.status === 'autosave');
      if (!latestAutosave) throw new Error('No autosave snapshot found to promote');
      return orpcClient.entities.snapshots.promote({
        params: { workspace: workspaceId, id: entityId, snapshotId: latestAutosave.id },
        body: { commitMessage }
      });
    },
    onSuccess: () => {
      invalidateSnapshotQueries(queryClient, workspaceId, entityId);
      queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspaceId, entityId) });
    }
  });
};

export const useCreateFutureUpdate = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      projectId: string;
      targetDate?: string | null;
      commitMessage?: string | null;
      proposedState: Record<string, unknown>;
    }) =>
      orpcClient.entities.snapshots.create({
        params: { workspace: workspaceId, id: entityId },
        body: params
      }),
    onSuccess: (_, variables) => {
      invalidateSnapshotQueries(queryClient, workspaceId, entityId, variables.projectId);
    }
  });
};

export const useUpdateSnapshot = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      snapshotId: string;
      projectId?: string | null;
      proposedState?: Record<string, unknown>;
      targetDate?: string | null;
      commitMessage?: string | null;
    }) =>
      orpcClient.entities.snapshots.update({
        params: { workspace: workspaceId, id: entityId, snapshotId: params.snapshotId },
        body: {
          proposedState: params.proposedState,
          targetDate: params.targetDate,
          commitMessage: params.commitMessage
        }
      }),
    onSuccess: (_, variables) => {
      invalidateSnapshotQueries(queryClient, workspaceId, entityId, variables.projectId);
    }
  });
};

export const useRestoreSnapshot = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { snapshotId: string; commitMessage?: string }) =>
      orpcClient.entities.snapshots.restore({
        params: { workspace: workspaceId, id: entityId, snapshotId: params.snapshotId },
        body: { commitMessage: params.commitMessage }
      }),
    onSuccess: () => {
      invalidateEntityDetails(queryClient, workspaceId, entityId);
      invalidateSnapshotQueries(queryClient, workspaceId, entityId);
    }
  });
};

export const useApplySnapshot = (workspaceId: string, entityId: string, projectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { snapshotId: string; resolvedEntityData: Record<string, unknown> }) =>
      orpcClient.entities.snapshots.apply({
        params: { workspace: workspaceId, id: entityId, snapshotId: params.snapshotId },
        body: { resolvedEntityData: params.resolvedEntityData }
      }),
    onSuccess: () => {
      invalidateSnapshotQueries(queryClient, workspaceId, entityId, projectId);
      invalidateEntityDetails(queryClient, workspaceId, entityId);
      invalidateEntityQueries(queryClient, workspaceId);
    }
  });
};

export const useProjectFutureSnapshots = (workspaceId: string, projectId: string) =>
  useQuery({
    queryKey: snapshotKeys.byProject(workspaceId, projectId),
    queryFn: () =>
      orpcClient.entities.snapshots.listByProject({
        params: { workspace: workspaceId, projectId }
      }),
    enabled: !!workspaceId && !!projectId
  });
