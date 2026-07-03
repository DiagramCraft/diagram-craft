import { describe, expect, it } from 'vitest';
import { getInitialMarkdownEditorScreenState } from './MarkdownEditorScreen.state';

describe('MarkdownEditorScreen state', () => {
  it('starts an edit session in edit pane when the route requests edit mode', () => {
    expect(getInitialMarkdownEditorScreenState('edit', undefined)).toEqual({
      screenMode: 'edit',
      paneMode: 'edit',
      viewPanel: 'preview'
    });
  });

  it('derives preview mode directly from the route', () => {
    expect(getInitialMarkdownEditorScreenState('preview', 'preview')).toEqual({
      screenMode: 'preview',
      paneMode: 'preview',
      viewPanel: 'preview'
    });
  });

  it('opens history outside the editing session', () => {
    expect(getInitialMarkdownEditorScreenState('preview', 'history')).toEqual({
      screenMode: 'preview',
      paneMode: 'preview',
      viewPanel: 'history'
    });
  });
});
