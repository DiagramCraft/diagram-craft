import { describe, expect, it } from 'vitest';
import {
  documentContract,
  documentEnumOptionSchema,
  documentFieldSchema,
  documentFieldTypeSchema,
  documentMetadataSchema,
  documentRequirementSchema,
  documentTemplateSchema,
  documentTypeSchema
} from './documentContract';

describe('document field schemas', () => {
  it('accepts supported field types and defaults retired to false', () => {
    expect(documentFieldTypeSchema.options).toEqual([
      'text',
      'long_text',
      'boolean',
      'date',
      'number',
      'enum',
      'entity_link',
      'document_link'
    ]);
    expect(documentRequirementSchema.options).toEqual(['required', 'expected', 'optional']);
    expect(
      documentFieldSchema.parse({
        id: 'status',
        name: 'Status',
        type: 'enum',
        requirement: 'required',
        enumOptions: [{ value: 'draft', label: 'Draft' }]
      })
    ).toEqual({
      id: 'status',
      name: 'Status',
      type: 'enum',
      requirement: 'required',
      enumOptions: [{ value: 'draft', label: 'Draft' }],
      retired: false
    });
  });

  it('rejects empty identifiers, invalid cardinalities, and malformed enum options', () => {
    expect(
      documentFieldSchema.safeParse({
        id: '',
        name: 'Status',
        type: 'text',
        requirement: 'optional'
      }).success
    ).toBe(false);
    expect(
      documentFieldSchema.safeParse({
        id: 'status',
        name: 'Status',
        type: 'text',
        requirement: 'optional',
        minCardinality: -1
      }).success
    ).toBe(false);
    expect(documentEnumOptionSchema.safeParse({ value: '', label: 'Draft' }).success).toBe(false);
  });
});

describe('document metadata schemas', () => {
  it('accepts scalar values, null, and string arrays', () => {
    const metadata = {
      title: 'Decision',
      score: 3,
      approved: false,
      affected_entities: ['entity-1', 'entity-2'],
      superseded_by: null
    };
    expect(documentMetadataSchema.parse(metadata)).toEqual(metadata);
  });

  it('rejects unsupported nested metadata values', () => {
    expect(documentMetadataSchema.safeParse({ owner: { id: 'entity-1' } }).success).toBe(false);
  });
});

describe('document response schemas', () => {
  const field = {
    id: 'status',
    name: 'Status',
    type: 'enum' as const,
    requirement: 'required' as const,
    enumOptions: [{ value: 'draft', label: 'Draft' }],
    retired: false
  };

  it('validates document types and templates with nullable links', () => {
    const type = {
      id: 'type-1',
      workspace: 'workspace-1',
      name: 'ADR',
      description: 'Architecture decision record',
      fields: [field],
      color: null,
      icon: null,
      archived: false,
      created_at: '2026-07-16T12:00:00.000Z',
      updated_at: '2026-07-16T12:00:00.000Z'
    };
    expect(documentTypeSchema.parse(type)).toEqual(type);
    expect(
      documentTemplateSchema.parse({
        id: 'template-1',
        workspace: 'workspace-1',
        project_id: null,
        name: 'ADR',
        body: '# {{title}}',
        document_type_id: 'type-1',
        metadata_defaults: { status: 'draft' },
        archived: false,
        created_at: '2026-07-16T12:00:00.000Z',
        updated_at: '2026-07-16T12:00:00.000Z'
      })
    ).toMatchObject({ project_id: null, document_type_id: 'type-1' });
  });
});

describe('document list request schemas', () => {
  it('normalizes serialized boolean query values', () => {
    const inputSchema = documentContract.documentTypes.list['~orpc'].inputSchema;
    if (!inputSchema) throw new Error('Document list input schema is not defined');
    const params = { workspace: 'workspace-1' };

    expect(inputSchema.parse({ params, query: { include_archived: 'true' } }).query).toEqual({
      include_archived: true
    });
    expect(inputSchema.parse({ params, query: { include_archived: 'false' } }).query).toEqual({
      include_archived: false
    });
    expect(inputSchema.parse({ params, query: { include_archived: true } }).query).toEqual({
      include_archived: true
    });
    expect(inputSchema.parse({ params, query: {} }).query).toEqual({
      include_archived: undefined
    });
  });
});
