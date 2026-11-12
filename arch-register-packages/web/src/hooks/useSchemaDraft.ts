import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SchemaDraft } from '@arch-register/api-types/schemaDraftContract';
import { orpcClient } from '../lib/orpcClient';
import { schemaChangeModeQuery, schemaDraftKeys, schemaDraftQuery } from '../queries/schemaDraft';

type Kind = SchemaDraft['items'][number]['kind'];
type Op = SchemaDraft['items'][number]['op'];

export const useSchemaDraft = (workspaceSlug: string, enabled = true) =>
  useQuery(schemaDraftQuery(workspaceSlug, enabled));

export const useSchemaChangeMode = (workspaceSlug: string, enabled = true) =>
  useQuery(schemaChangeModeQuery(workspaceSlug, enabled));

export const useSetSchemaChangeMode = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schemaChangeMode: 'direct' | 'draft') =>
      orpcClient.schemaDraft.setMode({
        params: { workspace: workspaceSlug },
        body: { schemaChangeMode }
      }),
    onSuccess: result => {
      queryClient.setQueryData(schemaDraftKeys.mode(workspaceSlug), result);
    }
  });
};

const currentRevision = (queryClient: ReturnType<typeof useQueryClient>, ws: string) =>
  queryClient.getQueryData<SchemaDraft>(schemaDraftKeys.draft(ws))?.revision ?? 0;

/** Stages (adds or replaces) a draft item; never touches live definitions. */
export const useStageSchemaItem = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      kind,
      itemId,
      op,
      payload
    }: {
      kind: Kind;
      itemId: string;
      op: Op;
      payload?: unknown;
    }) =>
      orpcClient.schemaDraft.stage({
        params: { workspace: workspaceSlug, kind, itemId },
        body: { expectedRevision: currentRevision(queryClient, workspaceSlug), op, payload }
      }),
    onSuccess: draft => queryClient.setQueryData(schemaDraftKeys.draft(workspaceSlug), draft),
    onError: () => queryClient.invalidateQueries({ queryKey: schemaDraftKeys.draft(workspaceSlug) })
  });
};

/** Removes an item from the draft, i.e. reverts it to the live version. */
export const useUnstageSchemaItem = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, itemId }: { kind: Kind; itemId: string }) =>
      orpcClient.schemaDraft.unstage({
        params: { workspace: workspaceSlug, kind, itemId },
        query: { expectedRevision: currentRevision(queryClient, workspaceSlug) }
      }),
    onSuccess: draft => queryClient.setQueryData(schemaDraftKeys.draft(workspaceSlug), draft),
    onError: () => queryClient.invalidateQueries({ queryKey: schemaDraftKeys.draft(workspaceSlug) })
  });
};

/** Computes the impact of the draft. Read-only; also starts the background record validation. */
export const useReviewSchemaDraft = (workspaceSlug: string) =>
  useMutation({
    mutationFn: () => orpcClient.schemaDraft.review({ params: { workspace: workspaceSlug } })
  });

/** Polls the background record validation until it finishes. */
export const useSchemaDraftRecordReview = (workspaceSlug: string, jobRunId: string | undefined) =>
  useQuery({
    queryKey: [...schemaDraftKeys.all, 'record-review', workspaceSlug, jobRunId],
    queryFn: () =>
      orpcClient.schemaDraft.reviewRecords({
        params: { workspace: workspaceSlug, jobRunId: jobRunId! }
      }),
    enabled: !!jobRunId,
    // Stop after ~1 minute so a job that never runs (no job server) does not poll forever.
    refetchInterval: query =>
      (query.state.data &&
        ['succeeded', 'failed', 'cancelled'].includes(query.state.data.status)) ||
      query.state.dataUpdateCount >= 30
        ? false
        : 2000
  });
