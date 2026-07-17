import { describe, expect, it } from 'vitest';
import {
  decodeDocumentBrowserEmbedConfig,
  encodeDocumentBrowserEmbedConfig
} from './DocumentBrowserEmbedCodec';
import type { DocumentBrowserEmbedConfig } from './types';

const SAFE_PROP_VALUE = /^[a-zA-Z0-9_\-.,\s]*$/;

const fullConfig: DocumentBrowserEmbedConfig = {
  q: 'architecture',
  documentTypeId: 'adr',
  conditions: [
    { fieldId: 'status', op: 'equals', value: 'accepted' },
    { fieldId: 'decisionDate', op: 'before', value: '2026-07-01' }
  ],
  sort: 'decisionDate',
  sortDir: 'asc',
  visibleBaseColumnIds: ['document_type', 'location'],
  visibleFieldIds: ['status', 'decisionDate']
};

describe('DocumentBrowserEmbedCodec', () => {
  it('round-trips a full config', () => {
    expect(decodeDocumentBrowserEmbedConfig(encodeDocumentBrowserEmbedConfig(fullConfig))).toEqual(
      fullConfig
    );
  });

  it('applies safe defaults to partial payloads', () => {
    const encoded = btoa(JSON.stringify({ q: 'docs', documentTypeId: 'none' }));
    expect(decodeDocumentBrowserEmbedConfig(encoded)).toEqual({
      q: 'docs',
      documentTypeId: 'none',
      conditions: [],
      sort: 'updated_at',
      sortDir: 'desc',
      visibleBaseColumnIds: ['document_type', 'location', 'updated_at'],
      visibleFieldIds: []
    });
  });

  it('returns null for undefined or malformed input', () => {
    expect(decodeDocumentBrowserEmbedConfig(undefined)).toBeNull();
    expect(decodeDocumentBrowserEmbedConfig('not-valid-base64url-json!!!')).toBeNull();
  });

  it('produces a value accepted by the MDX prop sanitizer', () => {
    expect(SAFE_PROP_VALUE.test(encodeDocumentBrowserEmbedConfig(fullConfig))).toBe(true);
  });
});
