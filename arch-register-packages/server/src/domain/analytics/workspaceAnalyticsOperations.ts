import type { WorkspaceAnalytics } from '@arch-register/api-types/analyticsContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiAuthCtx, filterVisibleEntities, requireWorkspaceCapability } from '../auth/authorization';
import { computeEntityCompleteness } from '../../utils/completeness';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { LifecycleStateDbResult } from '../workspace/db/workspaceDatabase';

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
  lifecycleStates: LifecycleStateDbResult[]
): WorkspaceAnalytics => {
  const schemaMap = new Map(schemas.map(schema => [schema.id, schema]));
  const totalEntities = entities.length;
  const entitiesWithOwner = entities.filter(entity => entity.owner != null).length;
  const lifecycleStatesSorted = [...lifecycleStates].sort((a, b) => a.sort_order - b.sort_order);

  const lifecycleBreakdown = [
    ...lifecycleStatesSorted.map(state =>
      makeLifecycleBucket(
        state.id,
        state.label,
        state.color,
        entities.filter(entity => entity.lifecycle === state.id).length,
        totalEntities
      )
    ),
    makeLifecycleBucket(
      null,
      'Unassigned',
      null,
      entities.filter(entity => entity.lifecycle == null).length,
      totalEntities
    )
  ];

  const summaryCompleteness = summarizeCompleteness(entities, schemaMap);

  const coverage = schemas
    .map(schema => {
      const schemaEntities = entities.filter(entity => entity.schema_id === schema.id);
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
              schemaEntities.filter(entity => entity.lifecycle === state.id).length,
              schemaEntities.length
            )
          ),
          makeLifecycleBucket(
            null,
            'Unassigned',
            null,
            schemaEntities.filter(entity => entity.lifecycle == null).length,
            schemaEntities.length
          )
        ].map(bucket => ({ ...bucket, schemaId: schema.id }))
      };
    })
    .sort((a, b) => b.totalCount - a.totalCount || a.schemaName.localeCompare(b.schemaName));

  const ownershipGaps = schemas
    .map(schema => {
      const schemaEntities = entities.filter(entity => entity.schema_id === schema.id);
      const missingOwnerCount = schemaEntities.filter(entity => entity.owner == null).length;
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
      const schemaEntities = entities.filter(entity => entity.schema_id === schema.id);
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
      count: entities.filter(entity => entity.schema_id === schema.id).length
    }))
    .sort((a, b) => b.count - a.count || a.schemaName.localeCompare(b.schemaName));

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
    schemaUtilization
  };
};

export const getWorkspaceAnalytics = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<WorkspaceAnalytics> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.audit');

  const [entities, schemas, lifecycleStates] = await Promise.all([
    db.catalog.listEntities(ws),
    db.catalog.listSchemas(ws),
    db.workspace.listLifecycleStates(ws)
  ]);

  return computeWorkspaceAnalytics(filterVisibleEntities(authCtx, entities), schemas, lifecycleStates);
};
