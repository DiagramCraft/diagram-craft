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

export const mergeState = (
  base: Record<string, unknown>,
  overlay: Record<string, unknown> | null
): Record<string, unknown> => (overlay ? { ...base, ...overlay } : base);

export const parseDate = (value: unknown, fallback: Date): Date => {
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
  const createdAtDifference = a.created_at.getTime() - b.created_at.getTime();
  if (createdAtDifference !== 0) return createdAtDifference;
  if (a.revision_number !== b.revision_number)
    return a.revision_number < b.revision_number ? -1 : 1;
  if (a.case_revision_id !== b.case_revision_id)
    return a.case_revision_id < b.case_revision_id ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
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
/**
 * Resolves which planned change(s) apply to each record as of a reconstruction, shared by both
 * `reconstructEntitiesAsOf` and `reconstructRelationsAsOf` (relationSnapshotReconstruction.ts) —
 * the project-access filtering, milestone target-date resolution, overdue exclusion, and
 * case-revision-grouped ordering are all record-kind-agnostic, since they operate purely on
 * `entity_change_case`/`record_change_case_record_version` rows (keyed generically on `record_id`,
 * aliased `entity_id` in `PlannedEntityChangeDbResult` for historical/entity-path reasons).
 */
export const resolveFutureUpdatesByRecord = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext | null,
  asOf: Date,
  plannedChanges: PlannedEntityChangeDbResult[],
  plannedChangesProjectId: string | null | undefined,
  excludeOverdueChangesBefore?: Date
): Promise<Map<string, PlannedEntityChangeDbResult[]>> => {
  // Landscape comparisons can scope planned changes to one project while retaining the same
  // reconstruction and authorization rules used by the workspace browser.
  const applicablePlannedChanges =
    plannedChangesProjectId == null
      ? plannedChanges
      : plannedChanges.filter(change => change.project_id === plannedChangesProjectId);

  // A planned change always carries the `project_id` it was planned under. Applying it here
  // must not leak the contents of a project the requesting user can't otherwise see (e.g. via
  // the project's own "future changes"/timeline tabs, which gate on project access) — so we
  // resolve project access for every distinct project_id referenced by a planned change up
  // front, and drop any change from a project the user can't access. When the caller has opted
  // out of planned changes entirely (e.g. the workspace browser's "include planned changes"
  // toggle), `plannedChanges` is already empty, so this resolves to nothing.
  const futureUpdateProjectIds = [
    ...new Set(
      applicablePlannedChanges.filter(c => c.project_id != null).map(c => c.project_id as string)
    )
  ];
  const futureUpdateProjectIdSet = new Set(futureUpdateProjectIds);
  const accessibleProjectIds = new Set(
    authCtx == null
      ? futureUpdateProjectIds
      : futureUpdateProjectIds.length === 0
        ? []
        : (await db.project.listProjects(workspace))
            .filter(
              project =>
                futureUpdateProjectIdSet.has(project.id) && canAccessProject(authCtx, project.owner)
            )
            .map(project => project.id)
  );

  // Planned changes targeting a milestone have a null target_date — their effective date is the
  // milestone's target_date, resolved here so sorting/merging can treat them the same as
  // raw-date changes.
  const milestoneIds = [
    ...new Set(
      applicablePlannedChanges
        .filter(c => c.milestone_id != null)
        .map(c => c.milestone_id as string)
    )
  ];
  const milestoneIdSet = new Set(milestoneIds);
  const milestoneTargetDates = new Map(
    milestoneIds.length === 0
      ? []
      : (await db.project.listMilestones(workspace))
          .filter(m => milestoneIdSet.has(m.id))
          .map(m => [m.id, m.target_date] as const)
  );

  const asOfDate = asOf.toISOString().slice(0, 10);
  const asOfFilteredChanges = applicablePlannedChanges.filter(change => {
    const effectiveDate = effectiveTargetDate(change, milestoneTargetDates);
    return !effectiveDate || effectiveDate <= asOfDate;
  });

  // Landscape diffing can exclude "overdue" changes — planned changes whose target date has
  // already passed (relative to `excludeOverdueChangesBefore`, typically "now") but were never
  // applied. Without this, a change scheduled for last month keeps showing up as a "future"
  // change in every reconstruction from today onward. Changes with no resolvable date (no
  // target_date and no milestone) aren't excluded — there's nothing to judge as overdue.
  const overdueFilteredChanges =
    excludeOverdueChangesBefore == null
      ? asOfFilteredChanges
      : asOfFilteredChanges.filter(change => {
          const effectiveDate = effectiveTargetDate(change, milestoneTargetDates);
          if (!effectiveDate) return true;
          return effectiveDate >= excludeOverdueChangesBefore.toISOString().slice(0, 10);
        });

  const futureUpdatesByEntity = new Map<string, PlannedEntityChangeDbResult[]>();
  const futureUpdateGroups = new Map<string, PlannedEntityChangeDbResult[]>();

  for (const change of overdueFilteredChanges) {
    if (change.project_id != null && !accessibleProjectIds.has(change.project_id)) continue;
    const group = futureUpdateGroups.get(change.case_revision_id) ?? [];
    group.push(change);
    futureUpdateGroups.set(change.case_revision_id, group);
  }

  // A case revision is one coordinated future event. Preserve that ordering for every member
  // instead of letting each record independently order its member changes.
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

  return futureUpdatesByEntity;
};

export const reconstructEntitiesAsOf = async (
  db: DatabaseAdapter,
  workspace: string,
  asOf: Date,
  authCtx: AuthorizationContext | null,
  candidateEntityIds?: string[],
  includePlannedChanges = true,
  plannedChangesProjectId?: string | null,
  excludeOverdueChangesBefore?: Date
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

  // `listEntityVersionsAsOf` returns rows ordered by (record_id, created_at ASC, version_number
  // ASC), so the last row seen per entity is its latest version baseline at or before `asOf`.
  const baselineByEntity = new Map<string, EntityVersionDbResult>();
  for (const version of baselineVersions) {
    baselineByEntity.set(version.record_id, version);
  }

  const futureUpdatesByEntity = await resolveFutureUpdatesByRecord(
    db,
    workspace,
    authCtx,
    asOf,
    plannedChanges,
    plannedChangesProjectId,
    excludeOverdueChangesBefore
  );

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

  const applyFutureUpdates = (entityId: string, initialState: Record<string, unknown>) => {
    let state = initialState;
    for (const update of futureUpdatesByEntity.get(entityId) ?? []) {
      state = mergeState(state, update.proposed_state);
    }
    return state;
  };

  for (const [entityId, baseline] of baselineByEntity) {
    if (baseline.kind === 'deleted') continue;

    // Already in date order — resolveFutureUpdatesByRecord builds this list by walking
    // date-sorted case-revision groups, so re-sorting here would just re-derive the same order.
    results.push(
      buildResult(entityId, applyFutureUpdates(entityId, baseline.state), baseline.created_at)
    );
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

    results.push(
      buildResult(live.id, applyFutureUpdates(live.id, entityToState(live)), live.created_at)
    );
  }

  return results;
};
