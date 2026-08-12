import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { DatabaseError } from '../../db/database';
import type {
  CatalogRecordExternalIdentityDbCreate,
  CatalogRecordExternalIdentityRow
} from './db/externalIdentityDatabase';
import {
  runExternalIdentitySyncInTransaction,
  type ExternalIdentitySyncHandlers,
  validateExternalIdentity,
  valuesUnchanged
} from './externalIdentitySync';

type Body = { value: string };
type SyncRecord = { id: string; value: string };
type Next = { value: string };
type State = { kind: 'sync' };
type AuthContext = { allowed: boolean };
type Actor = { id: string };
type Result = { id: string; value: string };

type Handlers = ExternalIdentitySyncHandlers<
  Body,
  Body,
  SyncRecord,
  Next,
  State,
  State,
  AuthContext,
  Actor,
  Result
>;

const identityFor = (recordId: string): CatalogRecordExternalIdentityRow => ({
  workspace: 'ws-1',
  source: 'source-1',
  external_key: 'key-1',
  record_id: recordId,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z')
});

const makeHarness = (
  options: {
    identity?: string | null;
    records?: SyncRecord[];
    createError?: DatabaseError;
    onIdentityCreate?: (
      row: CatalogRecordExternalIdentityDbCreate,
      setIdentity: (recordId: string) => void
    ) => Promise<CatalogRecordExternalIdentityRow>;
  } = {}
) => {
  let identity = options.identity === undefined ? null : options.identity;
  const records = new Map((options.records ?? []).map(record => [record.id, record]));
  const calls: string[] = [];
  const mutationAuditMetadata: Array<Record<string, unknown>> = [];

  const setIdentity = (recordId: string) => {
    identity = recordId;
  };

  const defaultIdentityCreate = async (row: CatalogRecordExternalIdentityDbCreate) => {
    setIdentity(row.record_id);
    return identityFor(row.record_id);
  };

  const handlers: Handlers = {
    authorize: authCtx => {
      calls.push('authorize');
      if (authCtx && !authCtx.allowed) throw new Error('unauthorized');
    },
    parse: body => {
      calls.push('parse');
      return body;
    },
    prepareExisting: async context => {
      calls.push('prepareExisting');
      const record = records.get(context.recordId);
      if (!record) throw new Error('record missing');
      return {
        record,
        next: { value: context.payload.value },
        state: { kind: 'sync' }
      };
    },
    isUnchanged: ({ record, next }) => record.value === next.value,
    update: async context => {
      calls.push('update');
      mutationAuditMetadata.push(context.sync.auditMetadata);
      const updated = { ...context.record, value: context.next.value };
      records.set(updated.id, updated);
      return updated;
    },
    prepareCreate: async () => {
      calls.push('prepareCreate');
      return { kind: 'sync' };
    },
    create: async context => {
      calls.push('create');
      if (options.createError) throw options.createError;
      mutationAuditMetadata.push(context.sync.auditMetadata);
      const created = { id: 'record-created', value: context.sync.payload.value };
      records.set(created.id, created);
      return created;
    },
    recordId: record => record.id,
    toResult: record => ({ ...record })
  };

  const identityCreate = options.onIdentityCreate ?? defaultIdentityCreate;
  const savepoint = async <T>(callback: (db: DatabaseAdapter) => Promise<T>) => {
    const recordsBeforeSavepoint = new Map(records);
    try {
      return await callback(db);
    } catch (error) {
      records.clear();
      recordsBeforeSavepoint.forEach((record, id) => records.set(id, record));
      throw error;
    }
  };
  let db!: DatabaseAdapter;
  db = {
    core: {
      driver: 'sqlite',
      isTransaction: true,
      close: vi.fn(),
      transaction: vi.fn(async callback => callback(db)),
      savepoint: vi.fn(savepoint)
    },
    externalIdentity: {
      find: vi.fn(async () => (identity == null ? null : identityFor(identity))),
      create: vi.fn((row: CatalogRecordExternalIdentityDbCreate) =>
        identityCreate(row, setIdentity)
      )
    }
  } as unknown as DatabaseAdapter;

  return { db, handlers, calls, mutationAuditMetadata, records };
};

describe('external identity sync primitives', () => {
  it('validates source and external-key limits consistently', () => {
    expect(validateExternalIdentity('source', 'key')).toEqual({
      source: 'source',
      externalKey: 'key'
    });
    expect(() => validateExternalIdentity('', 'key')).toThrow();
    expect(() => validateExternalIdentity('source', '')).toThrow();
    expect(() => validateExternalIdentity('x'.repeat(201), 'key')).toThrow();
    expect(() => validateExternalIdentity('source', 'x'.repeat(501))).toThrow();
  });

  it('authorizes before parsing or reading identity state', async () => {
    const harness = makeHarness();

    await expect(
      runExternalIdentitySyncInTransaction({
        db: harness.db,
        workspace: 'ws-1',
        source: 'source-1',
        externalKey: 'key-1',
        body: { value: 'blocked' },
        authCtx: { allowed: false },
        actor: { id: 'actor-1' },
        handlers: harness.handlers
      })
    ).rejects.toThrow('unauthorized');
    expect(harness.calls).toEqual(['authorize']);
    expect(harness.db.externalIdentity.find).not.toHaveBeenCalled();
  });

  it('uses the common workflow for creation and merges sync audit metadata', async () => {
    const harness = makeHarness();

    const result = await runExternalIdentitySyncInTransaction({
      db: harness.db,
      workspace: 'ws-1',
      source: 'source-1',
      externalKey: 'key-1',
      body: { value: 'created' },
      authCtx: { allowed: true },
      actor: { id: 'actor-1' },
      auditMetadata: { request_id: 'request-1' },
      handlers: harness.handlers
    });

    expect(result).toEqual({
      status: 'created',
      result: { id: 'record-created', value: 'created' }
    });
    expect(harness.calls.slice(0, 3)).toEqual(['authorize', 'parse', 'prepareCreate']);
    expect(harness.mutationAuditMetadata).toEqual([
      {
        sync_source: 'source-1',
        sync_external_key: 'key-1',
        request_id: 'request-1'
      }
    ]);
    expect(harness.db.externalIdentity.create).toHaveBeenCalledWith({
      workspace: 'ws-1',
      source: 'source-1',
      external_key: 'key-1',
      record_id: 'record-created'
    });
  });

  it('returns unchanged without invoking the domain update callback', async () => {
    const harness = makeHarness({
      identity: 'record-1',
      records: [{ id: 'record-1', value: 'same' }]
    });

    const result = await runExternalIdentitySyncInTransaction({
      db: harness.db,
      workspace: 'ws-1',
      source: 'source-1',
      externalKey: 'key-1',
      body: { value: 'same' },
      authCtx: null,
      actor: { id: 'actor-1' },
      handlers: harness.handlers
    });

    expect(result).toEqual({
      status: 'unchanged',
      result: { id: 'record-1', value: 'same' }
    });
    expect(harness.calls).not.toContain('update');
    expect(harness.db.externalIdentity.create).not.toHaveBeenCalled();
  });

  it('retries only an identity unique race and converges on the winning record', async () => {
    let identityCreateAttempts = 0;
    const harness = makeHarness({
      records: [{ id: 'record-winner', value: 'same' }],
      onIdentityCreate: async (_row, setIdentity) => {
        identityCreateAttempts += 1;
        setIdentity('record-winner');
        if (identityCreateAttempts === 1) {
          throw new DatabaseError('unique', 'duplicate external identity');
        }
        return identityFor('record-winner');
      }
    });

    const result = await runExternalIdentitySyncInTransaction({
      db: harness.db,
      workspace: 'ws-1',
      source: 'source-1',
      externalKey: 'key-1',
      body: { value: 'same' },
      authCtx: null,
      actor: { id: 'actor-1' },
      handlers: harness.handlers
    });

    expect(result).toEqual({
      status: 'unchanged',
      result: { id: 'record-winner', value: 'same' }
    });
    expect(identityCreateAttempts).toBe(1);
    expect(harness.calls.filter(call => call === 'create')).toHaveLength(1);
    expect(harness.calls.filter(call => call === 'prepareExisting')).toHaveLength(1);
    expect([...harness.records.keys()]).toEqual(['record-winner']);
  });

  it('does not treat unrelated database errors as identity races', async () => {
    const harness = makeHarness({
      onIdentityCreate: async () => {
        throw new DatabaseError('foreign', 'unexpected failure');
      }
    });

    await expect(
      runExternalIdentitySyncInTransaction({
        db: harness.db,
        workspace: 'ws-1',
        source: 'source-1',
        externalKey: 'key-1',
        body: { value: 'created' },
        authCtx: null,
        actor: { id: 'actor-1' },
        handlers: harness.handlers
      })
    ).rejects.toMatchObject({ code: 'foreign' });
    expect(harness.calls).not.toContain('prepareExisting');
  });

  it('does not treat a unique error from record creation as an identity race', async () => {
    const harness = makeHarness({
      createError: new DatabaseError('unique', 'duplicate record')
    });

    await expect(
      runExternalIdentitySyncInTransaction({
        db: harness.db,
        workspace: 'ws-1',
        source: 'source-1',
        externalKey: 'key-1',
        body: { value: 'created' },
        authCtx: null,
        actor: { id: 'actor-1' },
        handlers: harness.handlers
      })
    ).rejects.toMatchObject({ code: 'unique' });
    expect(harness.calls.filter(call => call === 'create')).toHaveLength(1);
    expect(harness.calls).not.toContain('prepareExisting');
  });

  it('shares value comparison semantics for unordered arrays and null values', () => {
    expect(valuesUnchanged({ tags: ['a', 'b'], missing: undefined }, { tags: ['b', 'a'] })).toBe(
      true
    );
    expect(valuesUnchanged({ value: null }, {})).toBe(true);
    expect(valuesUnchanged({ value: 'old' }, { value: 'new' })).toBe(false);
  });
});
