import { describe, expect, it } from 'vitest';
import { projectContract } from './projectContract';

describe('document AI action test contract', () => {
  it('accepts a draft disabled metadata generator action', () => {
    const inputSchema = projectContract.projects.testDocumentAiAction['~orpc'].inputSchema;
    if (!inputSchema) throw new Error('Test action input schema is not defined');

    const parsed = inputSchema.parse({
      params: { workspace: 'workspace-1', nodeId: 'node-1' },
      body: {
        documentTypeId: 'type-1',
        action: {
          id: 'generator-1',
          name: 'Generate status',
          kind: 'metadata_generator',
          prompt: 'Choose the current status.',
          outputFieldId: 'status',
          enabled: false
        }
      }
    });

    expect(parsed.body.action.enabled).toBe(false);
    expect(parsed.body.action.kind).toBe('metadata_generator');
  });
});
