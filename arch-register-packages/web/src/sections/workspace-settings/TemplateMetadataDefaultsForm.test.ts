import { describe, expect, it } from 'vitest';
import type { DocumentType } from '@arch-register/api-types/documentContract';
import { pruneDefaultsForType } from './TemplateMetadataDefaultsForm';

const typeWith = (fields: Array<{ id: string; retired?: boolean }>) =>
  ({ fields: fields.map(f => ({ retired: false, ...f })) }) as unknown as DocumentType;

describe('pruneDefaultsForType', () => {
  it('keeps defaults for active fields of the type', () => {
    expect(pruneDefaultsForType({ a: 'x', b: 1 }, typeWith([{ id: 'a' }, { id: 'b' }]))).toEqual({
      a: 'x',
      b: 1
    });
  });

  it('drops unknown and retired fields', () => {
    const type = typeWith([{ id: 'a' }, { id: 'b', retired: true }]);
    expect(pruneDefaultsForType({ a: 'x', b: 1, c: true }, type)).toEqual({ a: 'x' });
  });

  it('drops everything when no type is given', () => {
    expect(pruneDefaultsForType({ a: 'x' }, undefined)).toEqual({});
  });
});
