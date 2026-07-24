import { describe, expect, it } from 'vitest';
import type { DocumentField } from '@arch-register/api-types/documentContract';
import {
  buildSchemaChangeSummary,
  classifyFieldChanges,
  describeHardBlockedChange,
  findUnresolvedFieldMigrations,
  hardBlockedFieldChanges,
  migratableFieldChanges
} from './documentSchemaHelpers';

const text = (
  id: string,
  name: string,
  requirement: DocumentField['requirement'] = 'optional',
  retired = false
): DocumentField => ({ id, name, type: 'text', requirement, retired });

describe('classifyFieldChanges', () => {
  it('reports no changes when adding a new optional field', () => {
    const oldFields = [text('notes', 'Notes')];
    const newFields = [text('notes', 'Notes'), text('owner', 'Owner')];
    expect(classifyFieldChanges(oldFields, newFields)).toEqual([]);
  });

  it('flags a newly required field as newly-required', () => {
    const oldFields = [text('notes', 'Notes')];
    const newFields = [text('notes', 'Notes'), text('owner', 'Owner', 'required')];
    expect(classifyFieldChanges(oldFields, newFields)).toEqual([
      { fieldId: 'owner', fieldName: 'Owner', kind: 'newly-required' }
    ]);
  });

  it('flags removing a field as removed', () => {
    const oldFields = [text('notes', 'Notes'), text('owner', 'Owner')];
    const newFields = [text('notes', 'Notes')];
    expect(classifyFieldChanges(oldFields, newFields)).toEqual([
      { fieldId: 'owner', fieldName: 'Owner', kind: 'removed' }
    ]);
  });

  it('flags changing a field id (matched by name) as renamed', () => {
    const oldFields = [text('notes', 'Notes')];
    const newFields = [text('note', 'Notes')];
    expect(classifyFieldChanges(oldFields, newFields)).toEqual([
      { fieldId: 'notes', fieldName: 'Notes', kind: 'renamed', renamedToId: 'note' }
    ]);
  });

  it('flags making an optional field required as newly-required', () => {
    const oldFields = [text('notes', 'Notes', 'optional')];
    const newFields = [text('notes', 'Notes', 'required')];
    expect(classifyFieldChanges(oldFields, newFields)).toEqual([
      { fieldId: 'notes', fieldName: 'Notes', kind: 'newly-required' }
    ]);
  });

  it('flags making an expected field required as newly-required', () => {
    const oldFields = [text('notes', 'Notes', 'expected')];
    const newFields = [text('notes', 'Notes', 'required')];
    expect(classifyFieldChanges(oldFields, newFields)).toEqual([
      { fieldId: 'notes', fieldName: 'Notes', kind: 'newly-required' }
    ]);
  });

  it('reports no changes when a required field stays required', () => {
    const oldFields = [text('notes', 'Notes', 'required')];
    const newFields = [text('notes', 'Notes', 'required')];
    expect(classifyFieldChanges(oldFields, newFields)).toEqual([]);
  });

  it('flags changing a field type as type-changed', () => {
    const oldFields = [text('notes', 'Notes')];
    const newFields: DocumentField[] = [
      { id: 'notes', name: 'Notes', type: 'boolean', requirement: 'optional', retired: false }
    ];
    expect(classifyFieldChanges(oldFields, newFields)).toEqual([
      { fieldId: 'notes', fieldName: 'Notes', kind: 'type-changed' }
    ]);
  });

  it('reports no changes when renaming a field name while keeping its id', () => {
    const oldFields = [text('notes', 'Notes')];
    const newFields = [text('notes', 'Comments')];
    expect(classifyFieldChanges(oldFields, newFields)).toEqual([]);
  });

  it('reports no changes when reordering fields with no other changes', () => {
    const oldFields = [text('a', 'A'), text('b', 'B')];
    const newFields = [text('b', 'B'), text('a', 'A')];
    expect(classifyFieldChanges(oldFields, newFields)).toEqual([]);
  });
});

describe('hardBlockedFieldChanges / migratableFieldChanges', () => {
  it('splits type-changed and newly-required from removed and renamed', () => {
    const changes = classifyFieldChanges(
      [text('a', 'A'), text('b', 'B'), text('c', 'C')],
      [
        { id: 'a', name: 'A', type: 'boolean', requirement: 'optional', retired: false },
        text('d', 'D', 'required')
      ]
    );
    expect(hardBlockedFieldChanges(changes)).toEqual([
      { fieldId: 'a', fieldName: 'A', kind: 'type-changed' },
      { fieldId: 'd', fieldName: 'D', kind: 'newly-required' }
    ]);
    expect(migratableFieldChanges(changes)).toEqual([
      { fieldId: 'b', fieldName: 'B', kind: 'removed' },
      { fieldId: 'c', fieldName: 'C', kind: 'removed' }
    ]);
  });
});

describe('describeHardBlockedChange', () => {
  it('describes a type-changed field', () => {
    expect(describeHardBlockedChange({ fieldId: 'a', fieldName: 'A', kind: 'type-changed' })).toBe(
      'Field "A" cannot change type while document data exists'
    );
  });

  it('describes a newly-required field', () => {
    expect(
      describeHardBlockedChange({ fieldId: 'a', fieldName: 'A', kind: 'newly-required' })
    ).toBe('Field "A" cannot be made required while document data exists');
  });
});

describe('findUnresolvedFieldMigrations', () => {
  it('flags migratable changes with no resolution', () => {
    const changes = [
      { fieldId: 'a', fieldName: 'A', kind: 'removed' as const },
      { fieldId: 'b', fieldName: 'B', kind: 'renamed' as const, renamedToId: 'b2' }
    ];
    expect(findUnresolvedFieldMigrations(changes, { a: { action: 'remove' } })).toEqual([
      changes[1]
    ]);
  });

  it('reports nothing unresolved once every change has a migration', () => {
    const changes = [{ fieldId: 'a', fieldName: 'A', kind: 'removed' as const }];
    expect(findUnresolvedFieldMigrations(changes, { a: { action: 'archive' } })).toEqual([]);
  });
});

describe('buildSchemaChangeSummary', () => {
  it('reports every field as added when there is no previous version', () => {
    expect(buildSchemaChangeSummary(null, [text('a', 'A'), text('b', 'B')])).toEqual({
      added: ['A', 'B']
    });
  });

  it('summarizes added, removed, renamed, and archived fields', () => {
    const oldFields = [text('a', 'A'), text('b', 'B'), text('c', 'C')];
    const newFields = [text('a', 'A'), text('b2', 'B'), text('c', 'C', 'optional', true)];
    const summary = buildSchemaChangeSummary(oldFields, newFields, {
      b: { action: 'rename', renameTo: 'b2' }
    });
    expect(summary).toEqual({
      added: ['B'],
      renamed: [{ from: 'B', to: 'B' }],
      archived: ['C']
    });
  });

  it('treats a removed field without a rename resolution as removed', () => {
    const oldFields = [text('a', 'A'), text('b', 'B')];
    const newFields = [text('a', 'A')];
    expect(buildSchemaChangeSummary(oldFields, newFields, { b: { action: 'remove' } })).toEqual({
      removed: ['B']
    });
  });
});
