import { describe, expect, it } from 'vitest';
import type { EntityTemplate, SchemaField } from '@arch-register/api-types/schemaContract';
import {
  buildFieldMigrations,
  createSchemaFieldForType,
  firstRemainingId,
  removeTemplateField,
  updateTemplateFieldId
} from './schemaSettingsHelpers';

const field = (id: string): SchemaField => ({
  id,
  name: id,
  type: 'text'
});

const template = (fields: Record<string, string>): EntityTemplate => ({
  id: 'template-1',
  name: 'Template',
  values: { fields }
});

describe('schema settings helpers', () => {
  it('creates the same type-specific field defaults used by the editor', () => {
    const original = field('title');
    const input: SchemaField[] = [original, { id: 'count', name: 'count', type: 'number' }];

    expect(createSchemaFieldForType(original, 'reference', input)).toEqual({
      id: 'title',
      name: 'title',
      type: 'reference',
      predicate: '',
      schemaId: '',
      minCount: 0,
      maxCount: -1
    });
    expect(createSchemaFieldForType(original, 'derived', input)).toMatchObject({
      type: 'derived',
      requirementLevel: 'optional',
      expression: 'entity.count',
      resultType: 'text'
    });
    expect(createSchemaFieldForType(original, 'select', input, 'enum-1')).toEqual({
      id: 'title',
      name: 'title',
      type: 'select',
      enumId: 'enum-1',
      options: []
    });
  });

  it('renames and removes template defaults without mutating the source', () => {
    const original = [template({ old_id: 'value', keep: 'other' })];

    expect(updateTemplateFieldId(original, 'old_id', 'new_id')).toEqual([
      template({ new_id: 'value', keep: 'other' })
    ]);
    expect(removeTemplateField(original, 'old_id')).toEqual([template({ keep: 'other' })]);
    expect(original).toEqual([template({ old_id: 'value', keep: 'other' })]);
  });

  it('serializes remove, rename, and archive migration choices', () => {
    const pendingChanges = [
      { fieldId: 'removed', fieldName: 'Removed', kind: 'removed' as const, entityCount: 2 },
      {
        fieldId: 'renamed',
        fieldName: 'Renamed',
        kind: 'renamed' as const,
        renamedToId: 'new_name',
        entityCount: 1
      }
    ];

    expect(buildFieldMigrations(pendingChanges, { removed: 'archive', renamed: 'rename' })).toEqual(
      {
        removed: { action: 'archive' },
        renamed: { action: 'rename', renameTo: 'new_name' }
      }
    );
    expect(firstRemainingId([{ id: 'deleted' }, { id: 'remaining' }], 'deleted')).toBe('remaining');
    expect(firstRemainingId([{ id: 'deleted' }], 'deleted')).toBe('');
  });
});
