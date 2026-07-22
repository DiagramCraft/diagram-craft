import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, EntitySnapshotDbResult } from './db/catalogDatabase';
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
  snapshot: EntitySnapshotDbResult,
  milestoneTargetDates: Map<string, string>
): string =>
  snapshot.target_date ??
  (snapshot.milestone_id != null ? (milestoneTargetDates.get(snapshot.milestone_id) ?? '') : '');

const compareFutureUpdates = (
  a: EntitySnapshotDbResult,
  b: EntitySnapshotDbResult,
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
  created_at: entity.created_at,
  updated_at: entity.updated_at
});

// Reconstructs entity state as it existed (or, for future dates, will exist) as of `asOf`,
// using immutable `entity_version` history rather than the live `entity` table. Entities with no
// snapshot baseline at or before `asOf`, or whose latest baseline is a `deleted` snapshot,
// are excluded (they didn't exist yet / no longer existed at that point in time).
export const reconstructEntitiesAsOf = async (
  db: DatabaseAdapter,
  workspace: string,
  asOf: Date,
  authCtx: AuthorizationContext | null,
  candidateEntityIds?: string[],
  includeProjectSnapshots = true
): Promise<EntityDbResult[]> => {
  const [snapshots, schemas, owners, lifecycles] = await Promise.all([
    db.catalog.listSnapshotsAsOf(workspace, asOf, candidateEntityIds),
    db.catalog.listSchemas(workspace),
    db.workspace.listTeams(workspace),
    db.workspace.listLifecycleStates(workspace)
  ]);

  const schemaNameMap = new Map(schemas.map(s => [s.id, s.name]));
  const ownerNameMap = new Map(owners.map(o => [o.id, o.name]));
  const lifecycleLabelMap = new Map(lifecycles.map(l => [l.id, l.label]));

  // A `future_update` snapshot always carries the `project_id` it was planned under. Applying
  // it here must not leak the contents of a project the requesting user can't otherwise see
  // (e.g. via the project's own "future changes"/timeline tabs, which gate on project access) —
  // so we resolve project access for every distinct project_id referenced by a future_update
  // snapshot up front, and drop any snapshot from a project the user can't access. When the
  // caller has opted out of project snapshots entirely (e.g. the workspace browser's "include
  // project changes" toggle), skip this resolution altogether and treat future_update snapshots
  // as absent.
  const futureUpdateProjectIds = includeProjectSnapshots
    ? [
        ...new Set(
          snapshots
            .filter(s => s.status === 'future_update' && s.project_id != null)
            .map(s => s.project_id as string)
        )
      ]
    : [];
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

  // future_update snapshots targeting a milestone have a null target_date — their effective
  // date is the milestone's target_date, resolved here so sorting/merging can treat them
  // the same as raw-date snapshots.
  const milestoneIds = [
    ...new Set(
      snapshots
        .filter(s => s.status === 'future_update' && s.milestone_id != null)
        .map(s => s.milestone_id as string)
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

  // `listSnapshotsAsOf` returns rows ordered by (entity_id, created_at ASC), so the last
  // autosave/saved_version/deleted row seen per entity is its latest baseline at or before `asOf`.
  const baselineByEntity = new Map<string, EntitySnapshotDbResult>();
  const futureUpdatesByEntity = new Map<string, EntitySnapshotDbResult[]>();
  const futureUpdateGroups = new Map<string, EntitySnapshotDbResult[]>();

  for (const snapshot of snapshots) {
    if (snapshot.status === 'future_update') {
      if (!includeProjectSnapshots) continue;
      if (snapshot.project_id != null && !accessibleProjectIds.has(snapshot.project_id)) continue;
      const groupKey = snapshot.case_revision_id ?? snapshot.id;
      const group = futureUpdateGroups.get(groupKey) ?? [];
      group.push(snapshot);
      futureUpdateGroups.set(groupKey, group);
    } else {
      baselineByEntity.set(snapshot.entity_id, snapshot);
    }
  }

  // A case revision is one coordinated future event. Preserve that ordering for every member
  // instead of letting each entity independently order its member changes. The compatibility
  // projection gives legacy single-member rows their own group key.
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
    if (baseline.status === 'deleted') continue;

    // For an update-type autosave, base_state is the pre-edit state and proposed_state is the
    // resulting (post-edit) full state — merging proposed_state onto base_state yields the state
    // as of this snapshot's created_at. For a create-type autosave, proposed_state is null and
    // base_state alone is already the resulting state.
    let state = mergeState(baseline.base_state, baseline.proposed_state);

    const futureUpdates = (futureUpdatesByEntity.get(entityId) ?? []).sort((a, b) =>
      compareFutureUpdates(a, b, milestoneTargetDates)
    );
    for (const update of futureUpdates) {
      state = mergeState(state, update.proposed_state);
    }

    results.push(buildResult(entityId, state, baseline.created_at));
  }

  // Fallback for entities with zero snapshot history at all — ever, at any date — e.g. created
  // via CSV import or workspace bootstrap/seed, which write the entity row directly without
  // going through the audited create/update path that normally writes an autosave snapshot.
  // Without this, such entities would be invisible in snapshot-date mode in both directions,
  // even though they're visible in the live browser. We treat their current live state as an
  // implicit baseline dated at the entity's own created_at.
  //
  // This must NOT fire for entities that simply have no *qualifying* snapshot before `asOf`
  // (i.e. their snapshot history exists but starts after `asOf`) — those correctly stay
  // excluded, since we have no data for what they looked like at that date. `listSnapshotsAsOf`
  // already filtered by `created_at <= asOf`, so `baselineByEntity` alone can't distinguish
  // "no history at all" from "history, just not yet at this date" — a separate, unfiltered
  // lookup is required.
  const candidatesMissingBaseline = candidateEntityIds
    ? candidateEntityIds.filter(id => !baselineByEntity.has(id))
    : null;

  const fallbackLiveEntities: EntityDbResult[] = candidatesMissingBaseline
    ? (
        await Promise.all(candidatesMissingBaseline.map(id => db.catalog.getEntity(workspace, id)))
      ).filter((e): e is EntityDbResult => e != null)
    : (await listAllCatalogEntities(db, workspace)).filter(e => !baselineByEntity.has(e.id));

  const idsWithAnySnapshot = new Set(
    await db.catalog.listEntityIdsWithAnySnapshot(
      workspace,
      fallbackLiveEntities.map(e => e.id)
    )
  );

  for (const live of fallbackLiveEntities) {
    if (idsWithAnySnapshot.has(live.id)) continue;
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
