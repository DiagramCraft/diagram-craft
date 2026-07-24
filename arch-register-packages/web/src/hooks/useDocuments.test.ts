import { describe, expect, it } from 'vitest';
import { documentPickerQueryScopes, mergeDocumentPickerResults } from './useDocuments';

describe('document picker search helpers', () => {
  it('uses one unrestricted query when all scopes are allowed', () => {
    expect(documentPickerQueryScopes()).toEqual([undefined]);
    expect(documentPickerQueryScopes(['entity', 'project', 'workspace'])).toEqual([undefined]);
  });

  it('creates one query per restricted scope', () => {
    expect(documentPickerQueryScopes(['workspace', 'entity'])).toEqual(['workspace', 'entity']);
    expect(documentPickerQueryScopes([])).toEqual([]);
  });

  it('deduplicates results and applies the picker limit', () => {
    const result = mergeDocumentPickerResults(
      [
        [{ file: { id: 'one' } }, { file: { id: 'two' } }],
        [{ file: { id: 'two' } }, { file: { id: 'three' } }]
      ],
      2
    );

    expect(result.map(document => document.file.id)).toEqual(['one', 'two']);
  });
});
