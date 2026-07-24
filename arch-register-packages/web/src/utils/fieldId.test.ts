import { describe, expect, it } from 'vitest';
import { toFieldId } from './fieldId';

describe('toFieldId', () => {
  it('normalizes names using the field ID contract', () => {
    expect(toFieldId('  Target Lifecycle Date  ')).toBe('target_lifecycle_date');
    expect(toFieldId('Field / with punctuation')).toBe('field_with_punctuation');
    expect(toFieldId('___Already_Normalized___')).toBe('already_normalized');
  });
});
