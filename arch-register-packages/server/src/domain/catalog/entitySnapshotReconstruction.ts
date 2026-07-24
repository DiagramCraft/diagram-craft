import type { DatabaseAdapter } from '../../db/database';
import type {
  EntityDbResult,
  EntityVersionDbResult,
  PlannedEntityChangeDbResult
} from './db/catalogDatabase';
import { EntityLink } from '@arch-register/api-types/entityContract';
import type { AuthorizationContext } from '@arch-register/permissions';
import { canAccessProject } from '../auth/authorization';
import { listAllCatalogEntities } from './entityLoader';

const mergeState = (
  base: Record<string, unknown>,
  overlay: Record<string, unknown> | null
): Record<string, unknown> => (overlay ? { ...base, ...overlay } : base);

const parseDate = (value: unknown, fallback: Date): Date => {
  if (typeof value === 'string' || value instanceof Date) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
};

const effectiveTargetDate = (
  change: PlannedEntityChangeDbResult,
  milestoneTargetDates: Map<string, string>
): string =>
  change.target_date ??
  (change.milestone_id != null ? (milestoneTargetDates.get(change.milestone_id) ?? '') : '');

const compareFutureUpdates = (
  a: PlannedEntityChangeDbResult,
  b: PlannedEntityChangeDbResult,
  milestoneTargetDates: Map<string, string>
): number => {
  const aDate = effectiveTargetDate(a, milestoneTargetDates);
  const bDate = effectiveTargetDate(b, milestoneTargetDates);
  if (aDate !== bDate) return aDate < bDate ? -1 : 1;
  return a.created_at.getTime() - b.created_at.getTime();
};

const entityToState = (entity: EntityDbResult): Record<string, unknown> => ({
  id: entity.id,
  workspace: entity.workspace,
  public_id: entity.public_id,
  slug: entity.slug,
  namespace: entity.namespace,
  name: entity.name,
  description: entity.description,
  owner: entity.owner,
  lifecycle: entity.lifecycle,
  target_lifecycle: entity.target_lifecycle,
  target_lifecycle_date: entity.target_lifecycle_date,
  tags: entity.tags,
  links: entity.links,
  schema_id: entity.schema_id,
  data: entity.data,
  project_id: entity.project_id,
  version: entity.version ?? 1,
  completeness: entity.completeness,
  created_at: entity.created_at,
  updated_at: entity.updated_at
});

// Reconstructs entity state as it existed (or, for future dates, will exist) as of `asOf`,
// using immutable `entity_version` history rather than the live `entity` table. Entities with no
// version baseline at or before `asOf`, or whose latest baseline is a `deleted` version,
// are excluded (they didn't exist yet / no longer existed at that point in time).
export const reconstructEntitiesAsOf = async (
  db: DatabaseAdapter,
  workspace: string,
  asOf: Date,
  authCtx: AuthorizationContext | null,
  candidateEntityIds?: string[],
  includePlannedChanges = true
): Promise<EntityDbResult[]> => {
  const [baselineVersions, plannedChanges, schemas, owners, lifecycles] = await Promise.all([
    db.catalog.listEntityVersionsAsOf(workspace, asOf, candidateEntityIds),
    includePlannedChanges
      ? db.catalog.listPlannedEntityChangesAsOf(workspace, asOf, candidateEntityIds)
      : Promise.resolve([]),
    db.catalog.listSchemas(workspace),
    db.workspace.listTeams(workspace),
    db.workspace.listLifecycleStates(workspace)
  ]);

  const schemaNameMap = new Map(schemas.map(s => [s.id, s.name]));
  const ownerNameMap = new Map(owners.map(o => [o.id, o.name]));
  const lifecycleLabelMap = new Map(lifecycles.map(l => [l.id, l.label]));

  // A planned change always carries the `project_id` it was planned under. Applying it here
  // must not leak the contents of a project the requesting user can't otherwise see (e.g. via
  // the project's own "future changes"/timeline tabs, which gate on project access) — so we
  // resolve project access for every distinct project_id referenced by a planned change up
  // front, and drop any change from a project the user can't access. When the caller has opted
  // out of planned changes entirely (e.g. the workspace browser's "include planned changes"
  // toggle), `plannedChanges` is already empty, so this resolves to nothing.
  const futureUpdateProjectIds = [
    ...new Set(plannedChanges.filter(c => c.project_id != null).map(c => c.project_id as string))
  ];
  const accessibleProjectIds = new Set(
    authCtx == null
      ? futureUpdateProjectIds
      : (
          await Promise.all(
            futureUpdateProjectIds.map(async projectId => {
              const project = await db.project.getProject(workspace, projectId);
              return project != null && canAccessProject(authCtx, project.owner) ? projectId : null;
            })
          )
        ).filter((id): id is string => id != null)
  );

  // Planned changes targeting a milestone have a null target_date — their effective date is the
  // milestone's target_date, resolved here so sorting/merging can treat them the same as
  // raw-date changes.
  const milestoneIds = [
    ...new Set(
      plannedChanges.filter(c => c.milestone_id != null).map(c => c.milestone_id as string)
    )
  ];
  const milestoneTargetDates = new Map(
    (
      await Promise.all(
        futureUpdateProjectIds.map(projectId => db.project.listMilestones(workspace, projectId))
      )
    )
      .flat()
      .filter(m => milestoneIds.includes(m.id))
      .map(m => [m.id, m.target_date] as const)
  );

  // `listEntityVersionsAsOf` returns rows ordered by (entity_id, created_at ASC), so the last
  // row seen per entity is its latest version baseline at or before `asOf`.
  const baselineByEntity = new Map<string, EntityVersionDbResult>();
  for (const version of baselineVersions) {
    baselineByEntity.set(version.entity_id, version);
  }

  const futureUpdatesByEntity = new Map<string, PlannedEntityChangeDbResult[]>();
  const futureUpdateGroups = new Map<string, PlannedEntityChangeDbResult[]>();

  for (const change of plannedChanges) {
    if (change.project_id != null && !accessibleProjectIds.has(change.project_id)) continue;
    const group = futureUpdateGroups.get(change.case_revision_id) ?? [];
    group.push(change);
    futureUpdateGroups.set(change.case_revision_id, group);
  }

  // A case revision is one coordinated future event. Preserve that ordering for every member
  // instead of letting each entity independently order its member changes.
  const orderedFutureGroups = [...futureUpdateGroups.values()].sort((a, b) =>
    compareFutureUpdates(a[0]!, b[0]!, milestoneTargetDates)
  );
  for (const group of orderedFutureGroups) {
    for (const update of group) {
      const list = futureUpdatesByEntity.get(update.entity_id) ?? [];
      list.push(update);
      futureUpdatesByEntity.set(update.entity_id, list);
    }
  }

  const buildResult = (
    entityId: string,
    state: Record<string, unknown>,
    fallbackCreatedAt: Date
  ): EntityDbResult => {
    const createdAt = parseDate(state['created_at'], fallbackCreatedAt);
    const updatedAt = parseDate(state['updated_at'], createdAt);
    const ownerId = (state['owner'] as string | null) ?? null;
    const lifecycleId = (state['lifecycle'] as string | null) ?? null;
    const targetLifecycleId = (state['target_lifecycle'] as string | null) ?? null;
    const schemaId = state['schema_id'] as string;

    return {
      id: entityId,
      workspace,
      public_id: (state['public_id'] as string | undefined) ?? entityId,
      slug: state['slug'] as string,
      namespace: (state['namespace'] as string | undefined) ?? 'default',
      name: state['name'] as string,
      description: (state['description'] as string | undefined) ?? '',
      owner: ownerId,
      lifecycle: lifecycleId,
      target_lifecycle: targetLifecycleId,
      target_lifecycle_date: (state['target_lifecycle_date'] as string | null) ?? null,
      tags: (state['tags'] as string[] | undefined) ?? [],
      links: (state['links'] as EntityLink[] | undefined) ?? [],
      schema_id: schemaId,
      data: (state['data'] as Record<string, unknown> | undefined) ?? {},
      project_id: (state['project_id'] as string | null) ?? null,
      created_at: createdAt,
      updated_at: updatedAt,
      version: Number(state['version'] ?? 1),
      // Frozen at write time (see entityMutations.ts) — snapshots predating #2346 have no
      // completeness in their state JSON, so default rather than surface undefined.
      completeness: Number(state['completeness'] ?? 0),
      owner_name: ownerId ? (ownerNameMap.get(ownerId) ?? ownerId) : null,
      lifecycle_label: lifecycleId ? (lifecycleLabelMap.get(lifecycleId) ?? lifecycleId) : null,
      target_lifecycle_label: targetLifecycleId
        ? (lifecycleLabelMap.get(targetLifecycleId) ?? targetLifecycleId)
        : null,
      schema_name: schemaNameMap.get(schemaId) ?? schemaId
    };
  };

  const results: EntityDbResult[] = [];

  for (const [entityId, baseline] of baselineByEntity) {
    if (baseline.kind === 'deleted') continue;

    let state = baseline.state;

    const futureUpdates = (futureUpdatesByEntity.get(entityId) ?? []).sort((a, b) =>
      compareFutureUpdates(a, b, milestoneTargetDates)
    );
    for (const update of futureUpdates) {
      state = mergeState(state, update.proposed_state);
    }

    results.push(buildResult(entityId, state, baseline.created_at));
  }

  // Fallback for entities with zero version history at all — ever, at any date — e.g. created
  // via CSV import or workspace bootstrap/seed, which write the entity row directly without
  // going through the audited create/update path that normally writes an entity_version row.
  // Without this, such entities would be invisible in asOf mode in both directions, even though
  // they're visible in the live browser. We treat their current live state as an implicit
  // baseline dated at the entity's own created_at.
  //
  // This must NOT fire for entities that simply have no *qualifying* version before `asOf`
  // (i.e. their version history exists but starts after `asOf`) — those correctly stay
  // excluded, since we have no data for what they looked like at that date.
  // `listEntityVersionsAsOf` already filtered by `created_at <= asOf`, so `baselineByEntity`
  // alone can't distinguish "no history at all" from "history, just not yet at this date" — a
  // separate, unfiltered lookup is required.
  const candidatesMissingBaseline = candidateEntityIds
    ? candidateEntityIds.filter(id => !baselineByEntity.has(id))
    : null;

  const fallbackLiveEntities: EntityDbResult[] = candidatesMissingBaseline
    ? (
        await Promise.all(candidatesMissingBaseline.map(id => db.catalog.getEntity(workspace, id)))
      ).filter((e): e is EntityDbResult => e != null)
    : (await listAllCatalogEntities(db, workspace)).filter(e => !baselineByEntity.has(e.id));

  const idsWithVersionHistory = new Set(
    await db.catalog.listEntityIdsWithVersionHistory(
      workspace,
      fallbackLiveEntities.map(e => e.id)
    )
  );

  for (const live of fallbackLiveEntities) {
    if (idsWithVersionHistory.has(live.id)) continue;
    if (live.created_at > asOf) continue;

    let state = entityToState(live);
    const futureUpdates = (futureUpdatesByEntity.get(live.id) ?? []).sort((a, b) =>
      compareFutureUpdates(a, b, milestoneTargetDates)
    );
    for (const update of futureUpdates) {
      state = mergeState(state, update.proposed_state);
    }

    results.push(buildResult(live.id, state, live.created_at));
  }

  return results;
};
