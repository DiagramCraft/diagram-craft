import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../db/database';
import type { AuthenticatedEvent } from '../middleware/auth';
import { handleDbError, type DbErrorMapping } from '../utils/http';
import { buildApiAuthCtx, GLOBAL_WS } from './auth/authorization';
import { resolveWorkspace } from './workspace/resolveWorkspace';

export type OperationContext = {
  ws: string;
  authCtx: AuthorizationContext;
};

export type OperationErrorOptions = {
  fallback: string;
  dbErrorMessages?: DbErrorMapping;
  before?: (context: OperationContext) => void;
  onError?: (error: unknown) => void;
};

export const defineOperation = async <T>(
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  options: OperationErrorOptions,
  operation: (context: OperationContext) => Promise<T>
): Promise<T> => {
  const ws = await resolveWorkspace(db.catalog, workspace);

  let authCtx: AuthorizationContext;
  try {
    authCtx = await buildApiAuthCtx(db, ws, event);
  } catch (error) {
    options.onError?.(error);
    return handleDbError(error, options.fallback, options.dbErrorMessages);
  }

  options.before?.({ ws, authCtx });

  try {
    return await operation({ ws, authCtx });
  } catch (error) {
    options.onError?.(error);
    return handleDbError(error, options.fallback, options.dbErrorMessages);
  }
};

export const defineGlobalOperation = async <T>(
  db: DatabaseAdapter,
  event: AuthenticatedEvent,
  options: OperationErrorOptions,
  operation: (context: { authCtx: AuthorizationContext }) => Promise<T>
): Promise<T> => {
  try {
    const authCtx = await buildApiAuthCtx(db, GLOBAL_WS, event);
    return await operation({ authCtx });
  } catch (error) {
    options.onError?.(error);
    return handleDbError(error, options.fallback, options.dbErrorMessages);
  }
};
