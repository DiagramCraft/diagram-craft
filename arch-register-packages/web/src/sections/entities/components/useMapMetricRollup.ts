import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MetricConfig, MetricRollupResponse } from '@arch-register/api-types/metricContract';
import { orpcClient } from '../../../lib/orpcClient';
import { metricKeys } from '../../../queries/metrics';
import type { EntityListOptions } from '../../../hooks/entityListQuery';

type UseMapMetricRollupProps = EntityListOptions & {
  workspaceId: string;
  boxEntityIds: string[];
  metric: MetricConfig | null;
};

const emptyResult: MetricRollupResponse = { results: [], legend: { min: null, max: null } };

export const useMapMetricRollup = ({
  workspaceId,
  boxEntityIds,
  metric,
  schemaId,
  owner,
  lifecycle,
  q,
  conditions,
  assessmentId,
  projectId,
  projectScope
}: UseMapMetricRollupProps) => {
  const sortedIds = useMemo(() => [...boxEntityIds].sort(), [boxEntityIds]);

  const request = useMemo(
    () => ({
      boxEntityIds: sortedIds,
      metric,
      schemaId: schemaId ?? undefined,
      owner: owner ?? undefined,
      lifecycle: lifecycle ?? undefined,
      q: q ?? undefined,
      conditions: conditions?.length ? conditions : undefined,
      assessmentId: assessmentId ?? undefined,
      projectId: projectId ?? undefined,
      projectScope: projectScope ?? undefined
    }),
    [
      sortedIds,
      metric,
      schemaId,
      owner,
      lifecycle,
      q,
      conditions,
      assessmentId,
      projectId,
      projectScope
    ]
  );

  const { data, isLoading } = useQuery({
    queryKey: metricKeys.rollup(workspaceId, request),
    queryFn: () =>
      orpcClient.metrics.rollup({
        params: { workspace: workspaceId },
        body: { ...request, metric: metric! }
      }),
    enabled: !!workspaceId && !!metric && sortedIds.length > 0
  });

  const resultsByBoxId = useMemo(() => {
    const map = new Map<string, MetricRollupResponse['results'][number]>();
    for (const result of data?.results ?? []) map.set(result.boxEntityId, result);
    return map;
  }, [data]);

  return {
    resultsByBoxId,
    legend: data?.legend ?? emptyResult.legend,
    isLoading: isLoading && !!metric
  };
};
