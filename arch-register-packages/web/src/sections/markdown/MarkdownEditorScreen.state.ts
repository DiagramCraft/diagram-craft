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

export const syncMarkdownEditorScreenState = (
  current: MarkdownEditorScreenState,
  searchMode: SearchMode,
  searchPanel: SearchPanel
): MarkdownEditorScreenState => {
  const next = getInitialMarkdownEditorScreenState(searchMode, searchPanel);
  return current.screenMode === next.screenMode &&
    current.paneMode === next.paneMode &&
    current.viewPanel === next.viewPanel
    ? current
    : next;
};

export const enterMarkdownEditMode = (): MarkdownEditorScreenState => ({
  screenMode: 'edit',
  paneMode: 'edit',
  viewPanel: 'preview'
});

export const selectMarkdownEditPane = (
  paneMode: MarkdownPaneMode
): MarkdownEditorScreenState => ({
  screenMode: 'edit',
  paneMode,
  viewPanel: 'preview'
});

export const exitMarkdownEditMode = (): MarkdownEditorScreenState => ({
  screenMode: 'preview',
  paneMode: 'preview',
  viewPanel: 'preview'
});

export const openMarkdownHistory = (): MarkdownEditorScreenState => ({
  screenMode: 'preview',
  paneMode: 'preview',
  viewPanel: 'history'
});
