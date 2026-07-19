import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage.types';
import { runDocumentAiAction, testDocumentAiAction } from './markdownOperations';

const { requireWorkspaceCapability, requireProjectAccess } = vi.hoisted(() => ({
  requireWorkspaceCapability: vi.fn(),
  requireProjectAccess: vi.fn()
}));

const { resolveAiConfig } = vi.hoisted(() => ({
  resolveAiConfig: vi.fn()
}));

const { createAiChatTools } = vi.hoisted(() => ({
  createAiChatTools: vi.fn(() => ['read-only-tool'])
}));

const { chat } = vi.hoisted(() => ({
  chat: vi.fn(async function* () {
    yield { type: 'TEXT_MESSAGE_CONTENT', delta: 'The ' };
    yield { type: 'TEXT_MESSAGE_CONTENT', delta: 'answer.' };
  })
}));

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(async () => ({ userId: 'user-1' })),
  buildApiEntityAuthCtx: vi.fn(async () => ({ userId: 'user-1' })),
  requireEntityAction: vi.fn(),
  requireProjectAccess,
  requireProjectAction: vi.fn(),
  requireWorkspaceCapability
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

vi.mock('../ai/tanstackAiAdapter', () => ({
  resolveAiConfig,
  createAiTextAdapter: vi.fn(() => 'adapter')
}));

vi.mock('../ai/chatTools', () => ({ createAiChatTools }));

vi.mock('@tanstack/ai', () => ({ chat }));

const event = {
  context: { user: { id: 'user-1', display_name: 'User One' } }
} as unknown as AuthenticatedEvent;

const node = {
  id: 'node-1',
  workspace: 'ws-1',
  project_id: null,
  entity_id: null,
  parent_id: null,
  mount_id: null,
  path: 'notes/decision.md',
  name: 'Decision',
  role: null,
  type: 'markdown' as const,
  size_bytes: 10,
  comment_count: 0,
  unresolved_comment_count: 0,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  created_by: 'user-1',
  updated_by: 'user-1'
};

const documentType = {
  id: 'type-1',
  workspace: 'ws-1',
  name: 'ADR',
  description: '',
  fields: [
    {
      id: 'summary',
      name: 'Summary',
      type: 'text' as const,
      requirement: 'optional' as const,
      retired: false
    }
  ],
  color: null,
  icon: null,
  archived: false,
  version: 1,
  aiActions: [
    {
      id: 'summarize',
      name: 'Summarize',
      kind: 'interactive' as const,
      prompt: 'Summarize.',
      enabled: true
    },
    {
      id: 'disabled-action',
      name: 'Disabled',
      kind: 'interactive' as const,
      prompt: 'Do not run.',
      enabled: false
    },
    {
      id: 'generate-summary',
      name: 'Generate summary',
      kind: 'metadata_generator' as const,
      prompt: 'Generate the summary field.',
      enabled: true,
      outputFieldId: 'summary'
    }
  ],
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z')
};

const makeDb = (options: { withDocumentType?: boolean } = {}) =>
  ({
    project: {
      getAnyContentNodeById: vi.fn(async () => node)
    },
    document: {
      getDocumentMetadata: vi.fn(async () => ({
        workspace: 'ws-1',
        node_id: node.id,
        document_type_id: options.withDocumentType === false ? null : documentType.id,
        values: { status: 'proposed' },
        updated_at: new Date()
      })),
      getDocumentType: vi.fn(async () => (options.withDocumentType === false ? null : documentType))
    }
  }) as unknown as DatabaseAdapter;

const makeStorage = (body = 'The document body.') =>
  ({
    read: vi.fn(async () => Buffer.from(JSON.stringify({ body })))
  }) as unknown as StorageAdapter;

describe('runDocumentAiAction', () => {
  beforeEach(() => {
    requireWorkspaceCapability.mockReset().mockImplementation(() => undefined);
    requireProjectAccess.mockReset().mockImplementation(() => undefined);
    resolveAiConfig.mockReset().mockResolvedValue({
      provider: 'openai',
      model: 'test-model',
      temperature: 0.3
    });
    createAiChatTools.mockClear();
    chat.mockClear();
  });

  it('streams deltas followed by a done event with the full answer', async () => {
    const db = makeDb();
    const storage = makeStorage();

    const generator = await runDocumentAiAction(db, storage, 'ws-1', 'node-1', 'summarize', event);
    const events = [];
    for await (const event of generator) events.push(event);

    expect(events).toEqual([
      { type: 'delta', delta: 'The ' },
      { type: 'delta', delta: 'answer.' },
      {
        type: 'done',
        actionId: 'summarize',
        actionName: 'Summarize',
        prompt: 'Summarize.',
        answer: 'The answer.',
        documentTitle: 'Decision',
        nodeId: 'node-1'
      }
    ]);
    expect(createAiChatTools).toHaveBeenCalledWith(
      db,
      'ws-1',
      { userId: 'user-1' },
      { id: 'user-1', displayName: 'User One' },
      { readOnly: true }
    );
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({ tools: ['read-only-tool'], stream: true })
    );
  });

  it('denies a viewer without workspace content access', async () => {
    requireWorkspaceCapability.mockImplementation(() => {
      throw new Error('forbidden');
    });
    const db = makeDb();
    const storage = makeStorage();

    await expect(
      runDocumentAiAction(db, storage, 'ws-1', 'node-1', 'summarize', event)
    ).rejects.toThrow();
    expect(chat).not.toHaveBeenCalled();
  });

  it('rejects a disabled action', async () => {
    const db = makeDb();
    const storage = makeStorage();

    await expect(
      runDocumentAiAction(db, storage, 'ws-1', 'node-1', 'disabled-action', event)
    ).rejects.toThrow();
  });

  it('rejects an enabled metadata_generator action (not runnable as interactive)', async () => {
    const db = makeDb();
    const storage = makeStorage();

    await expect(
      runDocumentAiAction(db, storage, 'ws-1', 'node-1', 'generate-summary', event)
    ).rejects.toThrow();
    expect(chat).not.toHaveBeenCalled();
  });

  it('rejects an unknown action id', async () => {
    const db = makeDb();
    const storage = makeStorage();

    await expect(
      runDocumentAiAction(db, storage, 'ws-1', 'node-1', 'missing', event)
    ).rejects.toThrow();
  });

  it('fails when AI is not configured for the workspace', async () => {
    resolveAiConfig.mockResolvedValue(null);
    const db = makeDb();
    const storage = makeStorage();

    await expect(
      runDocumentAiAction(db, storage, 'ws-1', 'node-1', 'summarize', event)
    ).rejects.toThrow();
    expect(chat).not.toHaveBeenCalled();
  });

  it('tests an unsaved interactive action and returns diagnostics without persistence', async () => {
    const db = makeDb();
    const storage = makeStorage();
    const generator = await testDocumentAiAction(
      db,
      storage,
      'ws-1',
      'node-1',
      'type-1',
      {
        id: 'draft-action',
        name: 'Draft action',
        kind: 'interactive',
        prompt: 'Use the draft prompt.',
        enabled: false
      },
      event
    );
    const events = [];
    for await (const next of generator) events.push(next);

    expect(events).toEqual([
      { type: 'delta', delta: 'The ' },
      { type: 'delta', delta: 'answer.' },
      expect.objectContaining({
        type: 'done',
        actionId: 'draft-action',
        actionName: 'Draft action',
        kind: 'interactive',
        rawOutput: 'The answer.',
        parsedValue: null,
        status: 'success',
        provider: 'openai',
        model: 'test-model',
        errors: [],
        toolCalls: []
      })
    ]);
    expect(createAiChatTools).toHaveBeenCalledWith(
      db,
      'ws-1',
      { userId: 'user-1' },
      { id: 'user-1', displayName: 'User One' },
      { readOnly: true }
    );
  });

  it('tests metadata-generator actions with structured output', async () => {
    chat.mockImplementation((async (options: { outputSchema?: unknown }) =>
      options.outputSchema
        ? {
            value: 'Generated summary',
            reason: 'The document contains a concise decision.',
            findings: ['The decision is stated in the document body.']
          }
        : 'Generated summary') as never);
    const generator = await testDocumentAiAction(
      makeDb(),
      makeStorage(),
      'ws-1',
      'node-1',
      'type-1',
      documentType.aiActions[2]!,
      event
    );
    const events = [];
    for await (const next of generator) events.push(next);

    expect(events).toEqual([
      expect.objectContaining({
        type: 'done',
        kind: 'metadata_generator',
        rawOutput: JSON.stringify({
          value: 'Generated summary',
          reason: 'The document contains a concise decision.',
          findings: ['The decision is stated in the document body.']
        }),
        parsedValue: 'Generated summary',
        outputFieldId: 'summary',
        status: 'success',
        errors: []
      })
    ]);
    expect(chat).toHaveBeenCalledWith(expect.objectContaining({ outputSchema: expect.anything() }));
  });

  it('rejects testing a document from another document type', async () => {
    const db = makeDb();
    const storage = makeStorage();

    await expect(
      testDocumentAiAction(
        db,
        storage,
        'ws-1',
        'node-1',
        'other-type',
        {
          id: 'draft-action',
          name: 'Draft action',
          kind: 'interactive',
          prompt: 'Use the draft prompt.',
          enabled: true
        },
        event
      )
    ).rejects.toThrow('does not use the document type being edited');
    expect(chat).not.toHaveBeenCalled();
  });
});
