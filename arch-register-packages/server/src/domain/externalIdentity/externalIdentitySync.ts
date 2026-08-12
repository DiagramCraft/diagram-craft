import type { DatabaseAdapter } from '../../db/database';
import { DatabaseError } from '../../db/database';
import { httpAssert } from '../../utils/httpAssert';
import { valueEquals } from '../externalMetadata/externalMetadataHelpers';

export const MAX_SOURCE_LENGTH = 200;
export const MAX_EXTERNAL_KEY_LENGTH = 500;

export type ExternalIdentitySyncStatus = 'created' | 'updated' | 'unchanged';

export type ExternalIdentitySyncResult<TResult> = {
  status: ExternalIdentitySyncStatus;
  result: TResult;
};

class ExternalIdentityRaceError extends Error {
  constructor(readonly databaseError: DatabaseError) {
    super('External identity unique race');
    this.name = 'ExternalIdentityRaceError';
  }
}

export const validateExternalIdentity = (
  source: unknown,
  externalKey: unknown
): { source: string; externalKey: string } => {
  httpAssert.string(source, { status: 400, message: 'source is required' });
  httpAssert.true(source.length <= MAX_SOURCE_LENGTH, {
    status: 400,
    message: `source must be at most ${MAX_SOURCE_LENGTH} characters`
  });
  httpAssert.string(externalKey, { status: 400, message: 'externalKey is required' });
  httpAssert.true(externalKey.length <= MAX_EXTERNAL_KEY_LENGTH, {
    status: 400,
    message: `externalKey must be at most ${MAX_EXTERNAL_KEY_LENGTH} characters`
  });
  return { source, externalKey };
};

export const valuesUnchanged = (
  previous: Record<string, unknown>,
  next: Record<string, unknown>
) => {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  return [...keys].every(key => valueEquals(previous[key] ?? null, next[key] ?? null));
};

type ExternalIdentitySyncContext<TBody, TPayload, TAuthCtx, TActor> = {
  db: DatabaseAdapter;
  workspace: string;
  source: string;
  externalKey: string;
  body: TBody;
  payload: TPayload;
  authCtx: TAuthCtx | null;
  actor: TActor;
  auditMetadata: Record<string, unknown>;
};

type ExistingPreparation<TRecord, TNext, TState> = {
  record: TRecord;
  next: TNext;
  state: TState;
};

export type ExternalIdentitySyncHandlers<
  TBody,
  TPayload,
  TRecord,
  TNext,
  TExistingState,
  TCreateState,
  TAuthCtx,
  TActor,
  TResult
> = {
  /** Runs before parsing or any database read so callers cannot probe record existence. */
  authorize: (authCtx: TAuthCtx | null) => void;
  parse: (body: TBody) => TPayload;
  prepareExisting: (
    context: ExternalIdentitySyncContext<TBody, TPayload, TAuthCtx, TActor> & {
      recordId: string;
    }
  ) => Promise<ExistingPreparation<TRecord, TNext, TExistingState>>;
  isUnchanged: (context: {
    record: TRecord;
    next: TNext;
    state: TExistingState;
    authCtx: TAuthCtx | null;
  }) => boolean;
  update: (context: {
    sync: ExternalIdentitySyncContext<TBody, TPayload, TAuthCtx, TActor>;
    record: TRecord;
    next: TNext;
    state: TExistingState;
  }) => Promise<TRecord>;
  prepareCreate: (
    context: ExternalIdentitySyncContext<TBody, TPayload, TAuthCtx, TActor>
  ) => Promise<TCreateState>;
  create: (context: {
    sync: ExternalIdentitySyncContext<TBody, TPayload, TAuthCtx, TActor>;
    state: TCreateState;
  }) => Promise<TRecord>;
  recordId: (record: TRecord) => string;
  toResult: (
    record: TRecord,
    authCtx: TAuthCtx | null,
    state: TExistingState | TCreateState
  ) => TResult;
};

type RunExternalIdentitySyncArgs<
  TBody,
  TPayload,
  TRecord,
  TNext,
  TExistingState,
  TCreateState,
  TAuthCtx,
  TActor,
  TResult
> = {
  db: DatabaseAdapter;
  workspace: string;
  source: string;
  externalKey: string;
  body: TBody;
  authCtx: TAuthCtx | null;
  actor: TActor;
  auditMetadata?: Record<string, unknown>;
  handlers: ExternalIdentitySyncHandlers<
    TBody,
    TPayload,
    TRecord,
    TNext,
    TExistingState,
    TCreateState,
    TAuthCtx,
    TActor,
    TResult
  >;
};

/**
 * Runs the shared external-identity upsert workflow inside an existing transaction.
 *
 * The caller owns transaction creation and error mapping. Domain handlers own all record-specific
 * loading, validation, permission checks, mutation, and response redaction.
 */
export const runExternalIdentitySyncInTransaction = async <
  TBody,
  TPayload,
  TRecord,
  TNext,
  TExistingState,
  TCreateState,
  TAuthCtx,
  TActor,
  TResult
>({
  db,
  workspace,
  source,
  externalKey,
  body,
  authCtx,
  actor,
  auditMetadata = {},
  handlers
}: RunExternalIdentitySyncArgs<
  TBody,
  TPayload,
  TRecord,
  TNext,
  TExistingState,
  TCreateState,
  TAuthCtx,
  TActor,
  TResult
>): Promise<ExternalIdentitySyncResult<TResult>> => {
  handlers.authorize(authCtx);

  const payload = handlers.parse(body);
  const syncAuditMetadata = {
    sync_source: source,
    sync_external_key: externalKey,
    ...auditMetadata
  };
  const syncContext: ExternalIdentitySyncContext<TBody, TPayload, TAuthCtx, TActor> = {
    db,
    workspace,
    source,
    externalKey,
    body,
    payload,
    authCtx,
    actor,
    auditMetadata: syncAuditMetadata
  };

  const existingIdentity = await db.externalIdentity.find(workspace, source, externalKey);
  if (existingIdentity) {
    const prepared = await handlers.prepareExisting({
      ...syncContext,
      recordId: existingIdentity.record_id
    });

    if (
      handlers.isUnchanged({
        record: prepared.record,
        next: prepared.next,
        state: prepared.state,
        authCtx
      })
    ) {
      return {
        status: 'unchanged',
        result: handlers.toResult(prepared.record, authCtx, prepared.state)
      };
    }

    const updated = await handlers.update({
      sync: syncContext,
      record: prepared.record,
      next: prepared.next,
      state: prepared.state
    });
    return { status: 'updated', result: handlers.toResult(updated, authCtx, prepared.state) };
  }

  const createState = await handlers.prepareCreate(syncContext);
  let created: TRecord;

  try {
    created = await db.core.savepoint(async savepointDb => {
      const savepointContext = { ...syncContext, db: savepointDb };
      const savepointCreated = await handlers.create({
        sync: savepointContext,
        state: createState
      });
      try {
        await savepointDb.externalIdentity.create({
          workspace,
          source,
          external_key: externalKey,
          record_id: handlers.recordId(savepointCreated)
        });
      } catch (error) {
        if (error instanceof DatabaseError && error.code === 'unique') {
          throw new ExternalIdentityRaceError(error);
        }
        throw error;
      }
      return savepointCreated;
    });
  } catch (error) {
    if (error instanceof ExternalIdentityRaceError) {
      // The savepoint rolled back this candidate record and its side effects. The outer transaction
      // is still usable, so re-run the workflow and converge on the winning identity.
      return runExternalIdentitySyncInTransaction({
        db,
        workspace,
        source,
        externalKey,
        body,
        authCtx,
        actor,
        auditMetadata,
        handlers
      });
    }
    throw error;
  }

  return { status: 'created', result: handlers.toResult(created, authCtx, createState) };
};
