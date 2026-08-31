import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { JobScheduleDbResult } from '../jobs/jobsDatabase';
import { recalculateEntityDerivedFields } from './derivedRecalculation';
import {
  DERIVED_RECALC_SCAN_JOB_TYPE,
  ensureDerivedRecalculationScheduleExists
} from './derivedRecalculationJob';

const reviewStatusField = {
  id: 'review_status',
  name: 'Review Status',
  type: 'derived' as const,
  requirementLevel: 'optional' as const,
  resultType: 'text' as const,
  recalc_interval: 'daily' as const,
  expression:
    "daysBetween(entity.now, entity.review_date) == null ? 'incomplete' " +
    ": daysBetween(entity.now, entity.review_date) < 0 ? 'overdue' " +
    ": daysBetween(entity.now, entity.review_date) <= 30 ? 'approaching' : 'current'"
};

const schema = (id: string, fields: SchemaDbResult['fields']) =>
  ({
    id,
    workspace: 'workspace-1',
    name: id,
    description: '',
    fields,
    groups: [],
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: id.slice(0, 3).toUpperCase(),
    created_at: new Date(0),
    updated_at: new Date(0)
  }) as SchemaDbResult;

const entity = (id: string, schemaId: string, data: Record<string, unknown>) =>
  ({
    id,
    workspace: 'workspace-1',
    public_id: id,
    slug: id,
    namespace: '',
    name: id,
    description: '',
    owner: null,
    lifecycle: null,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: [],
    links: [],
    schema_id: schemaId,
    data,
    project_id: null,
    completeness: 0,
    created_at: new Date(0),
    updated_at: new Date(0),
    owner_name: null,
    lifecycle_label: null,
    target_lifecycle_label: null,
    schema_name: schemaId
  }) as EntityDbResult;

type ScheduleStore = {
  db: DatabaseAdapter;
  schedules: JobScheduleDbResult[];
};

const scheduleDb = (entitySchemas: SchemaDbResult[]): ScheduleStore => {
  const schedules: JobScheduleDbResult[] = [];
  const db = {
    catalog: { listSchemas: async () => entitySchemas },
    relation: { listRelationSchemas: async () => [] },
    jobs: {
      listSchedules: async () => schedules,
      getSchedule: async (id: string) => schedules.find(s => s.id === id) ?? null,
      createSchedule: async (input: JobScheduleDbResult) => {
        schedules.push(input);
        return input;
      },
      updateSchedule: async (id: string, patch: Partial<JobScheduleDbResult>) => {
        const target = schedules.find(s => s.id === id)!;
        Object.assign(target, patch);
        return target;
      }
    }
  } as unknown as DatabaseAdapter;
  return { db, schedules };
};

describe('ensureDerivedRecalculationScheduleExists', () => {
  const now = new Date('2026-03-01T00:00:00.000Z');

  it('creates no schedule when no schema has a time-dependent derived field', async () => {
    const { db, schedules } = scheduleDb([schema('data-entity', [])]);
    await ensureDerivedRecalculationScheduleExists(db, 'workspace-1', now);
    expect(schedules).toHaveLength(0);
  });

  it('creates a daily schedule for a daily recalc_interval field', async () => {
    const { db, schedules } = scheduleDb([
      schema('data-entity', [
        { id: 'review_date', name: 'Review Date', type: 'date' } as SchemaDbResult['fields'][number],
        reviewStatusField
      ])
    ]);
    await ensureDerivedRecalculationScheduleExists(db, 'workspace-1', now);
    expect(schedules).toHaveLength(1);
    expect(schedules[0]!.job_type).toBe(DERIVED_RECALC_SCAN_JOB_TYPE);
    expect(schedules[0]!.recurrence).toEqual({ type: 'daily', timeUtc: '02:00' });
  });

  it('upgrades the cadence to hourly and disables it again when the field is removed', async () => {
    const dateField = {
      id: 'review_date',
      name: 'Review Date',
      type: 'date'
    } as SchemaDbResult['fields'][number];
    const schemas = [schema('data-entity', [dateField, reviewStatusField])];
    const { db, schedules } = scheduleDb(schemas);

    await ensureDerivedRecalculationScheduleExists(db, 'workspace-1', now);

    schemas[0]!.fields = [
      dateField,
      { ...reviewStatusField, recalc_interval: 'hourly' as const }
    ];
    await ensureDerivedRecalculationScheduleExists(db, 'workspace-1', now);
    expect(schedules).toHaveLength(1);
    expect(schedules[0]!.recurrence).toEqual({ type: 'hours', intervalHours: 1, startsAt: now });
    expect(schedules[0]!.enabled).toBe(true);

    schemas[0]!.fields = [dateField];
    await ensureDerivedRecalculationScheduleExists(db, 'workspace-1', now);
    expect(schedules[0]!.enabled).toBe(false);
  });
});

describe('derived recalculation with elapsed time', () => {
  it('advances review_status from approaching to overdue with no entity write', async () => {
    const dataEntity = entity('asset-1', 'data-entity', { review_date: '2026-03-10' });
    const schemas = [
      schema('data-entity', [
        { id: 'review_date', name: 'Review Date', type: 'date' } as SchemaDbResult['fields'][number],
        reviewStatusField
      ])
    ];
    const db = {
      catalog: {
        listEntities: async () => [dataEntity],
        listSchemas: async () => schemas,
        updateEntityDerivedFields: async (
          _workspace: string,
          _id: string,
          data: Record<string, unknown>
        ) => {
          dataEntity.data = data;
        }
      },
      relation: {
        listRelationsForEntities: async () => ({ outgoing: [], incoming: [] })
      }
    } as unknown as DatabaseAdapter;

    await recalculateEntityDerivedFields(
      db,
      'workspace-1',
      undefined,
      new Date('2026-03-01T00:00:00.000Z')
    );
    expect(dataEntity.data.review_status).toBe('approaching');

    await recalculateEntityDerivedFields(
      db,
      'workspace-1',
      undefined,
      new Date('2026-03-20T00:00:00.000Z')
    );
    expect(dataEntity.data.review_status).toBe('overdue');
  });
});
