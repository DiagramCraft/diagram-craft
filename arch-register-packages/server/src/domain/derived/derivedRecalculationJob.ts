import type { DatabaseAdapter } from '../../db/database';
import type { DerivableField } from './derivedFields';
import { buildDerivedPlan, type DerivedRecalcInterval } from './derivedFields';
import { recalculateEntityDerivedFields } from './derivedRecalculation';
import { createJobSchedule, setJobScheduleEnabled, updateJobSchedule } from '../jobs/jobOperations';
import type { JobScheduleRecurrence } from '../jobs/jobsDatabase';
import { createLogger } from '../../utils/logger';

// Derived-field values are normally re-materialized synchronously on every entity/relation/schema/
// field-group mutation. That write path cannot cover a value that depends on the current date
// (`<root>.now`): `daysBetween(entity.now, entity.review_date)` crosses the "approaching" →
// "overdue" boundary purely with elapsed time, no write. This recurring scan recomputes the whole
// workspace so such values keep advancing; it also backfills entities that predate a new
// time-dependent derived field.
export const DERIVED_RECALC_SCAN_JOB_TYPE = 'derived-fields.recalculate-scan';
export const DERIVED_RECALC_SYSTEM_IDENTITY = 'derived-fields-recalc';

const logger = createLogger('derived-recalc-job');

export const createDerivedRecalculationJobHandler =
  (db: DatabaseAdapter) =>
  async (context: {
    jobId: string;
    workspace: string;
    payload: Record<string, unknown>;
    signal: AbortSignal;
  }) => {
    if (context.signal.aborted) return { recalculated: false };
    const recalculated = await recalculateEntityDerivedFields(db, context.workspace);
    return { recalculated };
  };

/** Recalc cadences present across every entity + relation schema in the workspace. */
const workspaceRecalcIntervals = async (
  db: DatabaseAdapter,
  workspace: string
): Promise<Set<DerivedRecalcInterval>> => {
  const [entitySchemas, relationSchemas] = await Promise.all([
    db.catalog.listSchemas(workspace),
    db.relation.listRelationSchemas(workspace)
  ]);
  const intervals = new Set<DerivedRecalcInterval>();
  const scan = (fields: DerivableField[], root: 'entity' | 'relation') => {
    try {
      for (const field of buildDerivedPlan(fields, root).fields) {
        if (field.recalcInterval) intervals.add(field.recalcInterval);
      }
    } catch (error) {
      // A schema that currently fails to compile can't contribute a cadence; the schema-write
      // path is where that error is surfaced to the author.
      logger.warn('Skipped schema while resolving derived recalc cadence', {
        workspace,
        root,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };
  for (const schema of entitySchemas) scan(schema.fields as DerivableField[], 'entity');
  for (const schema of relationSchemas) scan(schema.fields as DerivableField[], 'relation');
  return intervals;
};

const desiredRecurrence = (
  intervals: Set<DerivedRecalcInterval>,
  now: Date
): JobScheduleRecurrence | null => {
  if (intervals.has('hourly')) return { type: 'hours', intervalHours: 1, startsAt: now };
  if (intervals.has('daily')) return { type: 'daily', timeUtc: '02:00' };
  return null;
};

const recurrenceMatches = (a: JobScheduleRecurrence, b: JobScheduleRecurrence): boolean => {
  if (a.type !== b.type) return false;
  if (a.type === 'hours' && b.type === 'hours') return a.intervalHours === b.intervalHours;
  if (a.type === 'daily' && b.type === 'daily') return a.timeUtc === b.timeUtc;
  return false;
};

/**
 * Converges the single `derived-fields.recalculate-scan` schedule for a workspace to match the
 * finest recalc cadence its schemas declare (hourly beats daily), disabling it when no
 * time-dependent derived field remains. Called lazily from the schema / field-group / relation-
 * schema write paths, mirroring `ensureEntityCompletenessScanScheduleExists`.
 */
export const ensureDerivedRecalculationScheduleExists = async (
  db: DatabaseAdapter,
  workspace: string,
  now: Date
) => {
  const desired = desiredRecurrence(await workspaceRecalcIntervals(db, workspace), now);
  const existing = (await db.jobs.listSchedules(workspace)).find(
    schedule => schedule.job_type === DERIVED_RECALC_SCAN_JOB_TYPE
  );

  if (!desired) {
    if (existing?.enabled) await setJobScheduleEnabled(db, existing.id, false, now);
    return;
  }

  if (!existing) {
    await createJobSchedule(
      db,
      {
        workspace,
        jobType: DERIVED_RECALC_SCAN_JOB_TYPE,
        systemIdentity: DERIVED_RECALC_SYSTEM_IDENTITY,
        payload: {},
        priority: 9,
        recurrence: desired
      },
      now
    );
    return;
  }

  if (!existing.enabled || !recurrenceMatches(existing.recurrence, desired)) {
    await updateJobSchedule(db, existing.id, { recurrence: desired, enabled: true }, now);
  }
};
