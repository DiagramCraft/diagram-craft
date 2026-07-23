import type { DatabaseAdapter } from '../../db/database';
import { computeEntityCompleteness } from '../../utils/completeness';
import { listAllCatalogEntities } from './entityLoader';
import { createJobSchedule, updateJobSchedule } from '../jobs/jobOperations';

// `entity.completeness` is kept in sync synchronously at write time (entityMutations.ts). This
// job exists only for the cases that write path can't cover on its own: recomputing every entity
// of a schema after its field `requirementLevel`s change (enqueued as a one-off from
// schemaOperations.ts#updateWorkspaceSchema), and a recurring safety-net scan that catches drift
// from manual DB edits, bugs, or future write paths that forget to recompute — it also serves as
// the initial backfill for entities that existed before this column did.
export const ENTITY_COMPLETENESS_JOB_TYPE = 'entity-completeness.recompute';
export const ENTITY_COMPLETENESS_SCAN_JOB_TYPE = 'entity-completeness.recompute-scan';
export const ENTITY_COMPLETENESS_SYSTEM_IDENTITY = 'entity-completeness';
export const ENTITY_COMPLETENESS_SCAN_INTERVAL_MINUTES = 24 * 60;

type EntityCompletenessJobPayload = {
  schemaId?: string;
};

const isEntityCompletenessJobPayload = (
  value: Record<string, unknown>
): value is EntityCompletenessJobPayload =>
  value['schemaId'] === undefined || typeof value['schemaId'] === 'string';

const recomputeForWorkspace = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string | undefined,
  signal: AbortSignal
) => {
  const [schemas, entities] = await Promise.all([
    db.catalog.listSchemas(workspace),
    listAllCatalogEntities(db, workspace, schemaId ? { schemaId } : undefined)
  ]);
  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
  let updated = 0;

  for (const entity of entities) {
    if (signal.aborted) break;
    const schema = schemaById.get(entity.schema_id);
    if (!schema) continue;
    const completeness = computeEntityCompleteness(entity, schema);
    if (completeness === entity.completeness) continue;
    await db.catalog.updateEntityCompleteness(workspace, entity.id, completeness);
    updated++;
  }

  return { processed: entities.length, updated };
};

export const createEntityCompletenessJobHandler =
  (db: DatabaseAdapter) =>
  async (context: {
    jobId: string;
    workspace: string;
    payload: Record<string, unknown>;
    signal: AbortSignal;
  }) => {
    if (!isEntityCompletenessJobPayload(context.payload)) {
      throw new Error('Entity completeness job has an invalid payload');
    }
    return recomputeForWorkspace(db, context.workspace, context.payload.schemaId, context.signal);
  };

// Self-heals a recurring workspace-wide scan schedule, called lazily from
// schemaOperations.ts#updateWorkspaceSchema the same way document metadata generation schedules
// itself from the document write path — no separate server-boot wiring needed.
export const ensureEntityCompletenessScanScheduleExists = async (
  db: DatabaseAdapter,
  workspace: string,
  now: Date
) => {
  const schedules = await db.jobs.listSchedules(workspace);
  const existing = schedules.find(
    schedule => schedule.job_type === ENTITY_COMPLETENESS_SCAN_JOB_TYPE
  );
  if (existing) {
    if (
      existing.recurrence.type !== 'minutes' ||
      existing.recurrence.intervalMinutes !== ENTITY_COMPLETENESS_SCAN_INTERVAL_MINUTES
    ) {
      await updateJobSchedule(
        db,
        existing.id,
        {
          recurrence: {
            type: 'minutes',
            intervalMinutes: ENTITY_COMPLETENESS_SCAN_INTERVAL_MINUTES,
            startsAt: now
          }
        },
        now
      );
    }
    return;
  }
  await createJobSchedule(
    db,
    {
      workspace,
      jobType: ENTITY_COMPLETENESS_SCAN_JOB_TYPE,
      systemIdentity: ENTITY_COMPLETENESS_SYSTEM_IDENTITY,
      payload: {},
      priority: 9,
      recurrence: {
        type: 'minutes',
        intervalMinutes: ENTITY_COMPLETENESS_SCAN_INTERVAL_MINUTES,
        startsAt: now
      }
    },
    now
  );
};
