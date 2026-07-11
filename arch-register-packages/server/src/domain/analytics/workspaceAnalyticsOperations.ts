import type { WorkspaceAnalytics } from '@arch-register/api-types/analyticsContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiAuthCtx, filterVisibleEntities, requireWorkspaceCapability } from '../auth/authorization';
import { computeEntityCompleteness } from '../../utils/completeness';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { LifecycleStateDbResult } from '../workspace/db/workspaceDatabase';
import { listAllCatalogEntities } from '../catalog/entityLoader';

const roundPercent = (count: number, total: number) =>
  total === 0 ? 0 : Math.round((count / total) * 1000) / 10;

const makeLifecycleBucket = (
  lifecycleId: string | null,
  label: string,
  color: string | null,
  count: number,
  total: number
) => ({
  lifecycleId,
  label,
  color,
  count,
  percent: roundPercent(count, total)
});

const summarizeCompleteness = (entities: EntityDbResult[], schemaMap: Map<string, SchemaDbResult>) => {
  let above80Count = 0;
  let below50Count = 0;
  let between50And79Count = 0;

  for (const entity of entities) {
    const schema = schemaMap.get(entity.schema_id);
    if (schema == null) continue;
    const score = computeEntityCompleteness(entity, schema);
    if (score < 50) below50Count++;
    else if (score < 80) between50And79Count++;
    else above80Count++;
  }

  return { below50Count, between50And79Count, above80Count };
};

export const computeWorkspaceAnalytics = (
  entities: EntityDbResult[],
  schemas: SchemaDbResult[],
  lifecycleStates: LifecycleStateDbResult[],
  staleAfterDays = 90,
  now = new Date()
): WorkspaceAnalytics => {
  const schemaMap = new Map(schemas.map(schema => [schema.id, schema]));
  const totalEntities = entities.length;
  const lifecycleStatesSorted = [...lifecycleStates].sort((a, b) => a.sort_order - b.sort_order);

  // Single pass: group entities by schema and count by lifecycle
  const entitiesBySchema = new Map<string, EntityDbResult[]>();
  const lifecycleCounts = new Map<string | null, number>();
  let entitiesWithOwner = 0;

  for (const entity of entities) {
    const arr = entitiesBySchema.get(entity.schema_id);
    if (arr) arr.push(entity);
    else entitiesBySchema.set(entity.schema_id, [entity]);

    lifecycleCounts.set(entity.lifecycle, (lifecycleCounts.get(entity.lifecycle) ?? 0) + 1);

    if (entity.owner != null) entitiesWithOwner++;
  }

  const lifecycleBreakdown = [
    ...lifecycleStatesSorted.map(state =>
      makeLifecycleBucket(
        state.id,
        state.label,
        state.color,
        lifecycleCounts.get(state.id) ?? 0,
        totalEntities
      )
    ),
    makeLifecycleBucket(null, 'Unassigned', null, lifecycleCounts.get(null) ?? 0, totalEntities)
  ];

  const summaryCompleteness = summarizeCompleteness(entities, schemaMap);

  const coverage = schemas
    .map(schema => {
      const schemaEntities = entitiesBySchema.get(schema.id) ?? [];
      const schemaLifecycleCounts = new Map<string | null, number>();
      for (const e of schemaEntities) {
        schemaLifecycleCounts.set(e.lifecycle, (schemaLifecycleCounts.get(e.lifecycle) ?? 0) + 1);
      }
      return {
        schemaId: schema.id,
        schemaName: schema.name,
        totalCount: schemaEntities.length,
        lifecycleBuckets: [
          ...lifecycleStatesSorted.map(state =>
            makeLifecycleBucket(
              state.id,
              state.label,
              state.color,
              schemaLifecycleCounts.get(state.id) ?? 0,
              schemaEntities.length
            )
          ),
          makeLifecycleBucket(
            null,
            'Unassigned',
            null,
            schemaLifecycleCounts.get(null) ?? 0,
            schemaEntities.length
          )
        ].map(bucket => ({ ...bucket, schemaId: schema.id }))
      };
    })
    .sort((a, b) => b.totalCount - a.totalCount || a.schemaName.localeCompare(b.schemaName));

  const ownershipGaps = schemas
    .map(schema => {
      const schemaEntities = entitiesBySchema.get(schema.id) ?? [];
      let missingOwnerCount = 0;
      for (const e of schemaEntities) {
        if (e.owner == null) missingOwnerCount++;
      }
      return {
        schemaId: schema.id,
        schemaName: schema.name,
        totalCount: schemaEntities.length,
        missingOwnerCount,
        missingOwnerPercent: roundPercent(missingOwnerCount, schemaEntities.length)
      };
    })
    .sort(
      (a, b) =>
        b.missingOwnerCount - a.missingOwnerCount ||
        b.missingOwnerPercent - a.missingOwnerPercent ||
        a.schemaName.localeCompare(b.schemaName)
    );

  const completeness = schemas
    .map(schema => {
      const schemaEntities = entitiesBySchema.get(schema.id) ?? [];
      return {
        schemaId: schema.id,
        schemaName: schema.name,
        totalCount: schemaEntities.length,
        ...summarizeCompleteness(schemaEntities, schemaMap)
      };
    })
    .sort((a, b) => b.totalCount - a.totalCount || a.schemaName.localeCompare(b.schemaName));

  const schemaUtilization = schemas
    .map(schema => ({
      schemaId: schema.id,
      schemaName: schema.name,
      count: entitiesBySchema.get(schema.id)?.length ?? 0
    }))
    .sort((a, b) => b.count - a.count || a.schemaName.localeCompare(b.schemaName));

  const cutoffAt = new Date(now.getTime() - staleAfterDays * 24 * 60 * 60 * 1000);
  const staleEntityIds = new Set(
    entities.filter(entity => entity.updated_at < cutoffAt).map(entity => entity.id)
  );
  const stale = {
    thresholdDays: staleAfterDays,
    cutoffAt: cutoffAt.toISOString(),
    totalCount: staleEntityIds.size,
    percent: roundPercent(staleEntityIds.size, totalEntities),
    schemas: schemas
      .map(schema => {
        const schemaEntities = entitiesBySchema.get(schema.id) ?? [];
        const staleCount = schemaEntities.filter(entity => staleEntityIds.has(entity.id)).length;
        return {
          schemaId: schema.id,
          schemaName: schema.name,
          totalCount: schemaEntities.length,
          staleCount,
          stalePercent: roundPercent(staleCount, schemaEntities.length)
        };
      })
      .sort((a, b) => b.staleCount - a.staleCount || a.schemaName.localeCompare(b.schemaName))
  };

  return {
    summary: {
      totalEntities,
      percentWithOwner: roundPercent(entitiesWithOwner, totalEntities),
      percentCompleteness80Plus: roundPercent(summaryCompleteness.above80Count, totalEntities)
    },
    lifecycleBreakdown,
    coverage,
    ownershipGaps,
    completeness,
    schemaUtilization,
    stale
  };
};

export const getWorkspaceAnalytics = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  staleAfterDays = 90
): Promise<WorkspaceAnalytics> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.audit');

  const [entities, schemas, lifecycleStates] = await Promise.all([
    listAllCatalogEntities(db, ws),
    db.catalog.listSchemas(ws),
    db.workspace.listLifecycleStates(ws)
  ]);

  return computeWorkspaceAnalytics(
    filterVisibleEntities(authCtx, entities),
    schemas,
    lifecycleStates,
    staleAfterDays
  );
};
