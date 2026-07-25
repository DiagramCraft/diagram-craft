import type { DatabaseAdapter } from '../../db/database';
import { enqueueOneOffJobRun } from '../jobs/jobOperations';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { getSystemUserId } from '../auth/systemUsers';
import { computeNextOccurrenceAt } from './assessmentRecurrence';
import {
  openAssessmentGovernanceCase,
  closeAssessmentGovernanceCase
} from './assessmentGovernance';
import type { AssessmentDbResult, AssessmentDbUpdate } from './db/projectDatabase';

export const ASSESSMENT_RECURRENCE_JOB_TYPE = 'assessment.recurrence';
export const ASSESSMENT_RECURRENCE_SYSTEM_IDENTITY = 'assessment-recurrence';
// See domain/auth/systemUsers.ts for the registry.
export const ASSESSMENT_RECURRENCE_SYSTEM_USER_ID = getSystemUserId('assessment-recurrence-job');

const toUpdateInput = (
  row: AssessmentDbResult,
  overrides: Partial<AssessmentDbUpdate>
): AssessmentDbUpdate => ({
  name: row.name,
  description: row.description,
  status: row.status,
  mode: row.mode,
  scope: row.scope,
  scope_conditions: row.scope_conditions,
  fields: row.fields,
  assigned_team_ids: row.assigned_team_ids,
  due_at: row.due_at,
  recurrence: row.recurrence,
  response_window_days: row.response_window_days,
  current_occurrence: row.current_occurrence,
  pending_occurrence_job_run_id: row.pending_occurrence_job_run_id,
  next_occurrence_at: row.next_occurrence_at,
  updated_at: row.updated_at,
  ...overrides
});

export const scheduleNextAssessmentOccurrence = async (
  tx: DatabaseAdapter,
  workspace: string,
  row: AssessmentDbResult,
  now: Date
): Promise<AssessmentDbResult> => {
  if (row.recurrence.type === 'none') return row;

  const nextOccurrenceAt = computeNextOccurrenceAt(row.recurrence, now);
  const run = await enqueueOneOffJobRun(
    tx,
    {
      workspace,
      jobType: ASSESSMENT_RECURRENCE_JOB_TYPE,
      systemIdentity: ASSESSMENT_RECURRENCE_SYSTEM_IDENTITY,
      payload: { assessmentId: row.id }
    },
    nextOccurrenceAt
  );

  const updated = await tx.project.updateAssessment(
    workspace,
    row.project_id,
    row.id,
    toUpdateInput(row, {
      pending_occurrence_job_run_id: run.id,
      next_occurrence_at: nextOccurrenceAt
    })
  );
  return updated ?? row;
};

export const cancelPendingAssessmentOccurrence = async (
  tx: DatabaseAdapter,
  workspace: string,
  row: AssessmentDbResult,
  now: Date
): Promise<AssessmentDbResult> => {
  if (!row.pending_occurrence_job_run_id) return row;

  await tx.jobs.cancelQueuedRun(workspace, row.pending_occurrence_job_run_id, now);

  const updated = await tx.project.updateAssessment(
    workspace,
    row.project_id,
    row.id,
    toUpdateInput(row, { pending_occurrence_job_run_id: null, next_occurrence_at: null })
  );
  return updated ?? row;
};

const isAssessmentRecurrencePayload = (
  value: Record<string, unknown>
): value is { assessmentId: string } => typeof value['assessmentId'] === 'string';

export const createAssessmentRecurrenceJobHandler =
  (db: DatabaseAdapter) =>
  async (context: {
    jobId: string;
    workspace: string;
    payload: Record<string, unknown>;
    signal: AbortSignal;
  }) => {
    if (!isAssessmentRecurrencePayload(context.payload)) {
      throw new Error('Assessment recurrence job has an invalid payload');
    }
    const { assessmentId } = context.payload;

    return db.core.transaction(async tx => {
      const row = await tx.project.getAssessmentById(context.workspace, assessmentId);
      if (row?.status !== 'open' || row.recurrence.type === 'none') {
        return { skipped: true };
      }

      const now = new Date();
      await closeAssessmentGovernanceCase(tx, context.workspace, row.id);

      const reopened = await tx.project.updateAssessment(
        context.workspace,
        row.project_id,
        row.id,
        toUpdateInput(row, {
          current_occurrence: row.current_occurrence + 1,
          due_at: row.response_window_days
            ? new Date(now.getTime() + row.response_window_days * 24 * 60 * 60 * 1000)
            : null,
          updated_at: now
        })
      );
      if (!reopened) return { skipped: true };

      await openAssessmentGovernanceCase(
        tx,
        context.workspace,
        ASSESSMENT_RECURRENCE_SYSTEM_USER_ID,
        reopened
      );

      await logAudit(tx, {
        userId: ASSESSMENT_RECURRENCE_SYSTEM_USER_ID,
        workspace: context.workspace,
        operation: 'update',
        entityType: 'assessment',
        entityId: reopened.id,
        entityName: reopened.name,
        changes: computeChanges(extractEntityFields(row), extractEntityFields(reopened))
      });

      const scheduled = await scheduleNextAssessmentOccurrence(
        tx,
        context.workspace,
        reopened,
        now
      );

      return {
        assessmentId: scheduled.id,
        occurrence: scheduled.current_occurrence,
        nextOccurrenceAt: scheduled.next_occurrence_at?.toISOString() ?? null
      };
    });
  };
