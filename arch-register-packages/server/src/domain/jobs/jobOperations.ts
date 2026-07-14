import { randomUUID } from 'node:crypto';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import { httpAssert } from '../../utils/httpAssert';
import { buildApiAuthCtx, requireWorkspaceAdmin } from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { nextJobOccurrence, validateJobScheduleRecurrence } from './jobRecurrence';
import type {
  JobRunDbResult,
  JobRunListOptions,
  JobScheduleDbResult,
  JobScheduleRecurrence
} from './jobsDatabase';

export type CreateJobScheduleInput = {
  workspace: string;
  jobType: string;
  systemIdentity: string;
  payload: Record<string, unknown>;
  priority: number;
  recurrence: JobScheduleRecurrence;
  enabled?: boolean;
};

export type UpdateJobScheduleInput = Partial<Omit<CreateJobScheduleInput, 'workspace'>>;

const assertPriority = (priority: number) => {
  if (!Number.isInteger(priority) || priority < 1 || priority > 10) {
    throw new Error('Job priority must be an integer between 1 and 10');
  }
};

const assertScheduleText = (value: string, name: string) => {
  if (value.trim().length === 0) throw new Error(`${name} must not be empty`);
};

export const createJobSchedule = async (
  db: DatabaseAdapter,
  input: CreateJobScheduleInput,
  now = new Date()
): Promise<JobScheduleDbResult> => {
  assertScheduleText(input.jobType, 'jobType');
  assertScheduleText(input.systemIdentity, 'systemIdentity');
  assertPriority(input.priority);
  validateJobScheduleRecurrence(input.recurrence);

  const createdAt = new Date(now);
  return db.jobs.createSchedule({
    id: randomUUID(),
    workspace: input.workspace,
    job_type: input.jobType,
    system_identity: input.systemIdentity,
    payload: input.payload,
    priority: input.priority,
    recurrence: input.recurrence,
    enabled: input.enabled ?? true,
    next_occurrence_at: nextJobOccurrence(input.recurrence, now),
    created_at: createdAt,
    updated_at: createdAt
  });
};

export const updateJobSchedule = async (
  db: DatabaseAdapter,
  id: string,
  input: UpdateJobScheduleInput,
  now = new Date()
): Promise<JobScheduleDbResult | null> => {
  const existing = await db.jobs.getSchedule(id);
  if (!existing) return null;

  const jobType = input.jobType ?? existing.job_type;
  const systemIdentity = input.systemIdentity ?? existing.system_identity;
  const payload = input.payload ?? existing.payload;
  const priority = input.priority ?? existing.priority;
  const recurrence = input.recurrence ?? existing.recurrence;
  const enabled = input.enabled ?? existing.enabled;

  assertScheduleText(jobType, 'jobType');
  assertScheduleText(systemIdentity, 'systemIdentity');
  assertPriority(priority);
  validateJobScheduleRecurrence(recurrence);

  return db.jobs.updateSchedule(id, {
    job_type: jobType,
    system_identity: systemIdentity,
    payload,
    priority,
    recurrence,
    enabled,
    next_occurrence_at: nextJobOccurrence(recurrence, now),
    updated_at: now
  });
};

export const setJobScheduleEnabled = async (
  db: DatabaseAdapter,
  id: string,
  enabled: boolean,
  now = new Date()
): Promise<JobScheduleDbResult | null> => {
  const existing = await db.jobs.getSchedule(id);
  if (!existing) return null;

  return db.jobs.updateSchedule(id, {
    job_type: existing.job_type,
    system_identity: existing.system_identity,
    payload: existing.payload,
    priority: existing.priority,
    recurrence: existing.recurrence,
    enabled,
    next_occurrence_at: enabled
      ? nextJobOccurrence(existing.recurrence, now)
      : existing.next_occurrence_at,
    updated_at: now
  });
};

export const enqueueJobRun = async (db: DatabaseAdapter, scheduleId: string, now = new Date()) =>
  db.jobs.enqueueRun(scheduleId, now);

const parseOptionalDate = (value: string | undefined, name: string): Date | undefined => {
  if (value === undefined) return undefined;
  const date = new Date(value);
  httpAssert.true(!Number.isNaN(date.getTime()), {
    status: 400,
    statusText: 'Bad Request',
    message: `${name} must be a valid ISO timestamp`
  });
  return date;
};

export const toApiJobSchedule = (schedule: JobScheduleDbResult) => ({
  id: schedule.id,
  workspace: schedule.workspace,
  job_type: schedule.job_type,
  system_identity: schedule.system_identity,
  priority: schedule.priority,
  recurrence:
    schedule.recurrence.type === 'hours'
      ? { ...schedule.recurrence, startsAt: schedule.recurrence.startsAt.toISOString() }
      : schedule.recurrence,
  enabled: schedule.enabled,
  next_occurrence_at: schedule.next_occurrence_at.toISOString(),
  created_at: schedule.created_at.toISOString(),
  updated_at: schedule.updated_at.toISOString()
});

export const toApiJobRun = (run: JobRunDbResult, now = new Date()) => {
  const queueDelayEnd = run.started_at ?? (run.status === 'queued' ? now : null);
  const durationEnd = run.completed_at ?? (run.status === 'running' ? now : null);

  return {
    id: run.id,
    schedule_id: run.schedule_id,
    workspace: run.workspace,
    job_type: run.job_type,
    system_identity: run.system_identity,
    priority: run.priority,
    occurrence_at: run.occurrence_at.toISOString(),
    coalesced_through_at: run.coalesced_through_at.toISOString(),
    coalesced_count: run.coalesced_count,
    planned_at: run.planned_at.toISOString(),
    created_at: run.created_at.toISOString(),
    status: run.status,
    started_at: run.started_at?.toISOString() ?? null,
    completed_at: run.completed_at?.toISOString() ?? null,
    queue_delay_ms:
      queueDelayEnd == null
        ? null
        : Math.max(0, queueDelayEnd.getTime() - run.planned_at.getTime()),
    duration_ms:
      run.started_at == null || durationEnd == null
        ? null
        : Math.max(0, durationEnd.getTime() - run.started_at.getTime()),
    worker_id: run.worker_id,
    result: run.result,
    error: run.error
  };
};

type JobRunListQuery = {
  scheduleId?: string;
  status?: JobRunListOptions['status'];
  plannedFrom?: string;
  plannedTo?: string;
  limit?: number;
  offset?: number;
};

export const listJobSchedules = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceAdmin(authCtx);
  const schedules = await db.jobs.listSchedules(ws);
  return schedules.map(toApiJobSchedule);
};

export const listJobRuns = async (
  db: DatabaseAdapter,
  workspace: string,
  query: JobRunListQuery,
  event: AuthenticatedEvent,
  now = new Date()
) => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceAdmin(authCtx);

  const options: JobRunListOptions = {
    scheduleId: query.scheduleId,
    status: query.status,
    plannedFrom: parseOptionalDate(query.plannedFrom, 'plannedFrom'),
    plannedTo: parseOptionalDate(query.plannedTo, 'plannedTo'),
    limit: query.limit ?? 50,
    offset: query.offset ?? 0
  };
  const page = await db.jobs.listRuns(ws, options);

  return {
    items: page.items.map(run => toApiJobRun(run, now)),
    total: page.total,
    limit: options.limit,
    offset: options.offset
  };
};

export const cancelJobRun = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent,
  now = new Date()
) => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceAdmin(authCtx);

  const existing = await db.jobs.getRun(id);
  httpAssert.present(existing, {
    status: 404,
    statusText: 'Not Found',
    message: 'Job run not found'
  });
  httpAssert.true(existing.workspace === ws, {
    status: 404,
    statusText: 'Not Found',
    message: 'Job run not found'
  });
  httpAssert.true(existing.status === 'queued', {
    status: 409,
    statusText: 'Conflict',
    message: 'Only queued job runs can be cancelled'
  });

  const cancelled = await db.jobs.cancelQueuedRun(ws, id, now);
  if (cancelled) return toApiJobRun(cancelled, now);

  const current = await db.jobs.getRun(id);
  if (current?.workspace === ws && current.status !== 'queued') {
    httpAssert.true(false, {
      status: 409,
      statusText: 'Conflict',
      message: 'Only queued job runs can be cancelled'
    });
  }
  httpAssert.present(cancelled, {
    status: 404,
    statusText: 'Not Found',
    message: 'Job run not found'
  });
  return toApiJobRun(cancelled, now);
};
