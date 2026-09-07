import { useCallback, useEffect } from 'react';
import type { MarkdownRevisionSummary } from '@arch-register/api-types/projectMarkdownContract';
import type { ContentScope } from '../../hooks/useContentScope';
import { useRestoreMarkdownRevision } from '../../hooks/useMarkdownContent';
import type { useMarkdownEditorDocumentState } from './useMarkdownEditorDocumentState';
import type { useMarkdownEditorTransitions } from './useMarkdownEditorTransitions';
import type { MarkdownEditorSearchUpdate } from './useMarkdownEditorScreenNavigation';
import type { MarkdownSearchParams } from '../../routes/searchParams';

type MarkdownEditorDocument = Pick<ReturnType<typeof useMarkdownEditorDocumentState>, 'markClean'>;
type MarkdownEditorTransitions = ReturnType<typeof useMarkdownEditorTransitions>;

export type MarkdownEditorHistoryOptions = {
  nodeId: string;
  isDraft: boolean;
  isReadOnly: boolean;
  contentScope: ContentScope;
  requestedPanel: MarkdownSearchParams['panel'];
  historyMode: 'preview' | 'compare';
  compareMode: 'to-current' | 'changes-in-version';
  selectedRevisionId: string | undefined;
  revisions: MarkdownRevisionSummary[];
  revisionsLoading: boolean;
  updateSearch: MarkdownEditorSearchUpdate;
  document: MarkdownEditorDocument;
  transitions: MarkdownEditorTransitions;
};

export const useMarkdownEditorHistory = ({
  nodeId,
  isDraft,
  isReadOnly,
  contentScope,
  requestedPanel,
  historyMode,
  compareMode,
  selectedRevisionId,
  revisions,
  revisionsLoading,
  updateSearch,
  document,
  transitions
}: MarkdownEditorHistoryOptions) => {
  const restoreMutation = useRestoreMarkdownRevision(contentScope, nodeId);

  useEffect(() => {
    if (isDraft || requestedPanel !== 'history' || revisions.length === 0 || selectedRevisionId) {
      return;
    }
    updateSearch(
      {
        mode: 'preview',
        panel: 'history',
        revisionId: revisions[0]!.id
      },
      true
    );
  }, [isDraft, requestedPanel, revisions, selectedRevisionId, updateSearch]);

  const onOpenHistory = useCallback(() => {
    updateSearch({
      mode: 'preview',
      panel: 'history',
      revisionId: revisions[0]?.id,
      historyMode: undefined,
      compareMode: undefined,
      diagramSessionId: undefined
    });
  }, [revisions, updateSearch]);

  const onSelectRevision = useCallback(
    (revisionId: string) => {
      updateSearch({
        mode: 'preview',
        panel: 'history',
        revisionId,
        historyMode: historyMode === 'compare' ? 'compare' : undefined,
        compareMode: historyMode === 'compare' ? compareMode : undefined,
        diagramSessionId: undefined
      });
    },
    [compareMode, historyMode, updateSearch]
  );

  const onEnterCompare = useCallback(
    (mode: 'to-current' | 'changes-in-version') => {
      updateSearch({
        mode: 'preview',
        panel: 'history',
        historyMode: 'compare',
        compareMode: mode,
        revisionId: selectedRevisionId,
        diagramSessionId: undefined
      });
    },
    [selectedRevisionId, updateSearch]
  );

  const onViewVersion = useCallback(() => {
    updateSearch({
      mode: 'preview',
      panel: 'history',
      revisionId: selectedRevisionId,
      historyMode: undefined,
      compareMode: undefined,
      diagramSessionId: undefined
    });
  }, [selectedRevisionId, updateSearch]);

  const onRestore = useCallback(
    async (revisionId: string) => {
      if (isReadOnly || restoreMutation.isPending) return;
      await restoreMutation.mutateAsync({ revisionId, change_kind: 'major' });
      document.markClean();
      transitions.finalizeExit();
    },
    [document, isReadOnly, restoreMutation, transitions]
  );

  return {
    revisions,
    revisionsLoading,
    selectedRevisionId,
    historyMode,
    compareMode,
    isRestoring: restoreMutation.isPending,
    onOpenHistory,
    onSelectRevision,
    onEnterCompare,
    onViewVersion,
    onRestore
  };
};
