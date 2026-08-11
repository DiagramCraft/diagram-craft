import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { EntityChangeBulkApprovalRequestBody } from '@arch-register/api-types/entityChangeContract';
import { orpcClient } from '../lib/orpcClient';
import { entityKeys } from './entities';
import { invalidateGovernanceQueries } from './governance';

export const entityChangeKeys = {
  current: (workspaceId: string, entityId: string) =>
    ['entity-change', workspaceId, entityId] as const
};

export const bulkEntityChangeKeys = {
  detail: (workspaceId: string, approvalId: string) =>
    ['entity-change-bulk', workspaceId, approvalId] as const
};

export const entityChangeQuery = (workspaceId: string, entityId: string) =>
  queryOptions({
    queryKey: entityChangeKeys.current(workspaceId, entityId),
    queryFn: () =>
      orpcClient.entityChanges.get({ params: { workspace: workspaceId, id: entityId } }),
    enabled: !!workspaceId && !!entityId
  });

export const bulkEntityChangeQuery = (workspaceId: string, approvalId: string | null) =>
  queryOptions({
    queryKey: bulkEntityChangeKeys.detail(workspaceId, approvalId ?? ''),
    queryFn: () =>
      orpcClient.entityChanges.getBulk({
        params: { workspace: workspaceId, approvalId: approvalId! }
      }),
    enabled: !!workspaceId && !!approvalId
  });

export const invalidateEntityChangeQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  entityId: string
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: entityChangeKeys.current(workspaceId, entityId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspaceId, entityId) })
  ]);

export const invalidateBulkEntityChangeQueries = (
  queryClient: QueryClient,
  workspaceId: string,
  approvalId: string
) =>
  queryClient.invalidateQueries({ queryKey: bulkEntityChangeKeys.detail(workspaceId, approvalId) });

export const invalidateBulkEntityChangeMutation = async (
  queryClient: QueryClient,
  workspaceId: string
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceLists(workspaceId) }),
    invalidateGovernanceQueries(queryClient, workspaceId)
  ]);

export type EntityChangeBulkMutation = EntityChangeBulkApprovalRequestBody;
