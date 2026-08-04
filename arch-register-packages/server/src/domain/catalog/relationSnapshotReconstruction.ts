import type { DatabaseAdapter } from '../../db/database';
import type { EntityVersionDbResult } from './db/catalogDatabase';
import type { RelationDbResult } from './db/relationDatabase';
import type { AuthorizationContext } from '@arch-register/permissions';
import {
  mergeState,
  parseDate,
  resolveFutureUpdatesByRecord
} from './entitySnapshotReconstruction';

// Reconstructs relation instance state as it existed (or, for future dates, will exist) as of
// `asOf`, mirroring `reconstructEntitiesAsOf` (entitySnapshotReconstruction.ts) but simpler in two
// ways specific to relations:
//
// - No owner/lifecycle/slug/namespace/tags/links to resolve — a relation's only identity beyond
//   its endpoints is its schema and field `data`.
// - No "fallback to live state" branch. Every relation creation path (relationOperations.ts's
//   createWorkspaceRelation) writes a `record_version` baseline unconditionally, unlike entities
//   (which can predate versioning via CSV import/seed) — so unlike entities, a relation with no
//   version history simply doesn't exist yet at any `asOf`, full stop.
export const reconstructRelationsAsOf = async (
  db: DatabaseAdapter,
  workspace: string,
  asOf: Date,
  authCtx: AuthorizationContext | null,
  candidateRelationIds?: string[],
  includePlannedChanges = true,
  plannedChangesProjectId?: string | null,
  excludeOverdueChangesBefore?: Date
): Promise<RelationDbResult[]> => {
  const [baselineVersions, plannedChanges, relationSchemas] = await Promise.all([
    db.catalog.listRelationVersionsAsOf(workspace, asOf, candidateRelationIds),
    includePlannedChanges
      ? db.catalog.listPlannedRelationChangesAsOf(workspace, asOf, candidateRelationIds)
      : Promise.resolve([]),
    db.relation.listRelationSchemas(workspace)
  ]);

  const schemaNameMap = new Map(relationSchemas.map(s => [s.id, s.name]));

  // `listRelationVersionsAsOf` returns rows ordered by (record_id, created_at ASC), so the last
  // row seen per relation is its latest version baseline at or before `asOf`.
  const baselineByRelation = new Map<string, EntityVersionDbResult>();
  for (const version of baselineVersions) {
    baselineByRelation.set(version.entity_id, version);
  }

  const futureUpdatesByRelation = await resolveFutureUpdatesByRecord(
    db,
    workspace,
    authCtx,
    plannedChanges,
    plannedChangesProjectId,
    excludeOverdueChangesBefore
  );

  const resolvedStateByRelation = new Map<
    string,
    { state: Record<string, unknown>; createdAt: Date }
  >();
  for (const [relationId, baseline] of baselineByRelation) {
    if (baseline.kind === 'deleted') continue;
    let state = baseline.state;
    for (const update of futureUpdatesByRelation.get(relationId) ?? []) {
      state = mergeState(state, update.proposed_state);
    }
    resolvedStateByRelation.set(relationId, { state, createdAt: baseline.created_at });
  }

  // Endpoint entity names are resolved from *current* live state, not point-in-time — consistent
  // with every other endpoint-facing surface in this codebase (getRelationOwnerSchemas,
  // canViewTypedRelation's ACL checks), none of which attempt historical entity reconstruction
  // just to label an edge. A renamed/deleted endpoint shows its current name (or falls back to
  // the id) rather than the name it had `asOf`.
  const entityIds = new Set<string>();
  for (const { state } of resolvedStateByRelation.values()) {
    const inId = state['in_entity_id'];
    const outId = state['out_entity_id'];
    if (typeof inId === 'string') entityIds.add(inId);
    if (typeof outId === 'string') entityIds.add(outId);
  }
  const entityNameById = new Map(
    (await Promise.all([...entityIds].map(id => db.catalog.getEntity(workspace, id))))
      .filter((entity): entity is NonNullable<typeof entity> => entity != null)
      .map(entity => [entity.id, entity.name] as const)
  );

  const buildResult = (
    relationId: string,
    state: Record<string, unknown>,
    fallbackCreatedAt: Date
  ): RelationDbResult => {
    const createdAt = parseDate(state['created_at'], fallbackCreatedAt);
    const updatedAt = parseDate(state['updated_at'], createdAt);
    const schemaId = state['schema_id'] as string;
    const inEntityId = state['in_entity_id'] as string;
    const outEntityId = state['out_entity_id'] as string;

    return {
      id: relationId,
      workspace,
      schema_id: schemaId,
      schema_name: schemaNameMap.get(schemaId) ?? schemaId,
      in_entity_id: inEntityId,
      in_entity_name: entityNameById.get(inEntityId) ?? inEntityId,
      out_entity_id: outEntityId,
      out_entity_name: entityNameById.get(outEntityId) ?? outEntityId,
      data: (state['data'] as Record<string, unknown> | undefined) ?? {},
      version: Number(state['version'] ?? 1),
      approval_policy_override:
        (state['approval_policy_override'] as 'required' | 'disabled' | null) ?? null,
      created_at: createdAt,
      updated_at: updatedAt
    };
  };

  const results: RelationDbResult[] = [];
  for (const [relationId, { state, createdAt }] of resolvedStateByRelation) {
    results.push(buildResult(relationId, state, createdAt));
  }

  return results;
};
