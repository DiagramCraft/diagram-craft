import { describe, expect, it } from 'vitest';
import type { DocumentType } from '@arch-register/api-types/documentContract';
import { buildDocumentActionPrompt } from './documentContextPromptBuilder';

const makeDocumentType = (overrides: Partial<DocumentType> = {}): DocumentType => ({
  id: 'type-1',
  workspace: 'ws-1',
  name: 'Architecture Decision Record',
  description: '',
  fields: [{ id: 'status', name: 'Status', type: 'text', requirement: 'required', retired: false }],
  color: null,
  icon: null,
  archived: false,
  version: 1,
  aiActions: [],
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
  ...overrides
});

describe('buildDocumentActionPrompt', () => {
  it('embeds title, location, document type, metadata, body, and the action prompt', () => {
    const prompt = buildDocumentActionPrompt({
      documentTitle: 'Decision.md',
      locationPath: 'adr/decision.md',
      documentType: makeDocumentType(),
      metadata: { status: 'proposed' },
      body: 'We propose to do X.',
      actionPrompt: 'Summarize the key risks.'
    });

    expect(prompt).toContain('Title: Decision.md');
    expect(prompt).toContain('Location: adr/decision.md');
    expect(prompt).toContain('Document type: Architecture Decision Record');
    expect(prompt).toContain('- Status (text): proposed');
    expect(prompt).toContain('We propose to do X.');
    expect(prompt).toContain('Summarize the key risks.');
    expect(prompt).toContain('must not modify entities, documents, or metadata');
  });

  it('handles an untyped document with no metadata', () => {
    const prompt = buildDocumentActionPrompt({
      documentTitle: 'Notes.md',
      locationPath: 'notes.md',
      documentType: null,
      metadata: {},
      body: 'Some notes.',
      actionPrompt: 'Summarize.'
    });

    expect(prompt).toContain('Document type: Untyped');
    expect(prompt).toContain('No structured metadata.');
  });

  it('excludes retired fields from the metadata summary', () => {
    const prompt = buildDocumentActionPrompt({
      documentTitle: 'Decision.md',
      locationPath: 'adr/decision.md',
      documentType: makeDocumentType({
        fields: [
          { id: 'status', name: 'Status', type: 'text', requirement: 'required', retired: false },
          { id: 'old', name: 'Old field', type: 'text', requirement: 'optional', retired: true }
        ]
      }),
      metadata: { status: 'proposed', old: 'ignored' },
      body: 'Body.',
      actionPrompt: 'Summarize.'
    });

    expect(prompt).not.toContain('Old field');
  });
});
