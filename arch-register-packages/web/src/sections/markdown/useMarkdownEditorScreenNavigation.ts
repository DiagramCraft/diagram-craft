import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MarkdownSearchParams } from '../../routes/searchParams';
import type { CommentsDisplayMode } from '../wikiComments/commentsDisplayMode';
import { nextCommentsDisplayMode } from '../wikiComments/commentsDisplayMode';
import {
  deriveMarkdownEditorTitleView,
  getInitialMarkdownEditorScreenState,
  type MarkdownEditorScreenState,
  type MarkdownPaneMode
} from './MarkdownEditorScreen.state';

export type MarkdownEditorSearchUpdate = (
  next: Partial<MarkdownSearchParams>,
  replace?: boolean
) => void;

export type MarkdownEditorScreenNavigationOptions = {
  isDraft: boolean;
  isReadOnly: boolean;
  requestedMode: MarkdownSearchParams['mode'];
  requestedPanel: MarkdownSearchParams['panel'];
  diagramSessionId: string | undefined;
  currentDiagramSessionId: string;
  revisionsCount: number;
  updatedLabel: string | null;
  readTime: number;
  updateSearch: MarkdownEditorSearchUpdate;
};

export const useMarkdownEditorScreenNavigation = ({
  isDraft,
  isReadOnly,
  requestedMode,
  requestedPanel,
  diagramSessionId,
  currentDiagramSessionId,
  revisionsCount,
  updatedLabel,
  readTime,
  updateSearch
}: MarkdownEditorScreenNavigationOptions) => {
  const [paneMode, setPaneMode] = useState<MarkdownPaneMode>(
    isDraft || requestedMode === 'edit' ? 'edit' : 'preview'
  );
  const [commentsMode, setCommentsMode] = useState<CommentsDisplayMode>('side');

  const screenState = useMemo<MarkdownEditorScreenState>(
    () =>
      isDraft
        ? { screenMode: 'edit', paneMode, viewPanel: 'preview' }
        : { ...getInitialMarkdownEditorScreenState(requestedMode, requestedPanel), paneMode },
    [isDraft, paneMode, requestedMode, requestedPanel]
  );

  const titleView = useMemo(
    () =>
      deriveMarkdownEditorTitleView(screenState, {
        revisionsCount,
        updatedLabel,
        readTime
      }),
    [readTime, revisionsCount, screenState, updatedLabel]
  );

  useEffect(() => {
    if (!isReadOnly || requestedMode !== 'edit') return;
    setPaneMode('preview');
    updateSearch({ mode: 'preview', panel: 'preview' }, true);
  }, [isReadOnly, requestedMode, updateSearch]);

  useEffect(() => {
    if (isDraft) return;
    setPaneMode(requestedMode === 'edit' ? 'edit' : 'preview');
  }, [isDraft, requestedMode]);

  useEffect(() => {
    if (requestedMode !== 'edit') return;
    if (diagramSessionId === currentDiagramSessionId) return;
    updateSearch({ diagramSessionId: currentDiagramSessionId }, true);
  }, [currentDiagramSessionId, diagramSessionId, requestedMode, updateSearch]);

  const onSelectPane = useCallback((mode: MarkdownPaneMode) => {
    setPaneMode(mode);
  }, []);

  const onEnterEdit = useCallback(() => {
    if (isReadOnly) return;
    setPaneMode('edit');
    updateSearch({
      mode: 'edit',
      panel: undefined,
      revisionId: undefined,
      historyMode: undefined,
      compareMode: undefined,
      diagramSessionId: currentDiagramSessionId
    });
  }, [currentDiagramSessionId, isReadOnly, updateSearch]);

  const onPreview = useCallback(() => {
    updateSearch({
      mode: 'preview',
      panel: 'preview',
      revisionId: undefined,
      historyMode: undefined,
      compareMode: undefined,
      diagramSessionId: undefined
    });
  }, [updateSearch]);

  const cycleCommentsMode = useCallback(() => {
    setCommentsMode(nextCommentsDisplayMode);
  }, []);

  return {
    screenState,
    titleView,
    paneMode,
    commentsMode,
    onSelectPane,
    onEnterEdit,
    onPreview,
    cycleCommentsMode
  };
};
