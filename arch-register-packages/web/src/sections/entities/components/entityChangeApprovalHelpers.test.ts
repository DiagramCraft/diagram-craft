import { describe, expect, it } from 'vitest';
import type { EntityChangeApprovalRevision } from '@arch-register/api-types/entityChangeContract';
import { changeApprovalDiffRows, formatChangeApprovalValue } from './entityChangeApprovalHelpers';

describe('formatChangeApprovalValue', () => {
  it('formats empty, arrays, named objects, and nested objects', () => {
    expect(formatChangeApprovalValue(null)).toBe('Empty');
    expect(formatChangeApprovalValue(['one', 'two'])).toBe('one, two');
    expect(formatChangeApprovalValue({ name: 'Named value', ignored: true })).toBe('Named value');
    expect(formatChangeApprovalValue({ target_date: '2026-08-10' })).toBe(
      'Target Date: 2026-08-10'
    );
  });
});

describe('changeApprovalDiffRows', () => {
  it('expands changed entity fields and preserves top-level field labels', () => {
    const revision = {
      diff: {
        name: { before: 'Before', after: 'After' },
        data: {
          before: { unchanged: 'same', removed: 'old', changed_field: 'before' },
          after: { unchanged: 'same', added: 'new', changed_field: 'after' }
        }
      }
    } as unknown as EntityChangeApprovalRevision;

    expect(changeApprovalDiffRows(revision)).toEqual([
      { field: 'Name', before: 'Before', after: 'After' },
      { field: 'Entity field · Removed', before: 'old', after: undefined },
      { field: 'Entity field · Changed Field', before: 'before', after: 'after' },
      { field: 'Entity field · Added', before: undefined, after: 'new' }
    ]);
  });
});
