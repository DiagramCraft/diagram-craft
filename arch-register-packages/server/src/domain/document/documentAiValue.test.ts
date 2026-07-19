import { describe, expect, it } from 'vitest';
import type { DocumentField } from '@arch-register/api-types/documentContract';
import {
  documentMetadataGenerationOutputSchema,
  parseGeneratedResponse,
  parseGeneratedValue
} from './documentAiValue';

const field = (
  type: DocumentField['type'],
  overrides: Partial<DocumentField> = {}
): DocumentField => ({
  id: 'field-1',
  name: 'Field',
  type,
  requirement: 'optional',
  retired: false,
  ...overrides
});

describe('document metadata AI values', () => {
  it('creates field-aware structured output schemas', () => {
    const schema = documentMetadataGenerationOutputSchema(
      field('enum', {
        enumOptions: [
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' }
        ]
      })
    );

    expect(
      schema.safeParse({
        value: 'approved',
        reason: 'The document records approval.',
        findings: ['Approval is recorded in the decision section.']
      }).success
    ).toBe(true);
    expect(
      schema.safeParse({
        value: 'unknown',
        reason: 'The document records approval.',
        findings: []
      }).success
    ).toBe(false);
  });

  it('parses the structured envelope and preserves explanation and findings', () => {
    expect(
      parseGeneratedResponse(
        field('number'),
        JSON.stringify({
          value: 42,
          reason: 'The document states the target is 42.',
          findings: ['The target value appears in the requirements.']
        })
      )
    ).toEqual({
      ok: true,
      value: 42,
      explanation: 'The document states the target is 42.',
      findings: ['The target value appears in the requirements.']
    });
  });

  it('falls back to the legacy bare value format', () => {
    expect(parseGeneratedResponse(field('boolean'), 'true')).toEqual({
      ok: true,
      value: true,
      explanation: null,
      findings: []
    });
  });

  it('rejects an envelope value that does not match the target field', () => {
    expect(
      parseGeneratedResponse(
        field('number'),
        JSON.stringify({ value: 'not a number', reason: 'No reason', findings: [] })
      )
    ).toEqual({ ok: false, error: 'Expected a number, got "not a number"' });
  });

  it('keeps strict legacy parsing behavior', () => {
    expect(
      parseGeneratedValue(field('enum', { enumOptions: [{ value: 'a', label: 'A' }] }), 'b')
    ).toEqual({
      ok: false,
      error: 'Expected one of the enum values, got "b"'
    });
  });
});
