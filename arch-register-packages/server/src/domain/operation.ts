import type {
  AuthorizationContext,
  WorkspaceAuthorizationContext
} from '@arch-register/permissions';
import type { DatabaseAdapter } from '../db/database';
import type { AuthenticatedEvent } from '../middleware/auth';
import { handleDbError, type DbErrorMapping } from '../utils/http';
import { buildApiAuthCtx, buildApiEntityAuthCtx, GLOBAL_WS } from './auth/authorization';
import { resolveWorkspace } from './workspace/resolveWorkspace';

export type GlobalOperationContext = {
  authCtx: WorkspaceAuthorizationContext;
};

export type WorkspaceOperationContext = {
  ws: string;
  authCtx: WorkspaceAuthorizationContext;
};

export type EntityOperationContext = {
  ws: string;
  authCtx: AuthorizationContext;
};

export type OperationScope =
  | { kind: 'global' }
  | { kind: 'workspace'; workspace: string }
  | { kind: 'entity'; workspace: string };

export type OperationContextForScope<Scope extends OperationScope> = Scope extends {
  kind: 'global';
}
  ? GlobalOperationContext
  : Scope extends { kind: 'entity' }
    ? EntityOperationContext
    : WorkspaceOperationContext;

export type OperationErrorOptions<Context> = {
  fallback?: string;
  dbErrorMessages?: DbErrorMapping;
  before?: (context: Context) => void;
  onError?: (error: unknown) => void;
};

const DEFAULT_OPERATION_FALLBACK = 'Internal Server Error';

export type RunAuthorizedOperationOptions<
  Scope extends OperationScope,
  Result
> = OperationErrorOptions<OperationContextForScope<Scope>> & {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
  scope: Scope;
  operation: (context: OperationContextForScope<Scope>) => Promise<Result>;
};

/**
 * Resolves the requested authorization scope and runs a domain operation behind
 * the shared HTTP/database error boundary.
 *
 * This helper deliberately does not create transactions. Operations own their
 * transaction boundaries so a callback can coordinate database and non-database
 * side effects without being nested in an implicit transaction.
 */
export const runAuthorizedOperation = async <Scope extends OperationScope, Result>(
  options: RunAuthorizedOperationOptions<Scope, Result>
): Promise<Result> => {
  const handleError = (error: unknown): never => {
    options.onError?.(error);
    return handleDbError(
      error,
      options.fallback ?? DEFAULT_OPERATION_FALLBACK,
      options.dbErrorMessages
    );
  };

  const execute = async (context: OperationContextForScope<Scope>): Promise<Result> => {
    // Keep preflight authorization callbacks outside the database error mapper.
    // Existing callers rely on their authorization errors reaching the route
    // boundary unchanged.
    options.before?.(context);
    try {
      return await options.operation(context);
    } catch (error) {
      return handleError(error);
    }
  };

  try {
    if (options.scope.kind === 'global') {
      const authCtx = await buildApiAuthCtx(options.db, GLOBAL_WS, options.event);
      const context = { authCtx } as OperationContextForScope<Scope>;
      return execute(context);
    }

    const ws = await resolveWorkspace(options.db.catalog, options.scope.workspace);
    const authCtx =
      options.scope.kind === 'entity'
        ? await buildApiEntityAuthCtx(options.db, ws, options.event)
        : await buildApiAuthCtx(options.db, ws, options.event);
    const context = { ws, authCtx } as OperationContextForScope<Scope>;
    return execute(context);
  } catch (error) {
    return handleError(error);
  }
};
