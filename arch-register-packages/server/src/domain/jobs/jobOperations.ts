import { randomUUID } from 'node:crypto';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import type { CreateJobBody, TechnologyEolMapping } from '@arch-register/api-types/jobsContract';
import { httpAssert } from '../../utils/httpAssert';
import {
  buildApiAuthCtx,
  requireWorkspaceAdmin,
  requireWorkspaceCapability
} from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { nextJobOccurrence, validateJobScheduleRecurrence } from './jobRecurrence';
import type {
  JobRunDbResult,
  JobRunListOptions,
  JobServerDbResult,
  JobServerStatus,
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

export const JOB_SERVER_UNAVAILABLE_AFTER_MS = 2 * 60 * 1000;

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

export const enqueueOneOffJobRun = async (
  db: DatabaseAdapter,
  input: {
    id?: string;
    workspace: string;
    jobType: string;
    systemIdentity: string;
    payload: Record<string, unknown>;
    priority?: number;
    maxAttempts?: number;
  },
  now = new Date()
) => {
  const priority = input.priority ?? 5;
  const maxAttempts = input.maxAttempts ?? 1;
  assertScheduleText(input.jobType, 'jobType');
  assertScheduleText(input.systemIdentity, 'systemIdentity');
  assertPriority(priority);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('maxAttempts must be a positive integer');
  }
  return db.jobs.enqueueOneOffRun({
    id: input.id ?? randomUUID(),
    workspace: input.workspace,
    job_type: input.jobType,
    system_identity: input.systemIdentity,
    payload: input.payload,
    priority,
    planned_at: now,
    created_at: now,
    max_attempts: maxAttempts
  });
};

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

export const toApiJobSchedule = (
  schedule: JobScheduleDbResult,
  targetSchema: { id: string; name: string | null } | null = null
) => ({
  id: schedule.id,
  workspace: schedule.workspace,
  job_type: schedule.job_type,
  system_identity: schedule.system_identity,
  target_schema_id: targetSchema?.id ?? null,
  target_schema_name: targetSchema?.name ?? null,
  priority: schedule.priority,
  recurrence:
    schedule.recurrence.type === 'hours' || schedule.recurrence.type === 'minutes'
      ? { ...schedule.recurrence, startsAt: schedule.recurrence.startsAt.toISOString() }
      : schedule.recurrence,
  enabled: schedule.enabled,
  next_occurrence_at: schedule.next_occurrence_at.toISOString(),
  created_at: schedule.created_at.toISOString(),
  updated_at: schedule.updated_at.toISOString()
});

export const createConfiguredJob = async (
  db: DatabaseAdapter,
  workspace: string,
  body: CreateJobBody,
  event: AuthenticatedEvent
) => {
  if (body.jobType === TECHNOLOGY_EOL_JOB_TYPE) {
    return createTechnologyEolJob(db, workspace, body, event);
  }
  throw new Error(`Unsupported job type '${body.jobType}'`);
};

export const toApiJobServer = (server: JobServerDbResult, now = new Date()) => {
  const status: JobServerStatus =
    server.status === 'available' &&
    now.getTime() - server.last_seen_at.getTime() < JOB_SERVER_UNAVAILABLE_AFTER_MS
      ? 'available'
      : 'unavailable';
  return {
    id: server.id,
    name: server.name,
    status,
    last_seen_at: server.last_seen_at.toISOString()
  };
};

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
    error: run.error,
    attempt_count: run.attempt_count,
    max_attempts: run.max_attempts
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

/**
 * `jobType` is not part of the public `runs.list` filter query (it's fixed per-caller, e.g.
 * automation rule runs always pass `automation-rule.execute`), so it's a separate parameter
 * rather than part of `JobRunListQuery`.
 */

export const listJobServers = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  now = new Date()
) => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceAdmin(authCtx);
  const servers = await db.jobs.listServers();
  return servers.map(server => toApiJobServer(server, now));
};

export const listJobSchedules = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceAdmin(authCtx);
  const [schedules, schemas] = await Promise.all([
    db.jobs.listSchedules(ws),
    db.catalog.listSchemas(ws)
  ]);
  const schemaNames = new Map(schemas.map(schema => [schema.id, schema.name]));
  return schedules.map(schedule =>
    toApiJobSchedule(
      schedule,
      typeof schedule.payload['schemaId'] === 'string'
        ? {
            id: schedule.payload['schemaId'],
            name: schemaNames.get(schedule.payload['schemaId']) ?? null
          }
        : null
    )
  );
};

const TECHNOLOGY_EOL_JOB_TYPE = 'technology-eol';
const TECHNOLOGY_EOL_SYSTEM_IDENTITY = 'technology-eol';

const destinationFieldIds = (mapping: TechnologyEolMapping) =>
  [
    mapping.latestVersionFieldId,
    mapping.releaseDateFieldId,
    mapping.supportUntilFieldId,
    mapping.securityUntilFieldId,
    mapping.eolDateFieldId,
    mapping.sourceUrlFieldId,
    mapping.synchronizedAtFieldId
  ].filter((fieldId): fieldId is string => fieldId != null);

const compatibleField = (field: { type: string }, role: 'text' | 'date') =>
  role === 'text'
    ? field.type === 'text' || field.type === 'longtext'
    : field.type === 'date' || field.type === 'text' || field.type === 'longtext';

const assertTechnologyEolMapping = (
  schema: Awaited<ReturnType<DatabaseAdapter['catalog']['getSchema']>>,
  mapping: TechnologyEolMapping
) => {
  if (!schema) {
    httpAssert.present(schema, { status: 404, message: 'Target schema not found' });
    throw new Error('Target schema not found');
  }
  const fields = new Map(schema.fields.map(field => [field.id, field]));
  const inputFields = [mapping.productFieldId, mapping.cycleFieldId];
  for (const fieldId of inputFields) {
    const field = fields.get(fieldId);
    httpAssert.present(field, { status: 400, message: `Input field '${fieldId}' was not found` });
    httpAssert.true(compatibleField(field!, 'text'), {
      status: 400,
      message: `Input field '${fieldId}' must be a text field`
    });
  }

  const destinations = destinationFieldIds(mapping);
  httpAssert.true(new Set(destinations).size === destinations.length, {
    status: 400,
    message: 'Each destination field can only be mapped once'
  });
  httpAssert.true(!destinations.some(fieldId => inputFields.includes(fieldId)), {
    status: 400,
    message: 'Input fields cannot also be destination fields'
  });
  for (const fieldId of destinations) {
    const field = fields.get(fieldId);
    httpAssert.present(field, {
      status: 400,
      message: `Destination field '${fieldId}' was not found`
    });
    httpAssert.true(
      compatibleField(field!, fieldId === mapping.sourceUrlFieldId ? 'text' : 'date'),
      {
        status: 400,
        message: `Destination field '${fieldId}' has an incompatible type`
      }
    );
  }
  return schema;
};

const createTechnologyEolJob = async (
  db: DatabaseAdapter,
  workspace: string,
  body: Extract<CreateJobBody, { jobType: 'technology-eol' }>,
  event: AuthenticatedEvent
) => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceAdmin(authCtx);
  requireWorkspaceCapability(authCtx, 'schema.edit');

  const now = new Date();
  return db.core.transaction(async tx => {
    const schema = await tx.catalog.getSchema(ws, body.schemaId);
    const targetSchema = assertTechnologyEolMapping(schema, body.mapping);
    const schedules = await tx.jobs.listSchedules(ws);
    httpAssert.true(
      !schedules.some(
        schedule =>
          schedule.job_type === TECHNOLOGY_EOL_JOB_TYPE &&
          schedule.payload['schemaId'] === body.schemaId
      ),
      { status: 409, message: 'A Technology End of Life job already exists for this schema' }
    );

    const destinationIds = new Set(destinationFieldIds(body.mapping));
    const nextFields = targetSchema.fields.map(field =>
      destinationIds.has(field.id)
        ? { ...field, external_kind: 'integration' as const, refresh_mode: 'scheduled' as const }
        : field
    );
    const updatedSchema = await tx.catalog.updateSchema(ws, targetSchema.id, {
      name: targetSchema.name,
      key_prefix: targetSchema.key_prefix,
      description: targetSchema.description,
      fields: nextFields,
      templates: targetSchema.templates ?? [],
      color: targetSchema.color,
      icon: targetSchema.icon,
      default_owner: targetSchema.default_owner,
      entity_approval_policy: targetSchema.entity_approval_policy,
      deprecation_policy: targetSchema.deprecation_policy,
      version: (targetSchema.version ?? 1) + 1,
      updated_at: now
    });
    httpAssert.present(updatedSchema, { status: 404, message: 'Target schema not found' });

    await tx.catalog.createSchemaVersion({
      id: randomUUID(),
      workspace: ws,
      schema_id: targetSchema.id,
      version: updatedSchema.version ?? 1,
      name: updatedSchema.name,
      description: updatedSchema.description,
      fields: updatedSchema.fields,
      templates: updatedSchema.templates ?? [],
      color: updatedSchema.color,
      icon: updatedSchema.icon,
      change_summary: { source: TECHNOLOGY_EOL_JOB_TYPE, externalFields: [...destinationIds] },
      created_by: authCtx.userId,
      created_at: now
    });

    await tx.audit.createAuditLog({
      workspace: ws,
      timestamp: now,
      user_id: authCtx.userId,
      operation: 'update',
      entity_type: 'entity_schema',
      entity_id: targetSchema.id,
      entity_name: targetSchema.name,
      entity_slug: null,
      schema_id: targetSchema.id,
      changes: { old: { fields: targetSchema.fields }, new: { fields: updatedSchema.fields } },
      metadata: { source: TECHNOLOGY_EOL_JOB_TYPE, externalFields: [...destinationIds] }
    });

    const recurrence =
      body.frequency.unit === 'minutes'
        ? {
            type: 'minutes' as const,
            intervalMinutes: body.frequency.value,
            startsAt: new Date(now.getTime() + body.frequency.value * 60_000)
          }
        : {
            type: 'hours' as const,
            intervalHours: body.frequency.value,
            startsAt: new Date(now.getTime() + body.frequency.value * 3_600_000)
          };
    const schedule = await createJobSchedule(
      tx,
      {
        workspace: ws,
        jobType: TECHNOLOGY_EOL_JOB_TYPE,
        systemIdentity: TECHNOLOGY_EOL_SYSTEM_IDENTITY,
        payload: { schemaId: targetSchema.id, mapping: body.mapping },
        priority: 5,
        recurrence
      },
      now
    );
    return toApiJobSchedule(schedule, { id: targetSchema.id, name: targetSchema.name });
  });
};

export type ApiJobScheduleRecurrence =
  | { type: 'minutes'; intervalMinutes: number; startsAt: string }
  | { type: 'hours'; intervalHours: number; startsAt: string }
  | { type: 'daily'; timeUtc: string }
  | { type: 'weekly'; weekdayUtc: number; timeUtc: string };

export type WorkspaceJobScheduleUpdate = {
  priority?: number;
  recurrence?: ApiJobScheduleRecurrence;
  enabled?: boolean;
};

const fromApiRecurrence = (recurrence: ApiJobScheduleRecurrence): JobScheduleRecurrence => {
  if (recurrence.type === 'minutes' || recurrence.type === 'hours') {
    const startsAt = new Date(recurrence.startsAt);
    httpAssert.true(!Number.isNaN(startsAt.getTime()), {
      status: 400,
      statusText: 'Bad Request',
      message: 'recurrence.startsAt must be a valid ISO timestamp'
    });
    return { ...recurrence, startsAt };
  }
  return recurrence;
};

export const updateWorkspaceJobSchedule = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  input: WorkspaceJobScheduleUpdate,
  event: AuthenticatedEvent,
  now = new Date()
) => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceAdmin(authCtx);

  const existing = await db.jobs.getSchedule(id);
  httpAssert.present(existing, {
    status: 404,
    statusText: 'Not Found',
    message: 'Job schedule not found'
  });
  httpAssert.true(existing.workspace === ws, {
    status: 404,
    statusText: 'Not Found',
    message: 'Job schedule not found'
  });

  const updated = await updateJobSchedule(
    db,
    id,
    {
      priority: input.priority,
      recurrence: input.recurrence ? fromApiRecurrence(input.recurrence) : undefined,
      enabled: input.enabled
    },
    now
  );
  httpAssert.present(updated, {
    status: 404,
    statusText: 'Not Found',
    message: 'Job schedule not found'
  });
  return toApiJobSchedule(updated);
};

export const triggerJobScheduleRun = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent,
  now = new Date()
) => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceAdmin(authCtx);

  const existing = await db.jobs.getSchedule(id);
  httpAssert.present(existing, {
    status: 404,
    statusText: 'Not Found',
    message: 'Job schedule not found'
  });
  httpAssert.true(existing.workspace === ws, {
    status: 404,
    statusText: 'Not Found',
    message: 'Job schedule not found'
  });
  httpAssert.true(existing.enabled, {
    status: 409,
    statusText: 'Conflict',
    message: 'Disabled job schedules cannot be run'
  });

  const run = await enqueueJobRun(db, id, now);
  httpAssert.present(run, {
    status: 409,
    statusText: 'Conflict',
    message: 'Disabled job schedules cannot be run'
  });
  return toApiJobRun(run, now);
};

export const listJobRuns = async (
  db: DatabaseAdapter,
  workspace: string,
  query: JobRunListQuery,
  event: AuthenticatedEvent,
  now = new Date(),
  jobType?: string
) => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceAdmin(authCtx);

  const options: JobRunListOptions = {
    scheduleId: query.scheduleId,
    jobType,
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
