import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { requireSchemaRead, requireWorkspaceCapability } from '../auth/authorization';
import { logAudit } from '../audit/db/auditLogging';
import { runAuthorizedOperation, type WorkspaceOperationContext } from '../operation';

type DraftAccess = 'read' | 'schema.edit' | 'schema.publish';

/**
 * Runs a workspace-scoped schema draft operation. `access` is checked before the operation runs:
 * `read` allows anyone who can read schemas, the others require that workspace capability.
 */
export const runDraftOperation = <Result>(options: {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
  workspace: string;
  fallback: string;
  access: DraftAccess;
  operation: (context: WorkspaceOperationContext) => Promise<Result>;
}): Promise<Result> =>
  runAuthorizedOperation({
    db: options.db,
    event: options.event,
    scope: { kind: 'workspace', workspace: options.workspace },
    fallback: options.fallback,
    operation: async context => {
      if (options.access === 'read') requireSchemaRead(context.authCtx);
      else requireWorkspaceCapability(context.authCtx, options.access);
      return options.operation(context);
    }
  });

/** Records a change to the workspace's schema draft itself (staging, discarding, mode). */
export const logDraftAudit = (
  db: DatabaseAdapter,
  params: {
    userId: string;
    workspace: string;
    operation: 'update' | 'delete';
    metadata: Record<string, unknown>;
    changes?: { old?: Record<string, unknown>; new?: Record<string, unknown> };
  }
) =>
  logAudit(db, {
    userId: params.userId,
    workspace: params.workspace,
    operation: params.operation,
    entityType: 'schema_draft',
    entityId: params.workspace,
    entityName: 'Schema draft',
    changes: params.changes ?? {},
    metadata: params.metadata
  });
