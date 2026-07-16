import { describe, expect, it } from 'vitest';
import type {
  DocumentField,
  DocumentMetadata,
  DocumentTypeWrite
} from '@arch-register/api-types/documentContract';
import {
  assertDocumentMetadataValid,
  documentLinksFromMetadata,
  validateDocumentMetadata,
  validateDocumentTypeWrite
} from './documentValidation';

const makeField = (overrides: Partial<DocumentField> = {}): DocumentField => ({
  id: 'field',
  name: 'Field',
  type: 'text',
  requirement: 'optional',
  retired: false,
  ...overrides
});

const makeTypeWrite = (fields: DocumentField[]): DocumentTypeWrite => ({
  name: 'Document',
  description: '',
  fields
});

describe('validateDocumentTypeWrite', () => {
  it('accepts valid fields, enum options, and link cardinalities', () => {
    expect(() =>
      validateDocumentTypeWrite(
        makeTypeWrite([
          makeField({
            id: 'status',
            name: 'Status',
            type: 'enum',
            enumOptions: [{ value: 'draft', label: 'Draft' }]
          }),
          makeField({
            id: 'related',
            name: 'Related documents',
            type: 'document_link',
            minCardinality: 1,
            maxCardinality: 1
          })
        ])
      )
    ).not.toThrow();
  });

  it.each([
    [
      'duplicate field id',
      [makeField({ id: 'same', name: 'First' }), makeField({ id: 'same', name: 'Second' })],
      "Duplicate document field id 'same'"
    ],
    [
      'duplicate field name',
      [makeField({ id: 'first', name: 'Status' }), makeField({ id: 'second', name: 'status' })],
      "Duplicate document field name 'status'"
    ],
    [
      'invalid cardinality',
      [makeField({ id: 'range', minCardinality: 2, maxCardinality: 1 })],
      "Invalid cardinality for field 'range'"
    ],
    [
      'empty enum options',
      [makeField({ id: 'status', type: 'enum' })],
      "Enum field 'status' must define options"
    ]
  ])('rejects %s', (_case, fields, message) => {
    expect(() => validateDocumentTypeWrite(makeTypeWrite(fields))).toThrow(message);
  });
});

describe('validateDocumentMetadata', () => {
  it('accepts all supported value types and warns for missing expected values', () => {
    const fields = [
      makeField({ id: 'text', name: 'Text' }),
      makeField({ id: 'long_text', name: 'Long text', type: 'long_text' }),
      makeField({ id: 'enabled', name: 'Enabled', type: 'boolean' }),
      makeField({ id: 'date', name: 'Date', type: 'date' }),
      makeField({ id: 'score', name: 'Score', type: 'number' }),
      makeField({
        id: 'status',
        name: 'Status',
        type: 'enum',
        enumOptions: [{ value: 'draft', label: 'Draft' }]
      }),
      makeField({ id: 'entities', name: 'Entities', type: 'entity_link' }),
      makeField({ id: 'documents', name: 'Documents', type: 'document_link' }),
      makeField({ id: 'review', name: 'Review', requirement: 'expected' }),
      makeField({ id: 'retired', name: 'Retired', requirement: 'required', retired: true })
    ];
    const metadata: DocumentMetadata = {
      text: 'A short note',
      long_text: 'A longer note',
      enabled: false,
      date: '2026-07-16',
      score: 0,
      status: 'draft',
      entities: ['entity-1'],
      documents: 'document-1'
    };

    expect(validateDocumentMetadata(fields, metadata, false, true)).toEqual({
      errors: [],
      warnings: ["Field 'Review' is expected"]
    });
  });

  it.each([
    ['text', makeField({ id: 'text', name: 'Text' }), 123],
    ['long text', makeField({ id: 'long', name: 'Long', type: 'long_text' }), true],
    ['date', makeField({ id: 'date', name: 'Date', type: 'date' }), false],
    ['boolean', makeField({ id: 'enabled', name: 'Enabled', type: 'boolean' }), 'true'],
    ['number', makeField({ id: 'score', name: 'Score', type: 'number' }), Infinity],
    [
      'enum',
      makeField({
        id: 'status',
        name: 'Status',
        type: 'enum',
        enumOptions: [{ value: 'draft', label: 'Draft' }]
      }),
      'unknown'
    ],
    ['entity link', makeField({ id: 'entity', name: 'Entity', type: 'entity_link' }), ['']],
    [
      'document link',
      makeField({ id: 'document', name: 'Document', type: 'document_link' }),
      ['document-1', 42]
    ]
  ])('rejects an invalid %s value', (_case, field, value) => {
    const metadata = { [field.id]: value } as DocumentMetadata;
    expect(validateDocumentMetadata([field], metadata).errors).toEqual([
      `Field '${field.name}' has an invalid value`
    ]);
  });

  it('reports required, expected, minimum, maximum, and unknown-field violations', () => {
    const fields = [
      makeField({ id: 'required', name: 'Required', requirement: 'required' }),
      makeField({ id: 'expected', name: 'Expected', requirement: 'expected' }),
      makeField({ id: 'minimum', name: 'Minimum', minCardinality: 2 }),
      makeField({ id: 'maximum', name: 'Maximum', maxCardinality: 1 })
    ];

    const result = validateDocumentMetadata(
      fields,
      { minimum: ['one'], maximum: ['one', 'two'], stale: 'value' },
      false,
      true
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Metadata field 'stale' is not part of this document type",
        "Field 'Required' is required",
        "Field 'Required' requires at least 1 value(s)",
        "Field 'Minimum' requires at least 2 value(s)",
        "Field 'Maximum' allows at most 1 value(s)"
      ])
    );
    expect(result.warnings).toEqual(["Field 'Expected' is expected"]);
  });

  it('allows required fields to be absent when requested', () => {
    const required = makeField({ id: 'title', name: 'Title', requirement: 'required' });
    expect(validateDocumentMetadata([required], {}, true)).toEqual({ errors: [], warnings: [] });
  });

  it('asserts valid metadata and throws a bad-request error for invalid metadata', () => {
    const field = makeField({ id: 'title', name: 'Title', requirement: 'required' });
    expect(assertDocumentMetadataValid([field], { title: 'Decision' }, true)).toEqual({
      errors: [],
      warnings: []
    });
    expect(() => assertDocumentMetadataValid([field], { stale: 'value' }, true)).toThrow(
      "Metadata field 'stale' is not part of this document type"
    );
  });
});

describe('documentLinksFromMetadata', () => {
  it('normalizes scalar and array links while ignoring non-link fields and non-string values', () => {
    const fields = [
      makeField({ id: 'entity', name: 'Entity', type: 'entity_link' }),
      makeField({ id: 'documents', name: 'Documents', type: 'document_link' }),
      makeField({ id: 'title', name: 'Title' })
    ];
    const metadata = {
      entity: 'entity-1',
      documents: ['document-1', 42, 'document-2'],
      title: 'Decision'
    } as DocumentMetadata;

    expect(documentLinksFromMetadata(fields, metadata)).toEqual([
      { field_id: 'entity', target_type: 'entity', target_id: 'entity-1', position: 0 },
      { field_id: 'documents', target_type: 'document', target_id: 'document-1', position: 0 },
      { field_id: 'documents', target_type: 'document', target_id: 'document-2', position: 1 }
    ]);
  });
});
