import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { ConformanceCheckDbResult } from './db/conformanceDatabase';

const { buildUserAuthCtx, resolveAiConfig, createAiChatTools, createAiTextAdapter, chat } =
  vi.hoisted(() => ({
    buildUserAuthCtx: vi.fn(async () => ({ userId: 'user-1' })),
    resolveAiConfig: vi.fn(async () => ({ temperature: 0.2, model: 'test-model' })),
    createAiChatTools: vi.fn(() => []),
    createAiTextAdapter: vi.fn(() => 'adapter'),
    chat: vi.fn()
  }));

vi.mock('../auth/authorization', () => ({ buildUserAuthCtx }));
vi.mock('../ai/tanstackAiAdapter', () => ({ resolveAiConfig, createAiTextAdapter }));
vi.mock('../ai/chatTools', () => ({ createAiChatTools }));
vi.mock('@tanstack/ai', () => ({ chat }));

const check = {
  id: 'check-1',
  workspace: 'ws-1',
  name: 'AI policy',
  description: null,
  severity: 'error',
  enabled: true,
  definition: {
    type: 'ai_prompt',
    schemaId: 'schema-1',
    fieldIds: ['name'],
    prompt: 'Is this conformant?',
    governance: { enabled: false, resolution: 'acknowledge' }
  },
  revision: 1,
  created_by: 'user-1',
  created_at: new Date(),
  updated_at: new Date()
} as unknown as ConformanceCheckDbResult;

const makeDb = (overrides: Record<string, unknown> = {}) => {
  const entity = {
    id: 'entity-1',
    name: 'Entity One',
    schema_id: 'schema-1',
    data: { name: 'Entity One' }
  };
  const schema = { id: 'schema-1', name: 'Service', version: 1, fields: [], groups: [] };
  return {
    catalog: {
      listEntitiesPaginated: vi.fn(async () => [entity]),
      listSchemas: vi.fn(async () => [schema])
    },
    relation: {
      listRelationSchemas: vi.fn(async () => []),
      listRelations: vi.fn(async () => ({ items: [] }))
    },
    auth: { getUser: vi.fn(async () => ({ id: 'user-1', display_name: 'User One' })) },
    conformance: {
      getRun: vi.fn(async () => ({ id: 'run-1' })),
      listChecks: vi.fn(async () => [check]),
      upsertViolation: vi.fn(),
      resolveUnseenViolations: vi.fn(async () => []),
      updateRun: vi.fn(async (_workspace: string, _runId: string, update: unknown) => update),
      ...overrides
    },
    core: {
      transaction: vi.fn(async (callback: (tx: DatabaseAdapter) => unknown) =>
        callback(null as never)
      )
    }
  } as unknown as DatabaseAdapter;
};

describe('conformance cancellation', () => {
  it('does not start database work when execution is already aborted', async () => {
    const { executeConformanceRun } = await import('./conformanceEvaluation');
    const controller = new AbortController();
    controller.abort(new Error('execution timed out'));
    const db = makeDb();

    await expect(
      executeConformanceRun(db, 'ws-1', 'run-1', undefined, controller.signal)
    ).rejects.toThrow('execution timed out');
    expect(db.conformance.getRun).not.toHaveBeenCalled();
    expect(db.conformance.updateRun).not.toHaveBeenCalled();
  });

  it('stops after suspended database loading resumes and does not mark the run failed', async () => {
    const { executeConformanceRun } = await import('./conformanceEvaluation');
    const controller = new AbortController();
    let releaseEntities!: () => void;
    const entitiesRead = new Promise<void>(resolve => {
      releaseEntities = resolve;
    });
    const db = makeDb({
      listChecks: vi.fn(async () => {
        await entitiesRead;
        return [check];
      })
    });

    const execution = executeConformanceRun(db, 'ws-1', 'run-1', undefined, controller.signal);
    await vi.waitFor(() => expect(db.conformance.listChecks).toHaveBeenCalled());
    controller.abort(new Error('lease lost'));
    releaseEntities();

    await expect(execution).rejects.toThrow('lease lost');
    expect(db.conformance.updateRun).not.toHaveBeenCalled();
  });

  it('links cancellation to the AI provider and avoids subsequent writes', async () => {
    const { executeConformanceRun } = await import('./conformanceEvaluation');
    const controller = new AbortController();
    let providerAbortController: AbortController | undefined;
    chat.mockImplementation(
      vi.fn(async (options: { abortController?: AbortController }) => {
        providerAbortController = options.abortController;
        await new Promise<never>((_resolve, reject) => {
          options.abortController?.signal.addEventListener(
            'abort',
            () => reject(options.abortController?.signal.reason),
            { once: true }
          );
        });
        throw new Error('provider request did not abort');
      })
    );
    const db = makeDb();

    const execution = executeConformanceRun(db, 'ws-1', 'run-1', undefined, controller.signal);
    await vi.waitFor(() => expect(providerAbortController).toBeDefined());
    controller.abort(new Error('job execution timed out'));

    await expect(execution).rejects.toThrow('job execution timed out');
    expect(chat).toHaveBeenCalledTimes(1);
    expect(db.conformance.upsertViolation).not.toHaveBeenCalled();
    expect(db.conformance.resolveUnseenViolations).not.toHaveBeenCalled();
    expect(db.conformance.updateRun).not.toHaveBeenCalled();
  });
});
