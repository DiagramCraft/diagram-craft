import { describe, expect, it } from 'vitest';
import {
  createInitialDocumentState,
  emptyDocumentState,
  reduceDocumentState,
  shouldApplyServerRefresh
} from './useMarkdownEditorDocumentState';

describe('createInitialDocumentState', () => {
  it('seeds a draft as already dirty, with the draft document type', () => {
    expect(createInitialDocumentState(true, 'type-1')).toEqual({
      ...emptyDocumentState(),
      documentTypeId: 'type-1',
      dirty: true
    });
  });

  it('seeds a non-draft as clean, with no document type', () => {
    expect(createInitialDocumentState(false, 'type-1')).toEqual(emptyDocumentState());
  });
});

describe('reduceDocumentState', () => {
  const hydrated = reduceDocumentState(emptyDocumentState(), {
    type: 'hydrate',
    body: 'Saved body',
    documentTypeId: 'type-1',
    metadata: { owner: 'Architecture' },
    generatedMetadata: {},
    dirty: false
  });

  it('hydrate replaces the whole state, including dirty', () => {
    expect(hydrated).toEqual({
      body: 'Saved body',
      documentTypeId: 'type-1',
      metadata: { owner: 'Architecture' },
      generatedMetadata: {},
      dirty: false
    });
  });

  it('set-body updates the body and marks dirty', () => {
    const next = reduceDocumentState(hydrated, { type: 'set-body', body: 'Unsaved body' });
    expect(next.body).toBe('Unsaved body');
    expect(next.dirty).toBe(true);
  });

  it('set-document-type updates the type and marks dirty', () => {
    const next = reduceDocumentState(hydrated, {
      type: 'set-document-type',
      documentTypeId: 'type-2'
    });
    expect(next.documentTypeId).toBe('type-2');
    expect(next.dirty).toBe(true);
  });

  it('set-metadata sets a field and marks dirty', () => {
    const next = reduceDocumentState(hydrated, {
      type: 'set-metadata',
      fieldId: 'status',
      value: 'active'
    });
    expect(next.metadata).toEqual({ owner: 'Architecture', status: 'active' });
    expect(next.dirty).toBe(true);
  });

  it('set-metadata with an undefined value removes the field', () => {
    const next = reduceDocumentState(hydrated, {
      type: 'set-metadata',
      fieldId: 'owner',
      value: undefined
    });
    expect(next.metadata).toEqual({});
    expect(next.dirty).toBe(true);
  });

  it('mark-clean clears dirty without touching other fields', () => {
    const dirty = reduceDocumentState(hydrated, { type: 'set-body', body: 'Unsaved body' });
    const clean = reduceDocumentState(dirty, { type: 'mark-clean' });
    expect(clean.dirty).toBe(false);
    expect(clean.body).toBe('Unsaved body');
  });

  it('reset returns to the empty state', () => {
    expect(reduceDocumentState(hydrated, { type: 'reset' })).toEqual(emptyDocumentState());
  });
});

describe('shouldApplyServerRefresh', () => {
  it('always applies the first hydration after a node loads, dirty or not', () => {
    expect(shouldApplyServerRefresh({ initialized: false, dirty: true })).toBe(true);
    expect(shouldApplyServerRefresh({ initialized: false, dirty: false })).toBe(true);
  });

  it('skips a later refresh while the document has unsaved edits', () => {
    expect(shouldApplyServerRefresh({ initialized: true, dirty: true })).toBe(false);
  });

  it('applies a later refresh once the document is clean', () => {
    expect(shouldApplyServerRefresh({ initialized: true, dirty: false })).toBe(true);
  });
});
