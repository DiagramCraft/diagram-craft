import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  buildMarkdownCloseImpactSummary,
  getMarkdownDiagramRollbackRecords,
  hashDiagramContent,
  type DiagramSessionRecord,
  type MarkdownCloseImpactSummary
} from './markdownDiagramSession';

// Owns the "close the editor" decision: whether pending diagram edits need a confirmation
// dialog, and what happens to them (keep vs. revert) when the user chooses.
export const useMarkdownCloseFlow = (params: {
  dirty: boolean;
  hasPendingDiagramChanges: boolean;
  savedBody: string;
  sessionId: string;
  createdDiagramsRef: MutableRefObject<DiagramSessionRecord[]>;
  loadDiagramContentByPath: (path: string) => Promise<unknown>;
  saveDiagramContentByPath: (path: string, content: Record<string, unknown>) => Promise<void>;
  refreshDiagramPreviewCaches: (diagramIds: string[]) => Promise<void>;
  deleteAttachment: (path: string) => Promise<unknown>;
  transitionKey: string;
  onFinalize: () => boolean | void;
}) => {
  const {
    dirty,
    hasPendingDiagramChanges,
    savedBody,
    sessionId,
    createdDiagramsRef,
    loadDiagramContentByPath,
    saveDiagramContentByPath,
    refreshDiagramPreviewCaches,
    deleteAttachment,
    transitionKey,
    onFinalize
  } = params;

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeSummary, setCloseSummary] = useState<MarkdownCloseImpactSummary | null>(null);
  const finalizingRef = useRef(false);
  const summaryBuildInFlightRef = useRef(false);
  const closeOperationInFlightRef = useRef(false);
  const previousTransitionKeyRef = useRef(transitionKey);

  useEffect(() => {
    if (previousTransitionKeyRef.current === transitionKey) return;
    previousTransitionKeyRef.current = transitionKey;
    finalizingRef.current = false;
    summaryBuildInFlightRef.current = false;
    closeOperationInFlightRef.current = false;
  }, [transitionKey]);

  const clearCloseSummary = useCallback(() => setCloseSummary(null), []);

  const finalizeClose = useCallback(() => {
    if (finalizingRef.current) return false;
    finalizingRef.current = true;
    setCloseDialogOpen(false);
    setCloseSummary(null);
    try {
      onFinalize();
      return true;
    } catch (cause) {
      finalizingRef.current = false;
      throw cause;
    }
  }, [onFinalize]);

  const buildCloseSummary = useCallback(async () => {
    const records = getMarkdownDiagramRollbackRecords(sessionId);
    const currentContentHashes = Object.fromEntries(
      await Promise.all(
        records
          .filter(record => !!record.lastSavedContentHash)
          .map(async record => {
            try {
              const content = await loadDiagramContentByPath(record.path);
              return [record.diagramId, hashDiagramContent(JSON.stringify(content))] as const;
            } catch {
              return [record.diagramId, undefined] as const;
            }
          })
      )
    );

    return buildMarkdownCloseImpactSummary({
      createdDiagrams: createdDiagramsRef.current,
      records,
      savedBody,
      currentContentHashes
    });
  }, [createdDiagramsRef, loadDiagramContentByPath, savedBody, sessionId]);

  const handleClose = useCallback(async () => {
    if (finalizingRef.current || summaryBuildInFlightRef.current || closeDialogOpen) return;
    if (!dirty && !hasPendingDiagramChanges) {
      finalizeClose();
      return;
    }

    summaryBuildInFlightRef.current = true;
    try {
      const summary = await buildCloseSummary();
      if (finalizingRef.current) return;
      setCloseSummary(summary);
      setCloseDialogOpen(true);
    } finally {
      summaryBuildInFlightRef.current = false;
    }
  }, [buildCloseSummary, closeDialogOpen, dirty, finalizeClose, hasPendingDiagramChanges]);

  const handleCancelClose = useCallback(() => setCloseDialogOpen(false), []);

  const runCloseOperation = useCallback(
    async (operation: () => Promise<void>) => {
      if (finalizingRef.current || closeOperationInFlightRef.current) return;
      closeOperationInFlightRef.current = true;
      try {
        await operation();
        finalizeClose();
      } catch (cause) {
        closeOperationInFlightRef.current = false;
        throw cause;
      }
    },
    [finalizeClose]
  );

  const handleKeepDiagramChanges = useCallback(async () => {
    await runCloseOperation(async () => {
      const touchedDiagramIds = getMarkdownDiagramRollbackRecords(sessionId).map(
        record => record.diagramId
      );

      for (const { id, path } of createdDiagramsRef.current) {
        if (!savedBody.includes(id)) {
          await deleteAttachment(path);
        }
      }

      await refreshDiagramPreviewCaches(touchedDiagramIds);
    });
  }, [
    createdDiagramsRef,
    deleteAttachment,
    refreshDiagramPreviewCaches,
    runCloseOperation,
    savedBody,
    sessionId
  ]);

  const handleRevertEligibleDiagramChanges = useCallback(
    async (diagramIds: string[]) => {
      if (finalizingRef.current || closeOperationInFlightRef.current) return;
      const summary = closeSummary;
      if (!summary) {
        await handleKeepDiagramChanges();
        return;
      }

      await runCloseOperation(async () => {
        const recordsById = new Map(
          getMarkdownDiagramRollbackRecords(sessionId).map(record => [record.diagramId, record])
        );

        for (const diagram of summary.createdDiagramsToDelete) {
          await deleteAttachment(diagram.path);
        }

        const revertedDiagramIds = summary.revertableDiagrams
          .filter(diagram => diagramIds.includes(diagram.diagramId))
          .map(diagram => diagram.diagramId);

        for (const diagram of summary.revertableDiagrams.filter(diagram =>
          diagramIds.includes(diagram.diagramId)
        )) {
          const record = recordsById.get(diagram.diagramId);
          if (!record) continue;
          await saveDiagramContentByPath(
            record.path,
            JSON.parse(record.originalContent) as Record<string, unknown>
          );
        }

        await refreshDiagramPreviewCaches(
          Array.from(
            new Set([
              ...summary.createdDiagramsToDelete.map(diagram => diagram.id),
              ...summary.revertableDiagrams.map(diagram => diagram.diagramId),
              ...summary.nonRevertableDiagrams.map(diagram => diagram.diagramId),
              ...revertedDiagramIds
            ])
          )
        );
      });
    },
    [
      closeSummary,
      deleteAttachment,
      handleKeepDiagramChanges,
      refreshDiagramPreviewCaches,
      runCloseOperation,
      saveDiagramContentByPath,
      sessionId
    ]
  );

  return {
    closeDialogOpen,
    closeSummary,
    clearCloseSummary,
    handleClose,
    handleCancelClose,
    handleKeepDiagramChanges,
    handleRevertEligibleDiagramChanges
  };
};
