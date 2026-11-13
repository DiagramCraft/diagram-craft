import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  SchemaChangeMode,
  SchemaDraft,
  SchemaDraftKind,
  SchemaDraftOp,
  SnapshotVersionKind
} from '@arch-register/api-types/schemaDraftContract';
import { orpcClient } from '../lib/orpcClient';
import {
  schemaChangeModeQuery,
  schemaDraftKeys,
  schemaDraftQuery,
  schemaPublicationsQuery,
  snapshotVersionsQuery
} from '../queries/schemaDraft';

export const useSchemaDraft = (workspaceSlug: string, enabled = true) =>
  useQuery(schemaDraftQuery(workspaceSlug, enabled));

export const useSchemaChangeMode = (workspaceSlug: string, enabled = true) =>
  useQuery(schemaChangeModeQuery(workspaceSlug, enabled));

export const useSetSchemaChangeMode = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schemaChangeMode: SchemaChangeMode) =>
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

/**
 * A mutation that returns the updated draft. The draft cache is replaced with the result, or
 * refetched when the call fails (typically a stale revision).
 */
const useDraftMutation = <Variables>(
  workspaceSlug: string,
  mutationFn: (variables: Variables, revision: number) => Promise<SchemaDraft>
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: Variables) =>
      mutationFn(variables, currentRevision(queryClient, workspaceSlug)),
    onSuccess: draft => queryClient.setQueryData(schemaDraftKeys.draft(workspaceSlug), draft),
    onError: () => queryClient.invalidateQueries({ queryKey: schemaDraftKeys.draft(workspaceSlug) })
  });
};

/** Stages (adds or replaces) a draft item; never touches live definitions. */
export const useStageSchemaItem = (workspaceSlug: string) =>
  useDraftMutation(
    workspaceSlug,
    (
      {
        kind,
        itemId,
        op,
        payload
      }: { kind: SchemaDraftKind; itemId: string; op: SchemaDraftOp; payload?: unknown },
      expectedRevision
    ) =>
      orpcClient.schemaDraft.stage({
        params: { workspace: workspaceSlug, kind, itemId },
        body: { expectedRevision, op, payload }
      })
  );

/** Removes an item from the draft, i.e. reverts it to the live version. */
export const useUnstageSchemaItem = (workspaceSlug: string) =>
  useDraftMutation(
    workspaceSlug,
    ({ kind, itemId }: { kind: SchemaDraftKind; itemId: string }, expectedRevision) =>
      orpcClient.schemaDraft.unstage({
        params: { workspace: workspaceSlug, kind, itemId },
        query: { expectedRevision }
      })
  );

/** Discards the whole draft, reverting every staged change to live. */
export const useDiscardSchemaDraft = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      orpcClient.schemaDraft.discard({
        params: { workspace: workspaceSlug },
        query: { expectedRevision: currentRevision(queryClient, workspaceSlug) }
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: schemaDraftKeys.draft(workspaceSlug) })
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

export const useSchemaPublications = (workspaceSlug: string, enabled = true) =>
  useQuery(schemaPublicationsQuery(workspaceSlug, enabled));

export const useSnapshotVersions = (
  workspaceSlug: string,
  kind: SnapshotVersionKind,
  itemId: string,
  enabled = true
) => useQuery(snapshotVersionsQuery(workspaceSlug, kind, itemId, enabled));

/**
 * Publishes the draft. Publishing changes live definitions of every kind, so on success the whole
 * query cache is refreshed rather than a hand-picked set of keys.
 */
export const usePublishSchemaDraft = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (summary: string) =>
      orpcClient.schemaDraft.publish({
        params: { workspace: workspaceSlug },
        body: {
          expectedRevision: currentRevision(queryClient, workspaceSlug),
          summary,
          migrationDecisions: []
        }
      }),
    onSettled: () => queryClient.invalidateQueries()
  });
};

/** Stages a draft item that restores an item to a previously published version. */
export const useRollbackToVersion = (workspaceSlug: string) =>
  useDraftMutation(
    workspaceSlug,
    (
      { kind, itemId, version }: { kind: SchemaDraftKind; itemId: string; version: number },
      expectedRevision
    ) =>
      orpcClient.schemaDraft.fromVersion({
        params: { workspace: workspaceSlug },
        body: { expectedRevision, kind, itemId, version }
      })
  );
