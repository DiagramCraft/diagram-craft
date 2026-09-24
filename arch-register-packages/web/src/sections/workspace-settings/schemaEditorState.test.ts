import { describe, expect, it } from 'vitest';
import type { PendingFieldChange } from '@arch-register/api-types/schemaContract';
import { buildFieldMigrations, firstRemainingId } from './schemaEditorState';

describe('buildFieldMigrations', () => {
  const pendingChanges: PendingFieldChange[] = [
    { fieldId: 'old_field', fieldName: 'Old field', kind: 'removed', entityCount: 2 },
    {
      fieldId: 'renamed_field',
      fieldName: 'Renamed field',
      kind: 'renamed',
      entityCount: 1,
      renamedToId: 'new_name'
    }
  ];

  it('defaults an unresolved field to remove', () => {
    expect(buildFieldMigrations(pendingChanges, {})).toEqual({
      old_field: { action: 'remove' },
      renamed_field: { action: 'remove' }
    });
  });

  it('uses the chosen action, carrying the rename target when renaming', () => {
    expect(
      buildFieldMigrations(pendingChanges, { old_field: 'archive', renamed_field: 'rename' })
    ).toEqual({
      old_field: { action: 'archive' },
      renamed_field: { action: 'rename', renameTo: 'new_name' }
    });
  });
});

describe('firstRemainingId', () => {
  it('returns the first item whose id is not the deleted one', () => {
    expect(firstRemainingId([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 'a')).toBe('b');
  });

  it('returns an empty string when nothing remains', () => {
    expect(firstRemainingId([{ id: 'a' }], 'a')).toBe('');
  });
});
