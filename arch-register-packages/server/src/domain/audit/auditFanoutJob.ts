import type { DatabaseAdapter } from '../../db/database';
import { RetryableJobError } from '../jobs/jobRetry';
import { enqueueAutomationRuleRuns } from '../automation/automationRuleEvaluation';
import { enqueueWebhookDeliveries } from '../webhook/webhookDelivery';
import { createAuditWatcherNotifications } from './auditWatcherNotifications';

export const AUDIT_FANOUT_JOB_TYPE = 'audit.fanout';

type AuditFanoutPayload = {
  auditLogId: string;
  watcherUserIds?: string[];
};

const parsePayload = (payload: Record<string, unknown>): AuditFanoutPayload | null => {
  const auditLogId = payload['auditLogId'];
  if (typeof auditLogId !== 'string' || auditLogId.length === 0) return null;
  const watcherUserIds = Array.isArray(payload['watcherUserIds'])
    ? payload['watcherUserIds'].filter((value): value is string => typeof value === 'string')
    : undefined;
  return { auditLogId, ...(watcherUserIds ? { watcherUserIds } : {}) };
};

export const createAuditFanoutJobHandler =
  (db: DatabaseAdapter) =>
  async (context: { workspace: string; payload: Record<string, unknown> }) => {
    const payload = parsePayload(context.payload);
    if (!payload) return { skipped: true, reason: 'invalid-payload' };

    const auditLog = await db.audit.getAuditLog(context.workspace, payload.auditLogId);
    if (!auditLog) return { skipped: true, reason: 'audit-log-not-found' };

    try {
      return await db.core.transaction(async tx => {
        const webhookCount = await enqueueWebhookDeliveries(tx, auditLog);
        const automationCount = await enqueueAutomationRuleRuns(tx, auditLog, auditLog.metadata);
        await createAuditWatcherNotifications(tx, auditLog, payload.watcherUserIds);
        return { webhookCount, automationCount };
      });
    } catch (error) {
      throw new RetryableJobError(
        `Audit fan-out failed for ${payload.auditLogId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };
