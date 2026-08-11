import { queryOptions } from '@tanstack/react-query';
import type { MetricConfig, MetricRollupRequest } from '@arch-register/api-types/metricContract';
import { orpcClient } from '../lib/orpcClient';

export type MetricRollupQueryInput = Omit<MetricRollupRequest, 'metric'> & {
  metric: MetricConfig | null;
};

export const metricKeys = {
  all: ['metrics'] as const,
  rollups: (workspaceId: string) => [...metricKeys.all, 'rollup', workspaceId] as const,
  rollup: (workspaceId: string, request: MetricRollupQueryInput) =>
    [...metricKeys.rollups(workspaceId), request] as const
};

export const metricRollupQuery = (
  workspaceId: string,
  request: MetricRollupQueryInput,
  enabled = true
) =>
  queryOptions({
    queryKey: metricKeys.rollup(workspaceId, request),
    queryFn: () =>
      orpcClient.metrics.rollup({
        params: { workspace: workspaceId },
        body: request as MetricRollupRequest
      }),
    enabled: enabled && !!workspaceId && !!request.metric
  });
