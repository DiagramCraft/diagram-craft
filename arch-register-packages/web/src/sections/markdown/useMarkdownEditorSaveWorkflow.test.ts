import { describe, expect, it } from 'vitest';
import {
  decideSaveAction,
  decideSaveAndCloseAction,
  needsMigration
} from './useMarkdownEditorSaveWorkflow';

describe('needsMigration', () => {
  it('is true when the document type has changed', () => {
    expect(needsMigration('type-2', 'type-1')).toBe(true);
  });

  it('is false when the document type is unchanged', () => {
    expect(needsMigration('type-1', 'type-1')).toBe(false);
  });
});

describe('decideSaveAction', () => {
  const base = {
    isDraft: false,
    isReadOnly: false,
    isDirty: false,
    hasPendingDiagramChanges: false,
    isSavingDraft: false
  };

  it('saves a draft when it is a draft and not already saving', () => {
    expect(decideSaveAction({ ...base, isDraft: true })).toEqual({ kind: 'save-draft' });
  });

  it('is a no-op for a draft that is already saving', () => {
    expect(decideSaveAction({ ...base, isDraft: true, isSavingDraft: true })).toEqual({
      kind: 'noop'
    });
  });

  it('is a no-op for a read-only, non-draft document', () => {
    expect(decideSaveAction({ ...base, isReadOnly: true })).toEqual({ kind: 'noop' });
  });

  it('rotates the diagram session when clean but the diagram has pending changes', () => {
    expect(decideSaveAction({ ...base, hasPendingDiagramChanges: true })).toEqual({
      kind: 'rotate-diagram'
    });
  });

  it('is a no-op when clean with no pending diagram changes', () => {
    expect(decideSaveAction(base)).toEqual({ kind: 'noop' });
  });

  it('requests an existing-document save when dirty', () => {
    expect(decideSaveAction({ ...base, isDirty: true })).toEqual({
      kind: 'request-existing-save'
    });
  });
});

describe('decideSaveAndCloseAction', () => {
  const base = { isDraft: false, isReadOnly: false, isDirty: false, isSavingDraft: false };

  it('saves a draft when it is a draft and not already saving', () => {
    expect(decideSaveAndCloseAction({ ...base, isDraft: true })).toEqual({ kind: 'save-draft' });
  });

  it('is a no-op for a draft that is already saving', () => {
    expect(decideSaveAndCloseAction({ ...base, isDraft: true, isSavingDraft: true })).toEqual({
      kind: 'noop'
    });
  });

  it('finalizes exit immediately for a read-only, non-draft document', () => {
    expect(decideSaveAndCloseAction({ ...base, isReadOnly: true })).toEqual({
      kind: 'finalize-exit'
    });
  });

  it('requests an existing-document save when dirty', () => {
    expect(decideSaveAndCloseAction({ ...base, isDirty: true })).toEqual({
      kind: 'request-existing-save'
    });
  });

  it('finalizes exit directly when clean', () => {
    expect(decideSaveAndCloseAction(base)).toEqual({ kind: 'finalize-exit' });
  });
});
