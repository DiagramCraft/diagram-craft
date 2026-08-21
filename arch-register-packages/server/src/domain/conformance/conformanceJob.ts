import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import { createJobSchedule, updateJobSchedule } from '../jobs/jobOperations';
import { executeConformanceRun } from './conformanceEvaluation';

export const CONFORMANCE_SCAN_JOB_TYPE = 'conformance.scan';
export const CONFORMANCE_SCAN_SYSTEM_IDENTITY = 'conformance';
export const CONFORMANCE_SCAN_TIME_UTC = '02:00';

export const ensureConformanceSchedule = async (
  db: DatabaseAdapter,
  workspace: string,
  now = new Date()
) => {
  const schedules = await db.jobs.listSchedules(workspace);
  const existing = schedules.find(schedule => schedule.job_type === CONFORMANCE_SCAN_JOB_TYPE);
  if (existing) {
    if (
      existing.recurrence.type !== 'daily' ||
      existing.recurrence.timeUtc !== CONFORMANCE_SCAN_TIME_UTC ||
      existing.system_identity !== CONFORMANCE_SCAN_SYSTEM_IDENTITY
    ) {
      await updateJobSchedule(
        db,
        existing.id,
        {
          jobType: CONFORMANCE_SCAN_JOB_TYPE,
          systemIdentity: CONFORMANCE_SCAN_SYSTEM_IDENTITY,
          payload: {},
          recurrence: { type: 'daily', timeUtc: CONFORMANCE_SCAN_TIME_UTC }
        },
        now
      );
    }
    return existing;
  }
  return createJobSchedule(
    db,
    {
      workspace,
      jobType: CONFORMANCE_SCAN_JOB_TYPE,
      systemIdentity: CONFORMANCE_SCAN_SYSTEM_IDENTITY,
      payload: {},
      priority: 5,
      recurrence: { type: 'daily', timeUtc: CONFORMANCE_SCAN_TIME_UTC }
    },
    now
  );
};

export const ensureAllConformanceSchedules = async (db: DatabaseAdapter, now = new Date()) => {
  const workspaces = await db.workspace.listWorkspaces();
  for (const workspace of workspaces) {
    await ensureConformanceSchedule(db, workspace.id, now);
  }
};

export const createConformanceScanJobHandler =
  (db: DatabaseAdapter) =>
  async (context: {
    jobId: string;
    workspace: string;
    payload: Record<string, unknown>;
    signal?: AbortSignal;
  }) => {
    const runId = context.payload['evaluationRunId'];
    const checkId = context.payload['checkId'];
    const effectiveCheckId = typeof checkId === 'string' ? checkId : undefined;
    const evaluationRunId =
      typeof runId === 'string'
        ? runId
        : (
            await db.conformance.createRun({
              id: randomUUID(),
              workspace: context.workspace,
              check_id: effectiveCheckId ?? null,
              job_run_id: context.jobId,
              status: 'running',
              started_at: new Date(),
              completed_at: null,
              checked_count: 0,
              violation_count: 0,
              error: null,
              configuration: { scheduled: true }
            })
          ).id;
    return executeConformanceRun(db, context.workspace, evaluationRunId, effectiveCheckId);
  };
