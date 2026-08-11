import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type {
  AcknowledgeDeprecationBody,
  CancelDeprecationBody,
  FinalizeDeprecationBody,
  PostponeDeprecationBody,
  ProposeDeprecationBody
} from '@arch-register/api-types/entityDeprecationContract';
import { orpcClient } from '../lib/orpcClient';
import { entityKeys } from './entities';
import { invalidateGovernanceQueries } from './governance';

export const entityDeprecationKeys = {
  current: (workspaceId: string, entityId: string) =>
    ['entity-deprecation', workspaceId, entityId] as const
};

export const entityDeprecationQuery = (workspaceId: string, entityId: string) =>
  queryOptions({
    queryKey: entityDeprecationKeys.current(workspaceId, entityId),
    queryFn: () =>
      orpcClient.entityDeprecations.get({ params: { workspace: workspaceId, id: entityId } }),
    enabled: !!workspaceId && !!entityId
  });

export const invalidateEntityDeprecation = async (
  queryClient: QueryClient,
  workspaceId: string,
  entityId: string
) =>
  Promise.all([
    queryClient.invalidateQueries({
      queryKey: entityDeprecationKeys.current(workspaceId, entityId)
    }),
    queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspaceId, entityId) }),
    invalidateGovernanceQueries(queryClient, workspaceId)
  ]);

export type EntityDeprecationMutation =
  | ProposeDeprecationBody
  | (AcknowledgeDeprecationBody & { caseId: string })
  | string
  | (PostponeDeprecationBody & { caseId: string })
  | (FinalizeDeprecationBody & { caseId: string })
  | (CancelDeprecationBody & { caseId: string });
