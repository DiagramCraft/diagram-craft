import { describe, expect, it } from 'vitest';
import type { DocumentField } from '@arch-register/api-types/documentContract';
import type { RelationField } from '@arch-register/api-types/relationSchemaContract';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import { toFieldMigrationFields as toDocumentFields } from '../document/documentSchemaHelpers';
import { toFieldMigrationFields as toRelationFields } from '../catalog/relationSchemaHelpers';
import { toFieldMigrationFields as toSchemaFields } from '../catalog/schemaHelpers';
import {
  buildFieldChangeSummary,
  classifyFieldChanges,
  describeHardBlockedChange,
  hardBlockedFieldChanges,
  migratableFieldChanges,
  planFieldMigrations
} from './fieldMigrationPlanning';

const field = (
  id: string,
  name: string,
  options: Partial<{
    type: string;
    required: boolean;
    archived: boolean;
  }> = {}
) => ({
  id,
  name,
  type: options.type ?? 'text',
  required: options.required ?? false,
  archived: options.archived ?? false
});

describe('classifyFieldChanges', () => {
  it('ignores optional additions, display-name changes, and reordering', () => {
    expect(
      classifyFieldChanges(
        [field('a', 'A'), field('b', 'B')],
        [field('b', 'Renamed display label'), field('a', 'A'), field('c', 'C')]
      )
    ).toEqual([]);
  });

  it('classifies required, type, removed, and name-matched id changes', () => {
    expect(
      classifyFieldChanges(
        [
          field('type', 'Type'),
          field('required', 'Required'),
          field('gone', 'Gone'),
          field('old', 'Old')
        ],
        [
          field('type', 'Type', { type: 'boolean' }),
          field('required', 'Required', { required: true }),
          field('new', 'Old')
        ]
      )
    ).toEqual([
      { fieldId: 'type', fieldName: 'Type', kind: 'type-changed' },
      { fieldId: 'required', fieldName: 'Required', kind: 'newly-required' },
      { fieldId: 'gone', fieldName: 'Gone', kind: 'removed' },
      { fieldId: 'old', fieldName: 'Old', kind: 'renamed', renamedToId: 'new' }
    ]);

    expect(classifyFieldChanges([field('old', 'Old')], [field('new', 'Old')])).toEqual([
      { fieldId: 'old', fieldName: 'Old', kind: 'renamed', renamedToId: 'new' }
    ]);
  });
});

describe('field migration planning', () => {
  it('separates hard blocks and migratable changes', () => {
    const changes = classifyFieldChanges(
      [field('type', 'Type'), field('required', 'Required'), field('gone', 'Gone')],
      [
        field('type', 'Type', { type: 'boolean' }),
        field('required', 'Required', { required: true })
      ]
    );

    expect(hardBlockedFieldChanges(changes)).toEqual([
      { fieldId: 'type', fieldName: 'Type', kind: 'type-changed' },
      { fieldId: 'required', fieldName: 'Required', kind: 'newly-required' }
    ]);
    expect(migratableFieldChanges(changes)).toEqual([
      { fieldId: 'gone', fieldName: 'Gone', kind: 'removed' }
    ]);
  });

  it('builds data actions and archives without coupling to a domain executor', () => {
    const plan = planFieldMigrations(
      [field('old', 'Old'), field('gone', 'Gone'), field('archive', 'Archive')],
      [field('new', 'Old'), field('archive-new', 'Archive')],
      {
        old: { action: 'rename', renameTo: 'new' },
        gone: { action: 'remove' },
        archive: { action: 'archive' }
      }
    );

    expect(plan.unresolved).toEqual([]);
    expect(plan.dataMigrations).toEqual([
      { action: 'rename', oldFieldId: 'old', newFieldId: 'new' },
      { action: 'remove', oldFieldId: 'gone' }
    ]);
    expect(plan.archiveFieldIds).toEqual(['archive']);
  });

  it('only requires and applies decisions for the selected domain field ids', () => {
    const plan = planFieldMigrations(
      [field('used', 'Used'), field('unused', 'Unused')],
      [],
      { used: { action: 'remove' } },
      {
        decisionRequiredFieldIds: new Set(['used']),
        applicableFieldIds: new Set(['used'])
      }
    );

    expect(plan.unresolved).toEqual([]);
    expect(plan.dataMigrations).toEqual([{ action: 'remove', oldFieldId: 'used' }]);
  });

  it('preserves hard-block messages for entity and document domains', () => {
    const change = { fieldId: 'f', fieldName: 'Field', kind: 'type-changed' as const };
    expect(describeHardBlockedChange(change)).toBe(
      'Field "Field" cannot change type while entities exist'
    );
    expect(describeHardBlockedChange(change, 'document data')).toBe(
      'Field "Field" cannot change type while document data exists'
    );
  });
});

describe('buildFieldChangeSummary', () => {
  it('reports all initial fields as added', () => {
    expect(buildFieldChangeSummary(null, [field('a', 'A'), field('b', 'B')])).toEqual({
      added: ['A', 'B']
    });
  });

  it('summarizes added, removed, renamed, and archived fields', () => {
    expect(
      buildFieldChangeSummary(
        [field('a', 'A'), field('b', 'B'), field('c', 'C')],
        [field('a', 'A'), field('b2', 'B'), field('c', 'C', { archived: true })],
        { b: { action: 'rename', renameTo: 'b2' } }
      )
    ).toEqual({
      added: ['B'],
      renamed: [{ from: 'B', to: 'B' }],
      archived: ['C']
    });
  });
});

describe('domain field adapters', () => {
  it('normalizes entity schema required and archived flags', () => {
    const fields: SchemaField[] = [
      { id: 'f', name: 'Field', type: 'text', requirementLevel: 'required', archived: true }
    ];
    expect(toSchemaFields(fields)).toEqual([
      field('f', 'Field', { required: true, archived: true })
    ]);
  });

  it('normalizes relation and document requirement conventions', () => {
    const relationFields: RelationField[] = [
      { id: 'r', name: 'Relation', type: 'text', requirementLevel: 'required', archived: true }
    ];
    const documentFields: DocumentField[] = [
      { id: 'd', name: 'Document', type: 'text', requirement: 'required', retired: true }
    ];
    expect(toRelationFields(relationFields)).toEqual([
      field('r', 'Relation', { required: true, archived: true })
    ]);
    expect(toDocumentFields(documentFields)).toEqual([
      field('d', 'Document', { required: true, archived: true })
    ]);
  });
});
