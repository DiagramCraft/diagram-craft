import { randomUUID } from 'node:crypto';
import { createLogger } from '../../utils/logger';
import type { ApiTokenAuditEvent, AuthDatabase } from './db/authDatabase';

const logger = createLogger('api-token-audit');

export const recordApiTokenAudit = async (
  db: AuthDatabase,
  input: {
    workspace: string;
    tokenId: string;
    userId: string | null;
    event: ApiTokenAuditEvent;
    metadata?: Record<string, unknown>;
  }
): Promise<void> => {
  try {
    await db.createApiTokenAudit({
      id: randomUUID(),
      workspace: input.workspace,
      token_id: input.tokenId,
      user_id: input.userId,
      event: input.event,
      created_at: new Date(),
      metadata: input.metadata ?? {}
    });
  } catch (error) {
    logger.error(
      'Failed to write API token audit event',
      error instanceof Error ? error : new Error(String(error))
    );
  }
};
