import { describe, expect, it } from 'vitest';
import { isRestorableRelationVersionKind, relationVersionTypeLabel } from './relationVersionsState';

describe('isRestorableRelationVersionKind', () => {
  it('allows autosave, saved and applied versions', () => {
    expect(isRestorableRelationVersionKind('autosave')).toBe(true);
    expect(isRestorableRelationVersionKind('saved_version')).toBe(true);
    expect(isRestorableRelationVersionKind('case_applied')).toBe(true);
  });

  it('rejects deleted, restored and direct edit versions', () => {
    expect(isRestorableRelationVersionKind('deleted')).toBe(false);
    expect(isRestorableRelationVersionKind('restored')).toBe(false);
    expect(isRestorableRelationVersionKind('direct_edit')).toBe(false);
  });
});

describe('relationVersionTypeLabel', () => {
  it('maps kinds to badge labels', () => {
    expect(relationVersionTypeLabel('saved_version')).toBe('saved');
    expect(relationVersionTypeLabel('case_applied')).toBe('applied');
    expect(relationVersionTypeLabel('autosave')).toBe('autosave');
  });
});
