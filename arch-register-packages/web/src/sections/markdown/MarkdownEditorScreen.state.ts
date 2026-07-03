export type MarkdownScreenMode = 'edit' | 'preview';
export type MarkdownPaneMode = 'edit' | 'raw' | 'preview';
export type MarkdownViewPanel = 'preview' | 'history';

export type MarkdownEditorScreenState = {
  screenMode: MarkdownScreenMode;
  paneMode: MarkdownPaneMode;
  viewPanel: MarkdownViewPanel;
};

type SearchMode = MarkdownScreenMode | undefined;
type SearchPanel = MarkdownViewPanel | undefined;

export const getInitialMarkdownEditorScreenState = (
  searchMode: SearchMode,
  searchPanel: SearchPanel
): MarkdownEditorScreenState => {
  const screenMode = searchMode === 'edit' ? 'edit' : 'preview';
  const viewPanel = searchPanel === 'history' ? 'history' : 'preview';

  return {
    screenMode,
    paneMode: screenMode === 'edit' ? 'edit' : 'preview',
    viewPanel
  };
};

export type MarkdownEditorTitleView = {
  description: string;
  isViewMode: boolean;
  attachDisabled: boolean;
};

export const deriveMarkdownEditorTitleView = (
  state: MarkdownEditorScreenState,
  info: { revisionsCount: number; updatedLabel: string | null; readTime: number }
): MarkdownEditorTitleView => ({
  description:
    state.screenMode === 'edit'
      ? 'Editing now'
      : state.viewPanel === 'history'
        ? `Version history${info.revisionsCount > 0 ? ` · ${info.revisionsCount} saved` : ''}`
        : [info.updatedLabel ? `Updated ${info.updatedLabel}` : null, `${info.readTime} min read`]
            .filter(Boolean)
            .join(' · '),
  isViewMode: state.screenMode === 'preview' && state.viewPanel === 'preview',
  attachDisabled: state.viewPanel === 'history'
});
