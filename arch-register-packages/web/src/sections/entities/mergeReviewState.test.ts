import { describe, expect, it } from 'vitest';
import type { MergePreview } from '@arch-register/api-types/entityMergeContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  buildDefaultResolutions,
  buildMergeExecuteBody,
  collectReferenceFieldConflictIds,
  formatMergeCoreFieldValue,
  formatMergeFieldValue,
  formatMergeReferenceValue,
  formatSideTableLabel,
  isLookupCoreFieldConflict,
  isMergeBlockedHard,
  isReferenceFieldConflict
} from './mergeReviewState';

const basePreview: MergePreview = {
  sourceId: 'source-1',
  targetId: 'target-1',
  sourceVersion: 3,
  targetVersion: 5,
  previewFingerprint: 'fp-1',
  fieldConflicts: [
    {
      fieldKey: 'core:_description',
      fieldName: 'Description',
      kind: 'core',
      source: 'a',
      target: 'b',
      restricted: false
    },
    {
      fieldKey: 'data:abc123',
      fieldName: 'Confidential note',
      kind: 'data',
      source: null,
      target: null,
      restricted: true
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
      note: 'duplicate'
    },
    {
      relationId: 'rel-2',
      relationSchemaId: 'rs-2',
      relationSchemaName: 'Owns',
      direction: 'in',
      otherRecordId: 'target-1',
      otherRecordName: 'Target',
      duplicateRelationId: null,
      note: 'self'
    }
  ],
  sideTableConflicts: [
    { conflictId: 'st-1', table: 'user_watch', sourceRowId: 's1', targetRowId: 't1', key: 'k1' }
  ],
  sideTableCounts: {
    entityVersions: 2,
    openChangeApprovals: 0,
    openGovernanceCases: 0,
    incomingRelations: 1,
    outgoingRelations: 1,
    externalIdentitiesTransferring: 0,
    externalIdentitiesColliding: 0
  },
  blockers: [],
  truncated: false
};

describe('buildDefaultResolutions', () => {
  it('defaults every field conflict to target, including restricted ones', () => {
    const resolutions = buildDefaultResolutions(basePreview);
    expect(resolutions.fieldResolutions).toEqual({
      'core:_description': 'target',
      'data:abc123': 'target'
    });
  });

  it('defaults relation conflicts to keep_target, forcing self-relations to drop_source', () => {
    const resolutions = buildDefaultResolutions(basePreview);
    expect(resolutions.relationResolutions).toEqual({
      'rel-1': 'keep_target',
      'rel-2': 'drop_source'
    });
  });

  it('defaults side-table conflicts to keep_target', () => {
    const resolutions = buildDefaultResolutions(basePreview);
    expect(resolutions.sideTableResolutions).toEqual({ 'st-1': 'keep_target' });
  });
});

describe('isMergeBlockedHard', () => {
  it('is false when there are no blockers', () => {
    expect(isMergeBlockedHard([], new Set())).toBe(false);
  });

  it('is true for any non-acknowledgeable blocker regardless of acknowledgement', () => {
    const blockers = [
      { code: 'different_schema' as const, message: 'nope', acknowledgeable: false }
    ];
    expect(isMergeBlockedHard(blockers, new Set(['different_schema']))).toBe(true);
  });

  it('is true for an acknowledgeable blocker until it is acknowledged', () => {
    const blockers = [
      { code: 'project_scope_relocated' as const, message: 'careful', acknowledgeable: true }
    ];
    expect(isMergeBlockedHard(blockers, new Set())).toBe(true);
    expect(isMergeBlockedHard(blockers, new Set(['project_scope_relocated']))).toBe(false);
  });
});

describe('buildMergeExecuteBody', () => {
  it('replays preview versions and fingerprint verbatim alongside the resolution maps', () => {
    const resolutions = buildDefaultResolutions(basePreview);
    const body = buildMergeExecuteBody(
      basePreview,
      resolutions,
      new Set(['project_scope_relocated'])
    );
    expect(body).toEqual({
      targetId: 'target-1',
      expectedSourceVersion: 3,
      expectedTargetVersion: 5,
      previewFingerprint: 'fp-1',
      fieldResolutions: resolutions.fieldResolutions,
      relationResolutions: resolutions.relationResolutions,
      sideTableResolutions: resolutions.sideTableResolutions,
      acknowledgedBlockers: ['project_scope_relocated']
    });
  });
});

describe('formatMergeFieldValue', () => {
  it('renders an em dash for empty values', () => {
    expect(formatMergeFieldValue(null)).toBe('—');
    expect(formatMergeFieldValue(undefined)).toBe('—');
    expect(formatMergeFieldValue('')).toBe('—');
  });

  it('joins array values with a comma', () => {
    expect(formatMergeFieldValue(['a', 'b'])).toBe('a, b');
  });

  it('stringifies plain objects', () => {
    expect(formatMergeFieldValue({ a: 1 })).toBe('{"a":1}');
  });

  it('passes scalars through as strings', () => {
    expect(formatMergeFieldValue(42)).toBe('42');
  });
});

describe('formatSideTableLabel', () => {
  it('maps known tables to friendly labels', () => {
    expect(formatSideTableLabel('user_watch')).toBe('Watches');
  });

  it('falls back to the raw table name for unknown tables', () => {
    expect(formatSideTableLabel('some_new_table')).toBe('some_new_table');
  });
});

describe('reference field conflicts', () => {
  const schema = {
    id: 'schema-1',
    fields: [
      { id: 'owner_team', type: 'reference', schemaId: 'schema-2' },
      { id: 'notes', type: 'text' }
    ]
  } as unknown as EntitySchema;

  const referenceConflict = {
    fieldKey: 'data:owner_team',
    fieldName: 'Owner team',
    kind: 'data' as const,
    source: ['id-a'],
    target: ['id-b'],
    restricted: false
  };
  const scalarConflict = {
    fieldKey: 'data:notes',
    fieldName: 'Notes',
    kind: 'data' as const,
    source: 'a',
    target: 'b',
    restricted: false
  };
  const restrictedConflict = {
    fieldKey: 'data:fingerprint-1',
    fieldName: 'Owner team',
    kind: 'data' as const,
    source: null,
    target: null,
    restricted: true
  };

  it('identifies data-field conflicts whose schema field is a reference/containment type', () => {
    expect(isReferenceFieldConflict(referenceConflict, schema)).toBe(true);
    expect(isReferenceFieldConflict(scalarConflict, schema)).toBe(false);
  });

  it('never treats a restricted conflict as resolvable, even if it looks like a reference field', () => {
    expect(isReferenceFieldConflict(restrictedConflict, schema)).toBe(false);
  });

  it('falls back to false when there is no schema to check against', () => {
    expect(isReferenceFieldConflict(referenceConflict, null)).toBe(false);
  });

  it('collects every referenced id across source and target values of reference-field conflicts', () => {
    const ids = collectReferenceFieldConflictIds(
      [referenceConflict, scalarConflict, restrictedConflict],
      schema
    );
    expect(ids).toEqual(['id-a', 'id-b']);
  });

  it('formats reference values by resolving ids to names via the lookup', () => {
    const lookup = new Map([['id-a', { name: 'Team A' }]]);
    expect(formatMergeReferenceValue(['id-a', 'id-b'], lookup)).toBe('Team A, id-b');
    expect(formatMergeReferenceValue([], lookup)).toBe('—');
    expect(formatMergeReferenceValue(null, lookup)).toBe('—');
  });
});

describe('core lookup field conflicts (owner / lifecycle)', () => {
  const lookups = {
    teamNames: new Map([['team-a', 'Platform Team']]),
    lifecycleLabels: new Map([['lc-active', 'Active']])
  };

  const ownerConflict = {
    fieldKey: 'core:owner',
    fieldName: 'owner',
    kind: 'core' as const,
    source: 'team-a',
    target: 'team-b',
    restricted: false
  };
  const lifecycleConflict = {
    fieldKey: 'core:lifecycle',
    fieldName: 'lifecycle',
    kind: 'core' as const,
    source: 'lc-active',
    target: null,
    restricted: false
  };
  const nameConflict = {
    fieldKey: 'core:name',
    fieldName: 'name',
    kind: 'core' as const,
    source: 'A',
    target: 'B',
    restricted: false
  };

  it('identifies owner and lifecycle core fields as needing lookup resolution', () => {
    expect(isLookupCoreFieldConflict(ownerConflict)).toBe(true);
    expect(isLookupCoreFieldConflict(lifecycleConflict)).toBe(true);
    expect(isLookupCoreFieldConflict(nameConflict)).toBe(false);
  });

  it('resolves an owner id to the team name, falling back to the raw id when unknown', () => {
    expect(formatMergeCoreFieldValue(ownerConflict, 'team-a', lookups)).toBe('Platform Team');
    expect(formatMergeCoreFieldValue(ownerConflict, 'team-b', lookups)).toBe('team-b');
  });

  it('resolves a lifecycle id to its label', () => {
    expect(formatMergeCoreFieldValue(lifecycleConflict, 'lc-active', lookups)).toBe('Active');
  });

  it('renders an em dash for a null lookup value', () => {
    expect(formatMergeCoreFieldValue(lifecycleConflict, null, lookups)).toBe('—');
  });
});
