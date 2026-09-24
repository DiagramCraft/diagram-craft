import { useCallback, useMemo, useState } from 'react';
import type {
  MergeExecuteResponse,
  MergePreview
} from '@arch-register/api-types/entityMergeContract';
import { useEntityMergePreview, useExecuteEntityMerge } from '../../hooks/useEntityMerge';
import {
  buildDefaultResolutions,
  buildMergeExecuteBody,
  isMergeBlockedHard,
  type ConflictResolution,
  type FieldResolution,
  type MergeResolutionMaps
} from './mergeReviewState';

export type MergePhase =
  | 'pick-target'
  | 'loading-preview'
  | 'review'
  | 'confirm'
  | 'executing'
  | 'done';

// Given the outcome of a preview call, decides the resulting phase and (on success) the default
// resolutions/blocker-acknowledgement state to seed the review step with.
export const resolvePreviewOutcome = (
  result: { ok: true; preview: MergePreview } | { ok: false; error: unknown }
):
  | {
      phase: 'review';
      preview: MergePreview;
      resolutions: MergeResolutionMaps;
      acknowledgedBlockers: Set<string>;
    }
  | { phase: 'pick-target'; error: string } => {
  if (!result.ok) {
    return {
      phase: 'pick-target',
      error:
        result.error instanceof Error
          ? result.error.message
          : 'Failed to preview the merge. Please try again.'
    };
  }
  return {
    phase: 'review',
    preview: result.preview,
    resolutions: buildDefaultResolutions(result.preview),
    acknowledgedBlockers: new Set()
  };
};

// Given the outcome of an execute call, decides the resulting phase — a failure (typically a 409
// from stale preview state) returns to `confirm` rather than resetting the whole wizard, since the
// preview/resolutions are still shown while the caller decides whether to re-preview.
export const resolveExecuteOutcome = (
  result: { ok: true; result: MergeExecuteResponse } | { ok: false; error: unknown }
): { phase: 'done'; result: MergeExecuteResponse } | { phase: 'confirm'; error: string } => {
  if (!result.ok) {
    return {
      phase: 'confirm',
      error:
        result.error instanceof Error
          ? result.error.message
          : 'Failed to complete the merge. Please refresh and re-review.'
    };
  }
  return { phase: 'done', result: result.result };
};

// Splits the next queued source entity off the remaining queue, or null once it's empty.
export const advanceQueueState = (
  remainingQueue: readonly string[]
): { next: string; rest: string[] } | null => {
  const [next, ...rest] = remainingQueue;
  return next ? { next, rest } : null;
};

export type UseMergeWizardControllerArgs = {
  workspaceId: string;
  sourceEntityId: string;
  // Additional source entities queued to merge into the same target after this one succeeds
  // (populated by the bulk "Merge into…" entry point; empty for a single-entity merge).
  queuedSourceIds?: string[];
};

export const useMergeWizardController = ({
  workspaceId,
  sourceEntityId,
  queuedSourceIds = []
}: UseMergeWizardControllerArgs) => {
  const previewMutation = useEntityMergePreview(workspaceId);
  const executeMutation = useExecuteEntityMerge(workspaceId);

  const [phase, setPhase] = useState<MergePhase>('pick-target');
  const [currentSourceId, setCurrentSourceId] = useState(sourceEntityId);
  const [remainingQueue, setRemainingQueue] = useState<string[]>(queuedSourceIds);
  const [targetEntityId, setTargetEntityId] = useState('');
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [resolutions, setResolutions] = useState<MergeResolutionMaps>({
    fieldResolutions: {},
    relationResolutions: {},
    sideTableResolutions: {}
  });
  const [acknowledgedBlockers, setAcknowledgedBlockers] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeExecuteResponse | null>(null);

  const runPreview = useCallback(
    async (targetId?: string) => {
      const resolvedTargetId = targetId ?? targetEntityId;
      if (!resolvedTargetId) return;
      setTargetEntityId(resolvedTargetId);
      setPhase('loading-preview');
      setPreviewError(null);
      let outcome: ReturnType<typeof resolvePreviewOutcome>;
      try {
        const result = await previewMutation.mutateAsync({
          sourceId: currentSourceId,
          targetId: resolvedTargetId
        });
        outcome = resolvePreviewOutcome({ ok: true, preview: result });
      } catch (error) {
        console.error('Failed to preview entity merge:', error);
        outcome = resolvePreviewOutcome({ ok: false, error });
      }
      if (outcome.phase === 'review') {
        setPreview(outcome.preview);
        setResolutions(outcome.resolutions);
        setAcknowledgedBlockers(outcome.acknowledgedBlockers);
        setPhase('review');
      } else {
        setPreviewError(outcome.error);
        setPhase('pick-target');
      }
    },
    [currentSourceId, previewMutation, targetEntityId]
  );

  const setFieldResolution = useCallback(
    (fieldKey: string, value: FieldResolution) => {
      const conflict = preview?.fieldConflicts.find(c => c.fieldKey === fieldKey);
      if (!conflict || conflict.restricted) return;
      setResolutions(current => ({
        ...current,
        fieldResolutions: { ...current.fieldResolutions, [fieldKey]: value }
      }));
    },
    [preview]
  );

  const setRelationResolution = useCallback(
    (relationId: string, value: ConflictResolution) => {
      const conflict = preview?.relationConflicts.find(c => c.relationId === relationId);
      if (!conflict || conflict.note === 'self') return;
      setResolutions(current => ({
        ...current,
        relationResolutions: { ...current.relationResolutions, [relationId]: value }
      }));
    },
    [preview]
  );

  const setSideTableResolution = useCallback((conflictId: string, value: ConflictResolution) => {
    setResolutions(current => ({
      ...current,
      sideTableResolutions: { ...current.sideTableResolutions, [conflictId]: value }
    }));
  }, []);

  const toggleBlockerAck = useCallback(
    (code: string) => {
      const blocker = preview?.blockers.find(b => b.code === code);
      if (!blocker?.acknowledgeable) return;
      setAcknowledgedBlockers(current => {
        const next = new Set(current);
        if (next.has(code)) next.delete(code);
        else next.add(code);
        return next;
      });
    },
    [preview]
  );

  const hasHardBlockers = useMemo(
    () => (preview ? isMergeBlockedHard(preview.blockers, acknowledgedBlockers) : false),
    [preview, acknowledgedBlockers]
  );

  const goToConfirm = useCallback(() => {
    if (hasHardBlockers) return;
    setConfirmText('');
    setExecuteError(null);
    setPhase('confirm');
  }, [hasHardBlockers]);

  const executeMerge = useCallback(async () => {
    if (!preview) return;
    setPhase('executing');
    setExecuteError(null);
    const body = buildMergeExecuteBody(preview, resolutions, acknowledgedBlockers);
    let outcome: ReturnType<typeof resolveExecuteOutcome>;
    try {
      const result = await executeMutation.mutateAsync({ sourceId: currentSourceId, body });
      outcome = resolveExecuteOutcome({ ok: true, result });
    } catch (error) {
      console.error('Failed to execute entity merge:', error);
      outcome = resolveExecuteOutcome({ ok: false, error });
    }
    if (outcome.phase === 'done') {
      setMergeResult(outcome.result);
      setPhase('done');
    } else {
      setExecuteError(outcome.error);
      setPhase('confirm');
    }
  }, [acknowledgedBlockers, currentSourceId, executeMutation, preview, resolutions]);

  // A 409 on execute means the source/target/participants changed since preview — there is no
  // safe way to carry old per-row choices over to a possibly-reshaped conflict set, so this
  // discards them and starts the review over with freshly-computed defaults.
  const refreshAfterConflict = useCallback(() => {
    setExecuteError(null);
    void runPreview(targetEntityId);
  }, [runPreview, targetEntityId]);

  const advanceQueue = useCallback(() => {
    const advance = advanceQueueState(remainingQueue);
    if (!advance) return false;
    setRemainingQueue(advance.rest);
    setCurrentSourceId(advance.next);
    setPreview(null);
    setResolutions({ fieldResolutions: {}, relationResolutions: {}, sideTableResolutions: {} });
    setAcknowledgedBlockers(new Set());
    setConfirmText('');
    setExecuteError(null);
    setMergeResult(null);
    void runPreview(targetEntityId);
    return true;
  }, [remainingQueue, runPreview, targetEntityId]);

  const reset = useCallback(() => {
    setPhase('pick-target');
    setCurrentSourceId(sourceEntityId);
    setRemainingQueue(queuedSourceIds);
    setTargetEntityId('');
    setPreview(null);
    setResolutions({ fieldResolutions: {}, relationResolutions: {}, sideTableResolutions: {} });
    setAcknowledgedBlockers(new Set());
    setConfirmText('');
    setPreviewError(null);
    setExecuteError(null);
    setMergeResult(null);
  }, [queuedSourceIds, sourceEntityId]);

  return {
    phase,
    currentSourceId,
    remainingQueue,
    targetEntityId,
    setTargetEntityId,
    preview,
    resolutions,
    acknowledgedBlockers,
    confirmText,
    setConfirmText,
    previewError,
    executeError,
    mergeResult,
    hasHardBlockers,
    isPreviewing: previewMutation.isPending,
    isExecuting: executeMutation.isPending,
    runPreview,
    setFieldResolution,
    setRelationResolution,
    setSideTableResolution,
    toggleBlockerAck,
    goToConfirm,
    backToReview: () => setPhase('review'),
    executeMerge,
    refreshAfterConflict,
    advanceQueue,
    reset
  };
};

export type MergeWizardController = ReturnType<typeof useMergeWizardController>;
