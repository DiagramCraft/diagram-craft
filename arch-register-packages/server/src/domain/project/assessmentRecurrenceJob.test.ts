import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AssessmentDbResult } from './db/projectDatabase';
import type { GovernanceCaseDbResult } from '../governance/db/governanceDatabase';
import {
  ASSESSMENT_RECURRENCE_JOB_TYPE,
  cancelPendingAssessmentOccurrence,
  createAssessmentRecurrenceJobHandler,
  scheduleNextAssessmentOccurrence
} from './assessmentRecurrenceJob';

vi.mock('../audit/db/auditLogging', () => ({
  logAudit: vi.fn(async () => {}),
  extractEntityFields: (o: Record<string, unknown>) => o,
  computeChanges: () => ({})
}));

vi.mock('../governance/governanceNotifications', () => ({
  createGovernanceInAppNotifications: vi.fn(async () => {})
}));

const now = new Date('2026-06-01T12:00:00.000Z');

const baseRow = (overrides: Partial<AssessmentDbResult> = {}): AssessmentDbResult => ({
  id: 'assessment-1',
  workspace: 'ws-1',
  project_id: 'project-1',
  name: 'Quarterly attestation',
  description: '',
  status: 'open',
  mode: 'confirm',
  scope: [],
  scope_conditions: [],
  assigned_team_ids: ['team-a'],
  due_at: null,
  recurrence: { type: 'weekly', intervalWeeks: 1 },
  response_window_days: 7,
  current_occurrence: 1,
  pending_occurrence_job_run_id: null,
  next_occurrence_at: null,
  fields: [],
  groups: [],
  created_at: now,
  updated_at: now,
  ...overrides
});

const makeDb = (row: AssessmentDbResult) => {
  let stored = row;
  const governance = {
    createCase: vi.fn(async (input: Record<string, unknown>) => ({
      ...input,
      status: 'open'
    })) as unknown as (input: unknown) => Promise<GovernanceCaseDbResult>,
    createAssignment: vi.fn(async (input: unknown) => input),
    appendEvent: vi.fn(async (input: unknown) => input),
    listCases: vi.fn(async () => [] as GovernanceCaseDbResult[]),
    completeCaseIfOpen: vi.fn(async (id: string) => ({ id, status: 'completed' })) as unknown as (
      id: string,
      outcome: string | null,
      at: Date
    ) => Promise<GovernanceCaseDbResult | null>,
    supersedeAllOpenAssignmentsForCase: vi.fn(async () => [] as string[])
  };
  const jobs = {
    enqueueOneOffRun: vi.fn(async (input: Record<string, unknown>) => ({
      ...input,
      id: 'run-1'
    })),
    cancelQueuedRun: vi.fn(async () => null)
  };
  const db = {
    project: {
      getAssessmentById: vi.fn(async () => stored),
      updateAssessment: vi.fn(
        async (_ws: string, _pid: string, _id: string, patch: Partial<AssessmentDbResult>) => {
          stored = { ...stored, ...patch };
          return stored;
        }
      )
    },
    governance,
    notification: {
      markReadByAssignmentIds: vi.fn(async () => {}),
      markReadByCaseIds: vi.fn(async () => {})
    },
    jobs,
    core: {
      transaction: vi.fn((fn: (tx: DatabaseAdapter) => Promise<unknown>) =>
        fn(db as unknown as DatabaseAdapter)
      )
    }
  };
  return { db: db as unknown as DatabaseAdapter, jobs, governance, getStored: () => stored };
};

describe('scheduleNextAssessmentOccurrence', () => {
  it('does nothing for a non-recurring assessment', async () => {
    const row = baseRow({ recurrence: { type: 'none' } });
    const { db, jobs } = makeDb(row);

    const result = await scheduleNextAssessmentOccurrence(db, 'ws-1', row, now);

    expect(result).toBe(row);
    expect(jobs.enqueueOneOffRun).not.toHaveBeenCalled();
  });

  it('enqueues a one-off job at the next occurrence and stores its run id', async () => {
    const row = baseRow();
    const { db, jobs } = makeDb(row);

    const result = await scheduleNextAssessmentOccurrence(db, 'ws-1', row, now);

    expect(jobs.enqueueOneOffRun).toHaveBeenCalledWith(
      expect.objectContaining({
        job_type: ASSESSMENT_RECURRENCE_JOB_TYPE,
        payload: { assessmentId: 'assessment-1' },
        planned_at: new Date('2026-06-08T12:00:00.000Z')
      })
    );
    expect(result.pending_occurrence_job_run_id).toBe('run-1');
    expect(result.next_occurrence_at).toEqual(new Date('2026-06-08T12:00:00.000Z'));
  });

  it('preserves groups when scheduling the next occurrence', async () => {
    const row = baseRow({ groups: [{ id: 'g1', name: 'Basics' }] });
    const { db } = makeDb(row);

    const result = await scheduleNextAssessmentOccurrence(db, 'ws-1', row, now);

    expect(result.groups).toEqual([{ id: 'g1', name: 'Basics' }]);
  });
});

describe('cancelPendingAssessmentOccurrence', () => {
  it('does nothing when there is no pending job', async () => {
    const row = baseRow({ pending_occurrence_job_run_id: null });
    const { db, jobs } = makeDb(row);

    const result = await cancelPendingAssessmentOccurrence(db, 'ws-1', row, now);

    expect(result).toBe(row);
    expect(jobs.cancelQueuedRun).not.toHaveBeenCalled();
  });

  it('cancels the queued run and clears the pending fields', async () => {
    const row = baseRow({ pending_occurrence_job_run_id: 'run-1', next_occurrence_at: now });
    const { db, jobs } = makeDb(row);

    const result = await cancelPendingAssessmentOccurrence(db, 'ws-1', row, now);

    expect(jobs.cancelQueuedRun).toHaveBeenCalledWith('ws-1', 'run-1', now);
    expect(result.pending_occurrence_job_run_id).toBeNull();
    expect(result.next_occurrence_at).toBeNull();
  });
});

describe('createAssessmentRecurrenceJobHandler', () => {
  it('skips when the assessment is no longer open', async () => {
    const row = baseRow({ status: 'closed' });
    const { db, governance } = makeDb(row);
    const handler = createAssessmentRecurrenceJobHandler(db);

    const result = await handler({
      jobId: 'job-1',
      workspace: 'ws-1',
      payload: { assessmentId: 'assessment-1' },
      signal: new AbortController().signal
    });

    expect(result).toEqual({ skipped: true });
    expect(governance.createCase).not.toHaveBeenCalled();
  });

  it('closes the current cycle, bumps the occurrence, reopens governance, and reschedules', async () => {
    const row = baseRow({ pending_occurrence_job_run_id: 'run-0' });
    const { db, governance, getStored } = makeDb(row);
    const handler = createAssessmentRecurrenceJobHandler(db);

    const result = await handler({
      jobId: 'job-1',
      workspace: 'ws-1',
      payload: { assessmentId: 'assessment-1' },
      signal: new AbortController().signal
    });

    expect(governance.createCase).toHaveBeenCalledWith(
      expect.objectContaining({ subject_id: 'assessment-1' })
    );
    const stored = getStored();
    expect(stored.current_occurrence).toBe(2);
    expect(stored.due_at).not.toBeNull();
    expect(stored.pending_occurrence_job_run_id).toBe('run-1');
    expect(result).toMatchObject({ assessmentId: 'assessment-1', occurrence: 2 });
  });

  it('throws for a payload missing assessmentId', async () => {
    const row = baseRow();
    const { db } = makeDb(row);
    const handler = createAssessmentRecurrenceJobHandler(db);

    await expect(
      handler({
        jobId: 'job-1',
        workspace: 'ws-1',
        payload: {},
        signal: new AbortController().signal
      })
    ).rejects.toThrow(/invalid payload/);
  });
});
