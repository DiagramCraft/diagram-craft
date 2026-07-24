import { useQueries } from '@tanstack/react-query';
import type { TimelineViewData } from '@arch-register/api-types/entityContract';
import { orpcClient } from '../lib/orpcClient';
import { entityTimelineKeys } from '../queries/entityTimeline';

const TIMELINE_BATCH_SIZE = 200;

const chunk = <T>(values: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

export const useEntityTimeline = (workspaceId: string, entityIds: string[], enabled = true) => {
  const sortedIds = [...new Set(entityIds)].sort();
  const batches = chunk(sortedIds, TIMELINE_BATCH_SIZE);
  const queries = useQueries({
    queries: batches.map(ids => ({
      queryKey: entityTimelineKeys.batch(workspaceId, ids),
      queryFn: () =>
        orpcClient.entities.timelineView({
          params: { workspace: workspaceId },
          body: { ids }
        }),
      enabled: enabled && !!workspaceId && ids.length > 0
    }))
  });

  const data: Record<string, TimelineViewData> = {};
  for (const query of queries) {
    Object.assign(data, query.data ?? {});
  }

  return {
    data,
    isLoading: queries.some(query => query.isLoading),
    isFetching: queries.some(query => query.isFetching),
    isError: queries.some(query => query.isError)
  };
};
