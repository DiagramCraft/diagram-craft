import { describe, expect, it } from 'vitest';
import {
  buildExtractCommitInput,
  normalizeExtractedEntities,
  updateExtractRow
} from './extractReviewState';

describe('extract review state', () => {
  it('normalizes dynamic AI output safely', () => {
    expect(
      normalizeExtractedEntities([{ name: 'A', schema_id: 's', confidence: 0.8 }])[0]
    ).toMatchObject({ id: 'extract-0', name: 'A', schema_id: 's', accepted: true });
    expect(normalizeExtractedEntities([null])[0]).toMatchObject({ name: '', fields: {} });
  });

  it('updates only the selected row and commits accepted rows', () => {
    const rows = normalizeExtractedEntities([
      { name: 'A', schema_id: 's' },
      { name: 'B', schema_id: 's' }
    ]);
    const updated = updateExtractRow(rows, 'extract-1', row => ({ ...row, accepted: false }));
    expect(buildExtractCommitInput(updated)).toEqual([{ name: 'A', schemaId: 's', fields: {} }]);
  });
});
