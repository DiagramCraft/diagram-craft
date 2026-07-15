import { useCallback, useState, type MutableRefObject } from 'react';
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
  clearDiagramSessionState: () => void;
  deleteAttachment: (path: string) => Promise<unknown>;
  onExit: () => void;
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
    clearDiagramSessionState,
    deleteAttachment,
    onExit
  } = params;

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeSummary, setCloseSummary] = useState<MarkdownCloseImpactSummary | null>(null);

  const clearCloseSummary = useCallback(() => setCloseSummary(null), []);

  const finalizeClose = useCallback(() => {
    setCloseDialogOpen(false);
    setCloseSummary(null);
    clearDiagramSessionState();
    onExit();
  }, [clearDiagramSessionState, onExit]);

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
    if (!dirty && !hasPendingDiagramChanges) {
      onExit();
      return;
    }

    const summary = await buildCloseSummary();
    setCloseSummary(summary);
    setCloseDialogOpen(true);
  }, [buildCloseSummary, dirty, hasPendingDiagramChanges, onExit]);

  const handleCancelClose = useCallback(() => setCloseDialogOpen(false), []);

  const handleKeepDiagramChanges = useCallback(async () => {
    const touchedDiagramIds = getMarkdownDiagramRollbackRecords(sessionId).map(
      record => record.diagramId
    );

    for (const { id, path } of createdDiagramsRef.current) {
      if (!savedBody.includes(id)) {
        await deleteAttachment(path);
      }
    }

    await refreshDiagramPreviewCaches(touchedDiagramIds);
    finalizeClose();
  }, [
    createdDiagramsRef,
    deleteAttachment,
    finalizeClose,
    refreshDiagramPreviewCaches,
    savedBody,
    sessionId
  ]);

  const handleRevertEligibleDiagramChanges = useCallback(
    async (diagramIds: string[]) => {
      const summary = closeSummary;
      if (!summary) {
        await handleKeepDiagramChanges();
        return;
      }

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

      finalizeClose();
    },
    [
      closeSummary,
      deleteAttachment,
      finalizeClose,
      handleKeepDiagramChanges,
      refreshDiagramPreviewCaches,
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
