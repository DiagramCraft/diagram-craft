import type { DatabaseAdapter } from '@arch-register/server/db/database';
import {
  AUDIT_FANOUT_JOB_TYPE,
  createAuditFanoutJobHandler
} from '@arch-register/server/domain/audit/auditFanoutJob';

/** Runs queued audit fan-out jobs directly for API tests; production uses the standalone worker. */
export const drainAuditFanoutJobs = async (db: DatabaseAdapter, workspace: string) => {
  const handler = createAuditFanoutJobHandler(db);
  while (true) {
    const page = await db.jobs.listRuns(workspace, {
      jobType: AUDIT_FANOUT_JOB_TYPE,
      status: 'queued',
      limit: 100,
      offset: 0
    });
    if (page.items.length === 0) return;
    for (const run of page.items) {
      await handler({ workspace: run.workspace, payload: run.payload });
      await db.jobs.cancelQueuedRun(workspace, run.id, new Date());
    }
  }
};
