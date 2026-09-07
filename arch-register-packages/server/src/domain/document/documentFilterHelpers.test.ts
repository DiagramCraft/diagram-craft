import { describe, expect, it } from 'vitest';
import type { DocumentMetadata } from '@arch-register/api-types/documentContract';
import { matchesDocumentCondition, type DocumentListCandidate } from './documentFilterHelpers';

const candidate = (metadata: DocumentMetadata): DocumentListCandidate => ({
  title: 'Architecture note',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  documentTypeId: 'note',
  metadata
});

describe('document membership filters', () => {
  it('matches scalar and string-array metadata values', () => {
    expect(
      matchesDocumentCondition(candidate({ status: 'active', regions: ['eu', 'us'] }), {
        fieldId: 'status',
        op: 'in',
        value: ['paused', 'active']
      })
    ).toBe(true);
    expect(
      matchesDocumentCondition(candidate({ status: 'active', regions: ['eu', 'us'] }), {
        fieldId: 'regions',
        op: 'in',
        value: ['apac', 'us']
      })
    ).toBe(true);
  });

  it('fails closed for empty and malformed membership values', () => {
    expect(
      matchesDocumentCondition(candidate({ status: 'active' }), {
        fieldId: 'status',
        op: 'in',
        value: []
      })
    ).toBe(false);
    expect(
      matchesDocumentCondition(candidate({ status: 'active' }), {
        fieldId: 'status',
        op: 'in',
        value: 'active' as never
      })
    ).toBe(false);
  });
});
