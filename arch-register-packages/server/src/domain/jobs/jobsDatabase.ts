import {
  databaseBoolean,
  databaseDate,
  parseDatabaseJson,
  type DatabaseRow
} from '../../db/rowMappers';

export type JobScheduleRecurrence =
  | {
      type: 'hours';
      intervalHours: number;
      startsAt: Date;
    }
  | {
      type: 'minutes';
      intervalMinutes: number;
      startsAt: Date;
    }
  | {
      type: 'daily';
      timeUtc: string;
    }
  | {
      type: 'weekly';
      weekdayUtc: number;
      timeUtc: string;
    };

export type JobRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type JobServerStatus = 'available' | 'unavailable';

export type JobServerDbResult = {
  id: string;
  name: string;
  instance_id: string;
  status: JobServerStatus;
  last_seen_at: Date;
};

export type JobServerDbRegistration = JobServerDbResult;

export type JobScheduleDbResult = {
  id: string;
  workspace: string;
  job_type: string;
  system_identity: string;
  payload: Record<string, unknown>;
  priority: number;
  recurrence: JobScheduleRecurrence;
  enabled: boolean;
  next_occurrence_at: Date;
  created_at: Date;
  updated_at: Date;
};

export type JobScheduleDbCreate = JobScheduleDbResult;

export type JobScheduleDbUpdate = {
  job_type: string;
  system_identity: string;
  payload: Record<string, unknown>;
  priority: number;
  recurrence: JobScheduleRecurrence;
  enabled: boolean;
  next_occurrence_at: Date;
  updated_at: Date;
};

export type JobRunDbResult = {
  id: string;
  schedule_id: string | null;
  workspace: string;
  job_type: string;
  system_identity: string;
  payload: Record<string, unknown>;
  priority: number;
  occurrence_at: Date;
  coalesced_through_at: Date;
  coalesced_count: number;
  planned_at: Date;
  created_at: Date;
  status: JobRunStatus;
  started_at: Date | null;
  completed_at: Date | null;
  worker_id: string | null;
  lease_token: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  attempt_count: number;
  max_attempts: number;
};

export type OneOffJobRunDbCreate = {
  id: string;
  workspace: string;
  job_type: string;
  system_identity: string;
  payload: Record<string, unknown>;
  priority: number;
  planned_at: Date;
  created_at: Date;
  max_attempts: number;
};

export type JobRunClaim = {
  run: JobRunDbResult;
  leaseToken: string;
};

export type JobRunCompletion = {
  runId: string;
  workerId: string;
  leaseToken: string;
  completedAt: Date;
  result?: Record<string, unknown> | null;
};

export type JobRunFailure = {
  runId: string;
  workerId: string;
  leaseToken: string;
  completedAt: Date;
  error: string;
};

export type JobRunRetry = Omit<JobRunFailure, 'completedAt'> & {
  attemptedAt: Date;
  retryAt: Date;
};

export type JobRunListOptions = {
  scheduleId?: string;
  status?: JobRunStatus;
  plannedFrom?: Date;
  plannedTo?: Date;
  limit: number;
  offset: number;
};

export type JobRunPage = {
  items: JobRunDbResult[];
  total: number;
};

export type JobDatabase = {
  registerServer(input: JobServerDbRegistration): Promise<JobServerDbResult>;
  heartbeatServer(id: string, instanceId: string, lastSeenAt: Date): Promise<boolean>;
  markServerUnavailable(id: string, instanceId: string, lastSeenAt: Date): Promise<boolean>;
  listServers(): Promise<JobServerDbResult[]>;

  createSchedule(input: JobScheduleDbCreate): Promise<JobScheduleDbResult>;
  updateSchedule(id: string, input: JobScheduleDbUpdate): Promise<JobScheduleDbResult | null>;
  getSchedule(id: string): Promise<JobScheduleDbResult | null>;
  listSchedules(workspace?: string): Promise<JobScheduleDbResult[]>;

  listRuns(workspace: string, options: JobRunListOptions): Promise<JobRunPage>;
  getRun(id: string): Promise<JobRunDbResult | null>;
  cancelQueuedRun(workspace: string, id: string, completedAt: Date): Promise<JobRunDbResult | null>;

  materializeDueSchedules(now: Date): Promise<number>;
  enqueueRun(scheduleId: string, now: Date): Promise<JobRunDbResult | null>;
  enqueueOneOffRun(input: OneOffJobRunDbCreate): Promise<JobRunDbResult>;
  recoverExpiredRuns(now: Date): Promise<number>;
  claimNextRun(workerId: string, leaseDurationMs: number, now: Date): Promise<JobRunClaim | null>;
  heartbeatRun(
    runId: string,
    workerId: string,
    leaseToken: string,
    heartbeatAt: Date,
    leaseExpiresAt: Date
  ): Promise<boolean>;
  completeRun(input: JobRunCompletion): Promise<boolean>;
  failRun(input: JobRunFailure): Promise<boolean>;
  retryRun(input: JobRunRetry): Promise<boolean>;
};

export const jobMappers = {
  server: (row: DatabaseRow): JobServerDbResult => ({
    id: String(row['id']),
    name: String(row['name']),
    instance_id: String(row['instance_id']),
    status: String(row['status']) as JobServerStatus,
    last_seen_at: databaseDate(row['last_seen_at'])
  }),
  schedule: (row: DatabaseRow): JobScheduleDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    job_type: String(row['job_type']),
    system_identity: String(row['system_identity']),
    payload: parseDatabaseJson(row['payload'], {}, 'job_schedule.payload'),
    priority: Number(row['priority']),
    recurrence: (() => {
      const recurrence = parseDatabaseJson<JobScheduleRecurrence>(
        row['recurrence'],
        { type: 'daily', timeUtc: '00:00' },
        'job_schedule.recurrence'
      );
      return recurrence.type === 'hours' || recurrence.type === 'minutes'
        ? { ...recurrence, startsAt: databaseDate(recurrence.startsAt) }
        : recurrence;
    })(),
    enabled: databaseBoolean(row['enabled']),
    next_occurrence_at: databaseDate(row['next_occurrence_at']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  }),
  run: (row: DatabaseRow): JobRunDbResult => ({
    id: String(row['id']),
    schedule_id: row['schedule_id'] == null ? null : String(row['schedule_id']),
    workspace: String(row['workspace']),
    job_type: String(row['job_type']),
    system_identity: String(row['system_identity']),
    payload: parseDatabaseJson(row['payload'], {}, 'job_run.payload'),
    priority: Number(row['priority']),
    occurrence_at: databaseDate(row['occurrence_at']),
    coalesced_through_at: databaseDate(row['coalesced_through_at']),
    coalesced_count: Number(row['coalesced_count']),
    planned_at: databaseDate(row['planned_at']),
    created_at: databaseDate(row['created_at']),
    status: String(row['status']) as JobRunStatus,
    started_at: row['started_at'] == null ? null : databaseDate(row['started_at']),
    completed_at: row['completed_at'] == null ? null : databaseDate(row['completed_at']),
    worker_id: row['worker_id'] == null ? null : String(row['worker_id']),
    lease_token: row['lease_token'] == null ? null : String(row['lease_token']),
    result: row['result'] == null ? null : parseDatabaseJson(row['result'], {}, 'job_run.result'),
    error: row['error'] == null ? null : String(row['error']),
    attempt_count: Number(row['attempt_count'] ?? 0),
    max_attempts: Number(row['max_attempts'] ?? 1)
  })
};
