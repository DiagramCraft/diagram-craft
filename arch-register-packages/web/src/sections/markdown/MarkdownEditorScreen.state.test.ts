import { describe, expect, it } from 'vitest';
import {
  enterMarkdownEditMode,
  exitMarkdownEditMode,
  getInitialMarkdownEditorScreenState,
  openMarkdownHistory,
  selectMarkdownEditPane,
  syncMarkdownEditorScreenState
} from './MarkdownEditorScreen.state';

describe('MarkdownEditorScreen state', () => {
  it('starts an edit session in edit pane when the route requests edit mode', () => {
    expect(getInitialMarkdownEditorScreenState('edit', undefined)).toEqual({
      screenMode: 'edit',
      paneMode: 'edit',
      viewPanel: 'preview'
    });
  });

  it('keeps preview as a pane inside the editing session', () => {
    expect(selectMarkdownEditPane('preview')).toEqual({
      screenMode: 'edit',
      paneMode: 'preview',
      viewPanel: 'preview'
    });
  });

  it('allows switching between edit panes without leaving edit mode', () => {
    expect(selectMarkdownEditPane('raw')).toEqual({
      screenMode: 'edit',
      paneMode: 'raw',
      viewPanel: 'preview'
    });
  });

  it('exits editing when saving and closing', () => {
    expect(exitMarkdownEditMode()).toEqual({
      screenMode: 'preview',
      paneMode: 'preview',
      viewPanel: 'preview'
    });
  });

  it('opens history outside the editing session', () => {
    expect(openMarkdownHistory()).toEqual({
      screenMode: 'preview',
      paneMode: 'preview',
      viewPanel: 'history'
    });
  });

  it('syncs local state from preview route state', () => {
    expect(
      syncMarkdownEditorScreenState(enterMarkdownEditMode(), 'preview', 'history')
    ).toEqual({
      screenMode: 'preview',
      paneMode: 'preview',
      viewPanel: 'history'
    });
  });
});
