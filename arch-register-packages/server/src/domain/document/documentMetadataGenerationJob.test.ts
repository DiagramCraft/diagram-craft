import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage.types';
import {
  createDocumentMetadataGenerationScanJobHandler,
  scheduleMetadataGenerationForDocument
} from './documentMetadataGenerationJob';
import {
  METADATA_GENERATION_DEBOUNCE_MS,
  METADATA_GENERATION_SCAN_INTERVAL_MINUTES,
  METADATA_GENERATION_SCAN_JOB_TYPE
} from './aiMetadataGenerationConstants';

const { buildApiEntityAuthCtx } = vi.hoisted(() => ({
  buildApiEntityAuthCtx: vi.fn(async () => ({ userId: 'user-1' }))
}));

const { resolveAiConfig } = vi.hoisted(() => ({
  resolveAiConfig: vi.fn()
}));

const { createAiChatTools } = vi.hoisted(() => ({
  createAiChatTools: vi.fn(() => ['read-only-tool'])
}));

const { chat } = vi.hoisted(() => ({
  chat: vi.fn()
}));

const { createJobSchedule, updateJobSchedule } = vi.hoisted(() => ({
  createJobSchedule: vi.fn(),
  updateJobSchedule: vi.fn()
}));

vi.mock('../auth/authorization', () => ({ buildApiEntityAuthCtx }));
vi.mock('../ai/tanstackAiAdapter', () => ({
  resolveAiConfig,
  createAiTextAdapter: vi.fn(() => 'adapter')
}));
vi.mock('../ai/chatTools', () => ({ createAiChatTools }));
vi.mock('@tanstack/ai', () => ({ chat }));
vi.mock('../jobs/jobOperations', () => ({ createJobSchedule, updateJobSchedule }));

const chatAnswer = (text: string) =>
  vi.fn(async function* () {
    yield { type: 'TEXT_MESSAGE_CONTENT', delta: text };
  });

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
  version: 3,
  aiActions: [
    {
      id: 'gen-1',
      name: 'Summarizer',
      kind: 'metadata_generator' as const,
      prompt: 'Summarize the document.',
      enabled: true,
      outputFieldId: 'summary'
    },
    {
      id: 'gen-disabled',
      name: 'Disabled generator',
      kind: 'metadata_generator' as const,
      prompt: 'Do not run.',
      enabled: false,
      outputFieldId: 'summary'
    },
    {
      id: 'interactive-1',
      name: 'Ask AI',
      kind: 'interactive' as const,
      prompt: 'Ask.',
      enabled: true
    }
  ],
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z')
};

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

const user = {
  id: 'user-1',
  user_id: 'user-1',
  email: 'user@example.com',
  display_name: 'User One',
  auth_provider: 'local' as const,
  password_hash: null,
  oidc_issuer: null,
  oidc_subject: null,
  is_active: true,
  is_system_actor: false,
  color: null,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  last_login_at: null
};

const scheduleRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  workspace: 'ws-1',
  node_id: 'node-1',
  action_id: 'gen-1',
  run_after_at: new Date('2026-01-01T00:10:00Z'),
  source_revision: 5,
  generator_version: 3,
  scheduled_by_user_id: 'user-1',
  attempt_count: 0,
  updated_at: new Date('2026-01-01T00:00:00Z'),
  ...overrides
});

describe('scheduleMetadataGenerationForDocument', () => {
  beforeEach(() => {
    createJobSchedule.mockClear();
    updateJobSchedule.mockClear();
  });

  it('does nothing when there are no enabled metadata generators', async () => {
    const upsertPendingMetadataGeneration = vi.fn();
    const db = {
      jobs: { listSchedules: vi.fn(async () => []) },
      document: { upsertPendingMetadataGeneration }
    } as unknown as DatabaseAdapter;

    await scheduleMetadataGenerationForDocument(db, {
      workspace: 'ws-1',
      nodeId: 'node-1',
      documentType: { aiActions: [documentType.aiActions[2]!], version: 3 },
      sourceRevision: 5,
      scheduledByUserId: 'user-1',
      now: new Date('2026-01-01T00:00:00Z')
    });

    expect(upsertPendingMetadataGeneration).not.toHaveBeenCalled();
    expect(createJobSchedule).not.toHaveBeenCalled();
  });

  it('upserts a pending row per enabled generator and bootstraps the scan schedule once', async () => {
    const upsertPendingMetadataGeneration = vi.fn();
    const listSchedules = vi.fn(async () => []);
    const db = {
      jobs: { listSchedules },
      document: { upsertPendingMetadataGeneration }
    } as unknown as DatabaseAdapter;

    const now = new Date('2026-01-01T00:00:00Z');
    await scheduleMetadataGenerationForDocument(db, {
      workspace: 'ws-1',
      nodeId: 'node-1',
      documentType,
      sourceRevision: 5,
      scheduledByUserId: 'user-1',
      now
    });

    expect(upsertPendingMetadataGeneration).toHaveBeenCalledTimes(1);
    expect(upsertPendingMetadataGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: 'ws-1',
        node_id: 'node-1',
        action_id: 'gen-1',
        run_after_at: new Date(now.getTime() + METADATA_GENERATION_DEBOUNCE_MS),
        source_revision: 5,
        generator_version: 3,
        scheduled_by_user_id: 'user-1',
        attempt_count: 0
      })
    );
    expect(createJobSchedule).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        workspace: 'ws-1',
        jobType: METADATA_GENERATION_SCAN_JOB_TYPE,
        recurrence: {
          type: 'minutes',
          intervalMinutes: METADATA_GENERATION_SCAN_INTERVAL_MINUTES,
          startsAt: now
        }
      }),
      now
    );
  });

  it('skips bootstrapping the scan schedule when one already exists with the current interval', async () => {
    const listSchedules = vi.fn(async () => [
      {
        id: 'schedule-1',
        job_type: METADATA_GENERATION_SCAN_JOB_TYPE,
        recurrence: {
          type: 'minutes' as const,
          intervalMinutes: METADATA_GENERATION_SCAN_INTERVAL_MINUTES,
          startsAt: new Date('2026-01-01T00:00:00Z')
        }
      }
    ]);
    const db = {
      jobs: { listSchedules },
      document: { upsertPendingMetadataGeneration: vi.fn() }
    } as unknown as DatabaseAdapter;

    await scheduleMetadataGenerationForDocument(db, {
      workspace: 'ws-1',
      nodeId: 'node-1',
      documentType,
      sourceRevision: 5,
      scheduledByUserId: 'user-1',
      now: new Date('2026-01-01T00:00:00Z')
    });

    expect(createJobSchedule).not.toHaveBeenCalled();
    expect(updateJobSchedule).not.toHaveBeenCalled();
  });

  it('self-heals a schedule left over from a previous scan interval', async () => {
    const listSchedules = vi.fn(async () => [
      {
        id: 'schedule-1',
        job_type: METADATA_GENERATION_SCAN_JOB_TYPE,
        recurrence: {
          type: 'minutes' as const,
          intervalMinutes: METADATA_GENERATION_SCAN_INTERVAL_MINUTES + 3,
          startsAt: new Date('2020-01-01T00:00:00Z')
        }
      }
    ]);
    const db = {
      jobs: { listSchedules },
      document: { upsertPendingMetadataGeneration: vi.fn() }
    } as unknown as DatabaseAdapter;

    const now = new Date('2026-01-01T00:00:00Z');
    await scheduleMetadataGenerationForDocument(db, {
      workspace: 'ws-1',
      nodeId: 'node-1',
      documentType,
      sourceRevision: 5,
      scheduledByUserId: 'user-1',
      now
    });

    expect(createJobSchedule).not.toHaveBeenCalled();
    expect(updateJobSchedule).toHaveBeenCalledWith(
      db,
      'schedule-1',
      {
        recurrence: {
          type: 'minutes',
          intervalMinutes: METADATA_GENERATION_SCAN_INTERVAL_MINUTES,
          startsAt: now
        }
      },
      now
    );
  });
});

describe('createDocumentMetadataGenerationScanJobHandler', () => {
  beforeEach(() => {
    resolveAiConfig.mockReset().mockResolvedValue({ temperature: 0.2 });
    createAiChatTools.mockClear();
    chat.mockClear();
  });

  const makeStorage = (body = 'The document body.') =>
    ({
      read: vi.fn(async () => Buffer.from(JSON.stringify({ body })))
    }) as unknown as StorageAdapter;

  it('writes a validated value and creates an AI-authored revision on success', async () => {
    chat.mockImplementation(chatAnswer('Great summary'));
    const upsertDocumentMetadata = vi.fn();
    const createMarkdownRevision = vi.fn();
    const upsertPendingMetadataGeneration = vi.fn();
    const db = {
      document: {
        claimDueMetadataGenerations: vi.fn(async () => [scheduleRow()]),
        getDocumentMetadata: vi.fn(async () => ({
          workspace: 'ws-1',
          node_id: 'node-1',
          document_type_id: 'type-1',
          values: {},
          generated_metadata: {},
          updated_at: new Date()
        })),
        getDocumentType: vi.fn(async () => documentType),
        upsertDocumentMetadata,
        upsertPendingMetadataGeneration
      },
      project: {
        getAnyContentNodeById: vi.fn(async () => node),
        getNextMarkdownRevisionNumber: vi.fn(async () => 6),
        createMarkdownRevision
      },
      auth: { getUser: vi.fn(async () => user) },
      core: { transaction: vi.fn(async (cb: (tx: DatabaseAdapter) => unknown) => cb(db as never)) }
    } as unknown as DatabaseAdapter;

    const handler = createDocumentMetadataGenerationScanJobHandler(db, makeStorage());
    const result = await handler({ jobId: 'job-1', workspace: 'ws-1', payload: {} });

    expect(result).toEqual({
      processed: 1,
      success: 1,
      failed: 0,
      retrying: 0,
      discarded: 0,
      skipped: 0
    });
    expect(upsertDocumentMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        values: { summary: 'Great summary' },
        generated_metadata: expect.objectContaining({
          summary: expect.objectContaining({ status: 'success', fieldId: 'summary' })
        })
      })
    );
    expect(createMarkdownRevision).toHaveBeenCalledWith(
      expect.objectContaining({ created_by: '00000000-0000-0000-0000-0000000000a1' })
    );
    expect(upsertPendingMetadataGeneration).not.toHaveBeenCalled();
  });

  it('ignores reasoning/thinking chunks and only uses the final answer text', async () => {
    chat.mockImplementation(
      vi.fn(async function* () {
        yield {
          type: 'REASONING_MESSAGE_CONTENT',
          delta: 'Let me think about this at length before answering... '
        };
        yield { type: 'TEXT_MESSAGE_CONTENT', delta: 'Great summary' };
      })
    );
    const upsertDocumentMetadata = vi.fn();
    const db = {
      document: {
        claimDueMetadataGenerations: vi.fn(async () => [scheduleRow()]),
        getDocumentMetadata: vi.fn(async () => ({
          workspace: 'ws-1',
          node_id: 'node-1',
          document_type_id: 'type-1',
          values: {},
          generated_metadata: {},
          updated_at: new Date()
        })),
        getDocumentType: vi.fn(async () => documentType),
        upsertDocumentMetadata,
        upsertPendingMetadataGeneration: vi.fn()
      },
      project: {
        getAnyContentNodeById: vi.fn(async () => node),
        getNextMarkdownRevisionNumber: vi.fn(async () => 6),
        createMarkdownRevision: vi.fn()
      },
      auth: { getUser: vi.fn(async () => user) },
      core: { transaction: vi.fn(async (cb: (tx: DatabaseAdapter) => unknown) => cb(db as never)) }
    } as unknown as DatabaseAdapter;

    const handler = createDocumentMetadataGenerationScanJobHandler(db, makeStorage());
    const result = await handler({ jobId: 'job-1', workspace: 'ws-1', payload: {} });

    expect(result.success).toBe(1);
    expect(upsertDocumentMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        values: { summary: 'Great summary' },
        generated_metadata: expect.objectContaining({
          summary: expect.objectContaining({
            explanation: 'Let me think about this at length before answering...'
          })
        })
      })
    );
  });

  it('discards the result when the document changed while generating', async () => {
    chat.mockImplementation(chatAnswer('Great summary'));
    const upsertDocumentMetadata = vi.fn();
    const db = {
      document: {
        claimDueMetadataGenerations: vi.fn(async () => [scheduleRow({ source_revision: 5 })]),
        getDocumentMetadata: vi.fn(async () => ({
          workspace: 'ws-1',
          node_id: 'node-1',
          document_type_id: 'type-1',
          values: {},
          generated_metadata: {},
          updated_at: new Date()
        })),
        getDocumentType: vi.fn(async () => documentType),
        upsertDocumentMetadata,
        upsertPendingMetadataGeneration: vi.fn()
      },
      project: {
        getAnyContentNodeById: vi.fn(async () => node),
        // Current revision (7 - 1 = 6) no longer matches the row's source_revision (5).
        getNextMarkdownRevisionNumber: vi.fn(async () => 7),
        createMarkdownRevision: vi.fn()
      },
      auth: { getUser: vi.fn(async () => user) },
      core: { transaction: vi.fn(async (cb: (tx: DatabaseAdapter) => unknown) => cb(db as never)) }
    } as unknown as DatabaseAdapter;

    const handler = createDocumentMetadataGenerationScanJobHandler(db, makeStorage());
    const result = await handler({ jobId: 'job-1', workspace: 'ws-1', payload: {} });

    expect(result).toEqual({
      processed: 1,
      success: 0,
      failed: 0,
      retrying: 0,
      discarded: 1,
      skipped: 0
    });
    expect(upsertDocumentMetadata).not.toHaveBeenCalled();
  });

  it('retries once on a failed generation before recording a permanent failure', async () => {
    chat.mockImplementation(chatAnswer(''));
    const upsertPendingMetadataGeneration = vi.fn();
    const upsertDocumentMetadata = vi.fn();
    const db = {
      document: {
        claimDueMetadataGenerations: vi.fn(async () => [scheduleRow({ attempt_count: 0 })]),
        getDocumentMetadata: vi.fn(async () => ({
          workspace: 'ws-1',
          node_id: 'node-1',
          document_type_id: 'type-1',
          values: {},
          generated_metadata: {},
          updated_at: new Date()
        })),
        getDocumentType: vi.fn(async () => documentType),
        upsertDocumentMetadata,
        upsertPendingMetadataGeneration
      },
      project: {
        getAnyContentNodeById: vi.fn(async () => node),
        getNextMarkdownRevisionNumber: vi.fn(async () => 6),
        createMarkdownRevision: vi.fn()
      },
      auth: { getUser: vi.fn(async () => user) },
      core: { transaction: vi.fn(async (cb: (tx: DatabaseAdapter) => unknown) => cb(db as never)) }
    } as unknown as DatabaseAdapter;

    const handler = createDocumentMetadataGenerationScanJobHandler(db, makeStorage());
    const result = await handler({ jobId: 'job-1', workspace: 'ws-1', payload: {} });

    expect(result).toEqual({
      processed: 1,
      success: 0,
      failed: 0,
      retrying: 1,
      discarded: 0,
      skipped: 0
    });
    expect(upsertPendingMetadataGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ attempt_count: 1 })
    );
    expect(upsertDocumentMetadata).not.toHaveBeenCalled();
  });

  it('records a permanent failure on the final attempt', async () => {
    chat.mockImplementation(chatAnswer(''));
    const upsertPendingMetadataGeneration = vi.fn();
    const upsertDocumentMetadata = vi.fn();
    const db = {
      document: {
        claimDueMetadataGenerations: vi.fn(async () => [scheduleRow({ attempt_count: 1 })]),
        getDocumentMetadata: vi.fn(async () => ({
          workspace: 'ws-1',
          node_id: 'node-1',
          document_type_id: 'type-1',
          values: {},
          generated_metadata: {},
          updated_at: new Date()
        })),
        getDocumentType: vi.fn(async () => documentType),
        upsertDocumentMetadata,
        upsertPendingMetadataGeneration
      },
      project: {
        getAnyContentNodeById: vi.fn(async () => node),
        getNextMarkdownRevisionNumber: vi.fn(async () => 6),
        createMarkdownRevision: vi.fn()
      },
      auth: { getUser: vi.fn(async () => user) },
      core: { transaction: vi.fn(async (cb: (tx: DatabaseAdapter) => unknown) => cb(db as never)) }
    } as unknown as DatabaseAdapter;

    const handler = createDocumentMetadataGenerationScanJobHandler(db, makeStorage());
    const result = await handler({ jobId: 'job-1', workspace: 'ws-1', payload: {} });

    expect(result).toEqual({
      processed: 1,
      success: 0,
      failed: 1,
      retrying: 0,
      discarded: 0,
      skipped: 0
    });
    expect(upsertPendingMetadataGeneration).not.toHaveBeenCalled();
    expect(upsertDocumentMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        generated_metadata: expect.objectContaining({
          summary: expect.objectContaining({ status: 'failed', failureNotice: expect.any(String) })
        })
      })
    );
  });

  it('skips a row whose action is no longer an enabled metadata generator', async () => {
    const db = {
      document: {
        claimDueMetadataGenerations: vi.fn(async () => [
          scheduleRow({ action_id: 'gen-disabled' })
        ]),
        getDocumentMetadata: vi.fn(async () => ({
          workspace: 'ws-1',
          node_id: 'node-1',
          document_type_id: 'type-1',
          values: {},
          generated_metadata: {},
          updated_at: new Date()
        })),
        getDocumentType: vi.fn(async () => documentType),
        upsertDocumentMetadata: vi.fn(),
        upsertPendingMetadataGeneration: vi.fn()
      },
      project: { getAnyContentNodeById: vi.fn(async () => node) },
      auth: { getUser: vi.fn(async () => user) },
      core: { transaction: vi.fn(async (cb: (tx: DatabaseAdapter) => unknown) => cb(db as never)) }
    } as unknown as DatabaseAdapter;

    const handler = createDocumentMetadataGenerationScanJobHandler(db, makeStorage());
    const result = await handler({ jobId: 'job-1', workspace: 'ws-1', payload: {} });

    expect(result).toEqual({
      processed: 1,
      success: 0,
      failed: 0,
      retrying: 0,
      discarded: 0,
      skipped: 1
    });
    expect(chat).not.toHaveBeenCalled();
  });

  it('counts an unexpected error as a retry when attempts remain, not a permanent failure', async () => {
    const upsertPendingMetadataGeneration = vi.fn();
    const db = {
      document: {
        claimDueMetadataGenerations: vi.fn(async () => [scheduleRow({ attempt_count: 0 })]),
        getDocumentMetadata: vi.fn(async () => {
          throw new Error('database connection lost');
        }),
        upsertPendingMetadataGeneration
      },
      project: { getAnyContentNodeById: vi.fn(async () => node) },
      core: { transaction: vi.fn(async (cb: (tx: DatabaseAdapter) => unknown) => cb(db as never)) }
    } as unknown as DatabaseAdapter;

    const handler = createDocumentMetadataGenerationScanJobHandler(db, makeStorage());
    const result = await handler({ jobId: 'job-1', workspace: 'ws-1', payload: {} });

    expect(result).toEqual({
      processed: 1,
      success: 0,
      failed: 0,
      retrying: 1,
      discarded: 0,
      skipped: 0
    });
    expect(upsertPendingMetadataGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ attempt_count: 1 })
    );
  });
});
