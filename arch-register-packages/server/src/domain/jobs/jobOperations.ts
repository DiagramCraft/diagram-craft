import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import { nextJobOccurrence, validateJobScheduleRecurrence } from './jobRecurrence';
import type { JobScheduleDbResult, JobScheduleRecurrence } from './jobsDatabase';

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
