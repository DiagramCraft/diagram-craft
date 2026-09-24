import { queryOptions } from '@tanstack/react-query';
import type { EntityTraversalSubject } from '@arch-register/api-types/entityTraversalContract';
import type { PathStep } from '@arch-register/api-types/entityQueryIR';
import { orpcClient } from '../lib/orpcClient';

type TraversalPathInput = { id: string; steps: readonly PathStep[] };

export const entityTraversalKeys = {
  all: ['entityTraversal'] as const,
  aggregates: (workspaceId: string) =>
    [...entityTraversalKeys.all, 'aggregate', workspaceId] as const,
  aggregate: (
    workspaceId: string,
    subject: EntityTraversalSubject,
    paths: readonly TraversalPathInput[],
    maxDepth: number | undefined
  ) => [...entityTraversalKeys.aggregates(workspaceId), subject, paths, maxDepth] as const
};

export const entityBlastRadiusAggregateQuery = (
  workspaceId: string,
  subject: EntityTraversalSubject,
  paths: readonly TraversalPathInput[],
  maxDepth: number | undefined,
  enabled = true
) =>
  queryOptions({
    queryKey: entityTraversalKeys.aggregate(workspaceId, subject, paths, maxDepth),
    queryFn: ({ signal }) =>
      orpcClient.entityTraversal.aggregate(
        {
          params: { workspace: workspaceId },
          body: { subject, paths: paths.map(path => ({ id: path.id, steps: [...path.steps] })), maxDepth }
        },
        { signal }
      ),
    enabled: enabled && !!workspaceId
  });
