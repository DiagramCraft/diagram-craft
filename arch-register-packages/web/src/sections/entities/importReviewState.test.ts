import { describe, expect, it } from 'vitest';
import {
  buildImportCommitEntities,
  formatImportFieldLabel,
  formatImportValue,
  getChangedImportFields,
  getImportDetailEntries,
  hasActualChanges,
  isEmptyImportValue,
  normalizeImportValue,
  toImportReviewRow,
  type ImportReviewRow
} from './importReviewState';

const entity = { _name: 'Payments', owner: 'platform', tags: ['critical'] };

const row = (overrides: Partial<ImportReviewRow> = {}): ImportReviewRow => ({
  rowNumber: 1,
  errors: [],
  entity,
  accepted: true,
  expanded: false,
  isUpdate: false,
  hasChanges: true,
  matchType: 'none',
  nameMatches: [],
  ...overrides
});

describe('import review state', () => {
  it('treats empty values as equivalent when comparing updates', () => {
    expect(normalizeImportValue('')).toBeNull();
    expect(normalizeImportValue(undefined)).toBeNull();
    expect(hasActualChanges({ name: '' }, { name: null })).toBe(false);
    expect(hasActualChanges({ name: 'New' }, { name: 'Old' })).toBe(true);
    expect(hasActualChanges({ _schemaId: 'new' }, { _schemaId: 'old' })).toBe(false);
  });

  it('groups only changed metadata and custom fields', () => {
    expect(
      getChangedImportFields(
        { _name: 'New', _owner: '', owner: 'new', unchanged: 'same' },
        { _name: 'Old', _owner: null, owner: 'old', unchanged: 'same' }
      )
    ).toEqual({ metadata: ['_name'], custom: ['owner'] });
  });

  it('initializes review acceptance from errors, matches, changes, and constraints', () => {
    expect(toImportReviewRow({ rowNumber: 1, errors: [], entity, isUpdate: false })).toMatchObject({
      accepted: true,
      matchType: 'none',
      expanded: false,
      nameMatches: []
    });
    expect(
      toImportReviewRow({ rowNumber: 2, errors: [], entity, isUpdate: true, existingEntity: entity })
    ).toMatchObject({ accepted: false, hasChanges: false });
    expect(
      toImportReviewRow({
        rowNumber: 3,
        errors: [],
        entity,
        isUpdate: false,
        matchType: 'name',
        nameMatches: [{ id: 'existing', name: 'Payments' }]
      })
    ).toMatchObject({ accepted: false, matchType: 'name' });
    expect(
      toImportReviewRow({
        rowNumber: 4,
        errors: [],
        entity,
        isUpdate: false,
        constraintViolations: [{ type: 'duplicate_slug', message: 'Duplicate' }]
      })
    ).toMatchObject({ accepted: false });
  });

  it('builds commit entities with the correct existing-ID policy', () => {
    const rows = [
      row({ matchType: 'id', existingId: 'id-match' }),
      row({ rowNumber: 2, matchType: 'slug', existingId: 'slug-match' }),
      row({
        rowNumber: 3,
        matchType: 'name',
        userChoice: 'update',
        nameMatches: [{ id: 'name-match', name: 'Payments' }]
      }),
      row({ rowNumber: 4, matchType: 'name', userChoice: 'create' }),
      row({ rowNumber: 5, accepted: false })
    ];

    expect(buildImportCommitEntities(rows, 'service')).toEqual([
      { ...entity, _schemaId: 'service', _existingId: 'id-match' },
      { ...entity, _schemaId: 'service', _existingId: 'slug-match' },
      { ...entity, _schemaId: 'service', _existingId: 'name-match' },
      { ...entity, _schemaId: 'service' }
    ]);
  });

  it('prepares sorted detail entries and display formatting', () => {
    expect(getImportDetailEntries({ z: 1, _name: 'Name', empty: '', _owner: 'Owner' })).toEqual({
      metadata: [['_name', 'Name'], ['_owner', 'Owner']],
      custom: [['z', 1]]
    });
    expect(formatImportFieldLabel('_owner')).toBe('Owner');
    expect(formatImportFieldLabel('owner')).toBe('owner');
    expect(formatImportValue(['a', 'b'])).toBe('a, b');
    expect(isEmptyImportValue('')).toBe(true);
    expect(isEmptyImportValue(0)).toBe(false);
  });
});
