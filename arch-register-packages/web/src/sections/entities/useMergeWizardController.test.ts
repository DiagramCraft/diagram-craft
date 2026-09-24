import { describe, expect, it } from 'vitest';
import type {
  MergeExecuteResponse,
  MergePreview
} from '@arch-register/api-types/entityMergeContract';
import {
  advanceQueueState,
  resolveExecuteOutcome,
  resolvePreviewOutcome
} from './useMergeWizardController';

const basePreview: MergePreview = {
  sourceId: 'source-1',
  targetId: 'target-1',
  sourceVersion: 1,
  targetVersion: 1,
  previewFingerprint: 'fp-1',
  fieldConflicts: [
    {
      fieldKey: 'core:_description',
      fieldName: 'Description',
      kind: 'core',
      source: 'a',
      target: 'b',
      restricted: false
    }
  ],
  dependentImpact: [],
  relationConflicts: [
    {
      relationId: 'rel-1',
      relationSchemaId: 'rs-1',
      relationSchemaName: 'Depends on',
      direction: 'out',
      otherRecordId: 'other-1',
      otherRecordName: 'Other',
      duplicateRelationId: null,
      note: 'self'
    }
  ],
  sideTableConflicts: [],
  sideTableCounts: {
    entityVersions: 0,
    openChangeApprovals: 0,
    openGovernanceCases: 0,
    incomingRelations: 0,
    outgoingRelations: 0,
    externalIdentitiesTransferring: 0,
    externalIdentitiesColliding: 0
  },
  blockers: [],
  truncated: false
};

describe('resolvePreviewOutcome', () => {
  it('moves to review on success, defaulting resolutions (self-relation forced to drop_source)', () => {
    const outcome = resolvePreviewOutcome({ ok: true, preview: basePreview });
    expect(outcome.phase).toBe('review');
    if (outcome.phase !== 'review') throw new Error('unreachable');
    expect(outcome.preview).toEqual(basePreview);
    expect(outcome.resolutions.relationResolutions).toEqual({ 'rel-1': 'drop_source' });
    expect(outcome.acknowledgedBlockers.size).toBe(0);
  });

  it('reverts to pick-target with the error message on failure', () => {
    const outcome = resolvePreviewOutcome({ ok: false, error: new Error('boom') });
    expect(outcome).toEqual({ phase: 'pick-target', error: 'boom' });
  });

  it('falls back to a generic message for a non-Error failure', () => {
    const outcome = resolvePreviewOutcome({ ok: false, error: 'not an Error' });
    expect(outcome).toEqual({
      phase: 'pick-target',
      error: 'Failed to preview the merge. Please try again.'
    });
  });
});

describe('resolveExecuteOutcome', () => {
  const mergeResult = {
    mergeId: 'merge-1',
    sourceId: 'source-1',
    targetId: 'target-1',
    entity: { _publicId: 'TGT-1', _name: 'Target' }
  } as unknown as MergeExecuteResponse;

  it('moves to done on success', () => {
    const outcome = resolveExecuteOutcome({ ok: true, result: mergeResult });
    expect(outcome).toEqual({ phase: 'done', result: mergeResult });
  });

  it('returns to confirm (not pick-target) with the error message on failure, e.g. a stale-preview 409', () => {
    const outcome = resolveExecuteOutcome({ ok: false, error: new Error('stale') });
    expect(outcome).toEqual({ phase: 'confirm', error: 'stale' });
  });

  it('falls back to a generic message for a non-Error failure', () => {
    const outcome = resolveExecuteOutcome({ ok: false, error: 'not an Error' });
    expect(outcome).toEqual({
      phase: 'confirm',
      error: 'Failed to complete the merge. Please refresh and re-review.'
    });
  });
});

describe('advanceQueueState', () => {
  it('splits the next source off the remaining queue', () => {
    expect(advanceQueueState(['source-2', 'source-3'])).toEqual({
      next: 'source-2',
      rest: ['source-3']
    });
  });

  it('returns null once the queue is empty', () => {
    expect(advanceQueueState([])).toBeNull();
  });
});
