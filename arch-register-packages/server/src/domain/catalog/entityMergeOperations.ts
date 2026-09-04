import type { AuthorizationContext } from '@arch-register/permissions';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import type { Entity, EntityDbResult, EntityDbUpdate, SchemaDbResult } from './db/catalogDatabase';
import type { RelationDbResult } from './db/relationDatabase';
import { requireEntityAction, requireWorkspaceCapability } from '../auth/authorization';
import { runAuthorizedOperation } from '../operation';
import { httpAssert } from '../../utils/httpAssert';
import {
  buildBatchEntityDependents,
  normalizeEntityRelationFields,
  relationFields
} from './dataHelpers';
import { listAllCatalogEntities } from './entityLoader';
import { buildDiff, equalEntityValue, redactDataDiff } from './entityDiff';
import { isFieldEditRestricted, isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import { decodeRefs } from '../../types';
import { isReferenceOrContainmentField } from '@arch-register/api-types/schemaContract';
import type {
  MergeBlocker,
  MergeDependentImpact,
  MergeExecuteBody,
  MergeExecuteResponse,
  MergeFieldConflict,
  MergePreview,
  MergeRelationConflict
} from '@arch-register/api-types/entityMergeContract';
import { computeEntityCompleteness } from '../../utils/completeness';
import { toApiEntity } from './entityHelpers';
import { updateEntityWithAudit } from './entityMutations';
import { withCatalogMutationTransaction } from './mutationTransaction';
import { mergeFingerprint, type EntityMergeSideTableSnapshot } from './db/entityMergeDatabase';

const dedupeRelations = (rows: RelationDbResult[]): RelationDbResult[] => {
  const byId = new Map<string, RelationDbResult>();
  for (const row of rows) byId.set(row.id, row);
  return [...byId.values()];
};

const fieldNameById = (schema: SchemaDbResult | undefined): Map<string, string> =>
  new Map((schema?.fields ?? []).map(field => [field.id, field.name]));

const restrictedFieldKey = (fieldId: string): string =>
  `data:${mergeFingerprint({ restrictedField: fieldId })}`;

export const buildFieldConflicts = (
  source: Entity,
  target: Entity,
  sourceSchema: SchemaDbResult | undefined,
  targetSchema: SchemaDbResult | undefined,
  authCtx: Parameters<typeof isFieldViewRestricted>[0]
): MergeFieldConflict[] => {
  // before === target (canonical survivor), after === source (merged away).
  const rawDiff = buildDiff(
    target as unknown as Record<string, unknown>,
    source as unknown as Record<string, unknown>
  );
  const diff = redactDataDiff(rawDiff, authCtx, targetSchema ?? null, sourceSchema ?? null);
  const names = fieldNameById(sourceSchema);
  const conflicts: MergeFieldConflict[] = [];

  for (const [key, entry] of Object.entries(diff)) {
    if (key === 'data') {
      const before = (entry.before ?? {}) as Record<string, unknown>;
      const after = (entry.after ?? {}) as Record<string, unknown>;
      for (const fieldId of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (equalEntityValue(before[fieldId], after[fieldId])) continue;
        conflicts.push({
          fieldKey: `data:${fieldId}`,
          fieldName: names.get(fieldId) ?? fieldId,
          kind: 'data',
          source: after[fieldId] ?? null,
          target: before[fieldId] ?? null,
          restricted: false
        });
      }
      continue;
    }
    conflicts.push({
      fieldKey: `core:${key}`,
      fieldName: key,
      kind: 'core',
      source: entry.after ?? null,
      target: entry.before ?? null,
      restricted: false
    });
  }

  // Field-group-restricted data fields are stripped by redactDataDiff; surface them as flagged
  // (values withheld) when they actually differ so the wizard can show the conflict count.
  for (const field of sourceSchema?.fields ?? []) {
    if (!isFieldViewRestricted(authCtx, sourceSchema, field.id)) continue;
    if (equalEntityValue(source.data[field.id], target.data[field.id])) continue;
    conflicts.push({
      fieldKey: restrictedFieldKey(field.id),
      fieldName: field.name,
      kind: 'data',
      source: null,
      target: null,
      restricted: true
    });
  }

  return conflicts;
};

// Source relations that, once their source endpoint is re-pointed to the target, would either
// collapse to a self-relation or duplicate an existing target relation (same schema + endpoints).
export const buildRelationConflicts = (
  sourceId: string,
  targetId: string,
  relations: RelationDbResult[],
  relationSchemas: { id: string; name: string }[]
): MergeRelationConflict[] => {
  const relationSchemaNames = new Map(relationSchemas.map(schema => [schema.id, schema.name]));
  const key = (schemaId: string, inId: string, outId: string) => `${schemaId}|${inId}|${outId}`;
  const targetRelationsByKey = new Map(
    relations
      .filter(row => row.in_entity_id === targetId || row.out_entity_id === targetId)
      .map(row => [key(row.schema_id, row.in_entity_id, row.out_entity_id), row])
  );

  const conflicts: MergeRelationConflict[] = [];
  for (const row of relations) {
    if (row.in_entity_id !== sourceId && row.out_entity_id !== sourceId) continue;
    const repointedIn = row.in_entity_id === sourceId ? targetId : row.in_entity_id;
    const repointedOut = row.out_entity_id === sourceId ? targetId : row.out_entity_id;
    const direction: 'in' | 'out' = row.in_entity_id === sourceId ? 'in' : 'out';
    const base = {
      relationId: row.id,
      relationSchemaId: row.schema_id,
      relationSchemaName: relationSchemaNames.get(row.schema_id) ?? row.schema_name,
      direction,
      otherRecordId: direction === 'in' ? row.out_entity_id : row.in_entity_id,
      otherRecordName: direction === 'in' ? row.out_entity_name : row.in_entity_name
    };
    if (repointedIn === repointedOut) {
      conflicts.push({ ...base, duplicateRelationId: null, note: 'self' });
      continue;
    }
    const duplicate = targetRelationsByKey.get(key(row.schema_id, repointedIn, repointedOut));
    if (duplicate && duplicate.id !== row.id) {
      conflicts.push({ ...base, duplicateRelationId: duplicate.id, note: 'duplicate' });
    }
  }
  return conflicts;
};

type ReferenceEdge = {
  dependentId: string;
  fieldId: string;
  kind: 'reference' | 'containment';
  version: number;
};

type MergePlan = {
  source: EntityDbResult;
  target: EntityDbResult;
  schemas: SchemaDbResult[];
  entities: EntityDbResult[];
  sourceSchema: SchemaDbResult | undefined;
  targetSchema: SchemaDbResult | undefined;
  pairRelations: RelationDbResult[];
  sourceRelations: RelationDbResult[];
  fieldConflicts: MergeFieldConflict[];
  dependentImpact: MergeDependentImpact[];
  rawDependentIds: string[];
  referenceEdges: ReferenceEdge[];
  relationConflicts: MergeRelationConflict[];
  sideTableSnapshot: EntityMergeSideTableSnapshot;
  blockers: MergeBlocker[];
  truncated: boolean;
  previewFingerprint: string;
  sideTableCounts: MergePreview['sideTableCounts'];
};

const collectReferenceEdges = (
  sourceId: string,
  entities: Entity[],
  schemas: SchemaDbResult[]
): ReferenceEdge[] => {
  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
  const edges: ReferenceEdge[] = [];
  for (const entity of entities) {
    if (entity.id === sourceId) continue;
    const schema = schemaById.get(entity.schema_id);
    for (const field of schema?.fields ?? []) {
      if (!isReferenceOrContainmentField(field)) continue;
      if (!decodeRefs(entity.data[field.id]).includes(sourceId)) continue;
      edges.push({
        dependentId: entity.id,
        fieldId: field.id,
        kind: field.type,
        version: entity.version ?? 1
      });
    }
  }
  return edges.sort((left, right) =>
    `${left.dependentId}:${left.fieldId}`.localeCompare(`${right.dependentId}:${right.fieldId}`)
  );
};

const buildMergeFingerprint = (
  source: Entity,
  target: Entity,
  referenceEdges: ReferenceEdge[],
  pairRelations: RelationDbResult[],
  sideTableSnapshot: EntityMergeSideTableSnapshot
) =>
  mergeFingerprint({
    sourceId: source.id,
    targetId: target.id,
    sourceVersion: source.version ?? 1,
    targetVersion: target.version ?? 1,
    referenceEdges,
    relations: pairRelations
      .map(row => ({
        id: row.id,
        schemaId: row.schema_id,
        inEntityId: row.in_entity_id,
        outEntityId: row.out_entity_id,
        version: row.version
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    sideTableRows: sideTableSnapshot.rows
      .map(row => ({
        table: row.table,
        rowId: row.rowId,
        entityId: row.entityId,
        uniqueKey: row.uniqueKey,
        dedupeKey: row.dedupeKey
      }))
      .sort((left, right) =>
        `${left.table}:${left.rowId}`.localeCompare(`${right.table}:${right.rowId}`)
      ),
    externalIdentities: sideTableSnapshot.externalIdentityRows
      .map(row => ({ source: row.source, externalKey: row.externalKey, recordId: row.recordId }))
      .sort((left, right) =>
        `${left.source}:${left.externalKey}:${left.recordId}`.localeCompare(
          `${right.source}:${right.externalKey}:${right.recordId}`
        )
      )
  });

const loadMergePlan = async (
  db: DatabaseAdapter,
  workspace: string,
  sourceIdentifier: string,
  targetIdentifier: string,
  authCtx: AuthorizationContext
): Promise<MergePlan> => {
  const [sourceEntity, targetEntity] = await Promise.all([
    db.catalog.getEntity(workspace, sourceIdentifier),
    db.catalog.getEntity(workspace, targetIdentifier)
  ]);
  httpAssert.present(sourceEntity, { status: 404, message: 'Source entity not found' });
  httpAssert.present(targetEntity, { status: 404, message: 'Target entity not found' });

  requireEntityAction(authCtx, sourceEntity, 'admin_entity');
  requireEntityAction(authCtx, targetEntity, 'admin_entity');
  requireWorkspaceCapability(
    authCtx,
    'ent.merge',
    'You do not have permission to merge entities in this workspace'
  );

  const blockers: MergeBlocker[] = [];
  if (sourceEntity.redirect) {
    blockers.push({
      code: 'source_is_alias',
      message: 'The source entity has already been merged into another record.'
    });
  }
  if (targetEntity.redirect) {
    blockers.push({
      code: 'target_is_alias',
      message: 'The target entity has already been merged into another record.'
    });
  }
  if (sourceEntity.id === targetEntity.id) {
    blockers.push({
      code: 'same_entity',
      message: 'Source and target resolve to the same entity.'
    });
  }
  if (sourceEntity.schema_id !== targetEntity.schema_id) {
    blockers.push({
      code: 'different_schema',
      message: 'Entities must share the same schema to be merged.'
    });
  }
  if ((sourceEntity.project_id ?? null) !== (targetEntity.project_id ?? null)) {
    blockers.push({
      code: 'project_scope_mismatch',
      message: 'Source and target belong to different projects.'
    });
  }

  const [
    schemas,
    entities,
    relationSchemas,
    relationsForPair,
    openApproval,
    openCases,
    sideTableSnapshot
  ] = await Promise.all([
    db.catalog.listSchemas(workspace),
    listAllCatalogEntities(db, workspace),
    db.relation.listRelationSchemas(workspace),
    db.relation.listRelationsForEntities(workspace, [sourceEntity.id, targetEntity.id]),
    db.entityChange.getOpenApproval(workspace, sourceEntity.id),
    db.governance.listCases(workspace, { subjectId: sourceEntity.id, status: 'open' }),
    db.entityMerge.getSideTableSnapshot(workspace, sourceEntity.id, targetEntity.id)
  ]);

  if (openCases.length > 0) {
    blockers.push({
      code: 'open_governance_case',
      message: 'The source entity has an open governance case and cannot be merged.'
    });
  }
  if (sideTableSnapshot.externalIdentityRows.some(row => row.recordId === sourceEntity.id)) {
    blockers.push({
      code: 'external_identity',
      message:
        'The source entity has an external identity; external identity transfer is not enabled yet.'
    });
  }

  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
  const sourceSchema = schemaById.get(sourceEntity.schema_id);
  const targetSchema = schemaById.get(targetEntity.schema_id);
  for (const field of sourceSchema?.fields ?? []) {
    if (!isFieldEditRestricted(authCtx, sourceSchema, field.id)) continue;
    if (equalEntityValue(sourceEntity.data[field.id], targetEntity.data[field.id])) continue;
    blockers.push({
      code: 'restricted_field_write',
      message: `Merging would write the restricted field "${field.name}", which you cannot edit.`
    });
    break;
  }

  const fieldConflicts = buildFieldConflicts(
    sourceEntity,
    targetEntity,
    sourceSchema,
    targetSchema,
    authCtx
  );

  const pairRelations = dedupeRelations([
    ...relationsForPair.outgoing,
    ...relationsForPair.incoming
  ]);
  const entityLookup = new Map<string, Entity>(entities.map(entity => [entity.id, entity]));
  const visibleBatch = buildBatchEntityDependents(
    [sourceEntity.id],
    entities,
    schemas,
    { transitive: false },
    authCtx,
    pairRelations,
    relationSchemas
  );
  const visibleDependents = visibleBatch.get(sourceEntity.id) ?? {
    dependents: [],
    truncated: false
  };
  const dependentImpact: MergeDependentImpact[] = visibleDependents.dependents.map(dependent => ({
    entityId: dependent.entityId,
    entityName: dependent.entityName,
    entitySlug: dependent.entitySlug,
    entitySchemaId: dependent.entitySchemaId,
    schemaName: dependent.schemaName,
    ownerTeamId: entityLookup.get(dependent.entityId)?.owner ?? null,
    fieldName: dependent.fieldName,
    kind: dependent.kind
  }));

  // Merge execution must see restricted fields as well. The API impact remains redacted by the
  // caller's authorization context, but the write plan is always built from the full graph.
  const allDependents = buildBatchEntityDependents(
    [sourceEntity.id],
    entities,
    schemas,
    { transitive: false },
    null,
    pairRelations,
    relationSchemas
  ).get(sourceEntity.id) ?? { dependents: [], truncated: false };
  const referenceEdges = collectReferenceEdges(sourceEntity.id, entities, schemas);
  const rawDependentIds = [...new Set(referenceEdges.map(edge => edge.dependentId))].sort();
  const truncated = visibleDependents.truncated || allDependents.truncated;
  if (truncated) {
    blockers.push({
      code: 'truncated_dependents',
      message: 'The dependent graph is too large to merge safely in one operation.'
    });
  }

  const sourceRelations = pairRelations.filter(
    row => row.in_entity_id === sourceEntity.id || row.out_entity_id === sourceEntity.id
  );
  const relationConflicts = buildRelationConflicts(
    sourceEntity.id,
    targetEntity.id,
    pairRelations,
    relationSchemas
  );
  const entityVersions = await db.catalog.listEntityVersions(workspace, sourceEntity.id);
  const previewFingerprint = buildMergeFingerprint(
    sourceEntity,
    targetEntity,
    referenceEdges,
    pairRelations,
    sideTableSnapshot
  );

  return {
    source: sourceEntity,
    target: targetEntity,
    schemas,
    entities,
    sourceSchema,
    targetSchema,
    pairRelations,
    sourceRelations,
    fieldConflicts,
    dependentImpact,
    rawDependentIds,
    referenceEdges,
    relationConflicts,
    sideTableSnapshot,
    blockers,
    truncated,
    previewFingerprint,
    sideTableCounts: {
      entityVersions: entityVersions.length,
      openChangeApprovals: openApproval ? 1 : 0,
      openGovernanceCases: openCases.length,
      incomingRelations: sourceRelations.filter(row => row.out_entity_id === sourceEntity.id)
        .length,
      outgoingRelations: sourceRelations.filter(row => row.in_entity_id === sourceEntity.id).length
    }
  };
};

const firstBlockerMessage = (blockers: MergeBlocker[]) =>
  blockers.map(blocker => blocker.message).join(' ');

export const previewEntityMerge = async (
  db: DatabaseAdapter,
  workspaceName: string,
  sourceId: string,
  targetId: string,
  event: AuthenticatedEvent
): Promise<MergePreview> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'entity', workspace: workspaceName },
    operation: async ({ ws, authCtx }) => {
      const plan = await loadMergePlan(db, ws, sourceId, targetId, authCtx);
      return {
        sourceId: plan.source.id,
        targetId: plan.target.id,
        sourceVersion: plan.source.version ?? 1,
        targetVersion: plan.target.version ?? 1,
        previewFingerprint: plan.previewFingerprint,
        fieldConflicts: plan.fieldConflicts,
        dependentImpact: plan.dependentImpact,
        relationConflicts: plan.relationConflicts,
        sideTableConflicts: plan.sideTableSnapshot.conflicts,
        sideTableCounts: plan.sideTableCounts,
        blockers: plan.blockers,
        truncated: plan.truncated
      } satisfies MergePreview;
    }
  });

const validateExecuteResolutions = (plan: MergePlan, body: MergeExecuteBody) => {
  const fieldKeys = new Set(plan.fieldConflicts.map(conflict => conflict.fieldKey));
  for (const key of Object.keys(body.fieldResolutions)) {
    httpAssert.true(fieldKeys.has(key), {
      status: 400,
      message: `Unknown entity merge field resolution '${key}'.`
    });
  }
  for (const conflict of plan.fieldConflicts) {
    httpAssert.present(body.fieldResolutions[conflict.fieldKey], {
      status: 409,
      message: `A resolution is required for field '${conflict.fieldKey}'.`
    });
  }

  const relationIds = new Set(plan.relationConflicts.map(conflict => conflict.relationId));
  for (const id of Object.keys(body.relationResolutions)) {
    httpAssert.true(relationIds.has(id), {
      status: 400,
      message: `Unknown entity merge relation resolution '${id}'.`
    });
  }
  for (const conflict of plan.relationConflicts) {
    const resolution = body.relationResolutions[conflict.relationId];
    httpAssert.present(resolution, {
      status: 409,
      message: `A resolution is required for relation '${conflict.relationId}'.`
    });
    if (conflict.note === 'self') {
      httpAssert.true(resolution === 'drop_source', {
        status: 400,
        message: `Self relation '${conflict.relationId}' can only be dropped.`
      });
    }
  }

  const sideConflictIds = new Set(
    plan.sideTableSnapshot.conflicts.map(conflict => conflict.conflictId)
  );
  for (const id of Object.keys(body.sideTableResolutions)) {
    httpAssert.true(sideConflictIds.has(id), {
      status: 400,
      message: `Unknown entity merge side-table resolution '${id}'.`
    });
  }
  for (const conflict of plan.sideTableSnapshot.conflicts) {
    httpAssert.present(body.sideTableResolutions[conflict.conflictId], {
      status: 409,
      message: `A resolution is required for side-table conflict '${conflict.conflictId}'.`
    });
  }
};

const buildTargetUpdate = (
  source: EntityDbResult,
  target: EntityDbResult,
  targetSchema: SchemaDbResult | undefined,
  fieldConflicts: MergeFieldConflict[],
  fieldResolutions: MergeExecuteBody['fieldResolutions']
): EntityDbUpdate => {
  const data = { ...target.data };
  const next: Record<string, unknown> = {
    slug: target.slug,
    namespace: target.namespace,
    name: target.name,
    description: target.description,
    owner: target.owner,
    lifecycle: target.lifecycle,
    target_lifecycle: target.target_lifecycle,
    target_lifecycle_date: target.target_lifecycle_date,
    tags: target.tags,
    links: target.links,
    schema_id: target.schema_id,
    data,
    generated_metadata: target.generated_metadata ?? {},
    project_id: target.project_id,
    completeness: target.completeness,
    updated_at: new Date()
  };

  for (const conflict of fieldConflicts) {
    if (fieldResolutions[conflict.fieldKey] !== 'source') continue;
    if (conflict.kind === 'core') {
      const key = conflict.fieldKey.slice('core:'.length);
      next[key] = (source as unknown as Record<string, unknown>)[key];
      continue;
    }
    const fieldId = conflict.fieldKey.slice('data:'.length);
    if (Object.hasOwn(source.data, fieldId)) data[fieldId] = source.data[fieldId];
    else delete data[fieldId];
  }

  // A canonical entity cannot retain a reference to itself after the source is retired.
  for (const field of targetSchema?.fields ?? []) {
    if (!isReferenceOrContainmentField(field)) continue;
    if (!Object.hasOwn(data, field.id)) continue;
    const ids = decodeRefs(data[field.id]);
    data[field.id] = [...new Set(ids.filter(id => id !== source.id))];
  }

  const nextEntity = { ...target, ...next, data } as Entity;
  next.completeness = targetSchema
    ? computeEntityCompleteness(nextEntity, targetSchema)
    : target.completeness;
  return next as EntityDbUpdate;
};

const buildDependentUpdate = (
  entity: EntityDbResult,
  schema: SchemaDbResult,
  entities: EntityDbResult[],
  sourceId: string,
  targetId: string
): EntityDbUpdate | null => {
  const data = { ...entity.data };
  let changed = false;
  for (const field of relationFields(schema.fields)) {
    const ids = decodeRefs(data[field.id]);
    if (!ids.includes(sourceId)) continue;
    data[field.id] = [...new Set(ids.map(id => (id === sourceId ? targetId : id)))];
    changed = true;
  }
  if (!changed) return null;
  const normalizedData = normalizeEntityRelationFields({ schema, fields: data, entities });
  const nextEntity = { ...entity, data: normalizedData };
  return {
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
    data: normalizedData,
    generated_metadata: entity.generated_metadata ?? {},
    project_id: entity.project_id,
    completeness: computeEntityCompleteness(nextEntity, schema),
    updated_at: new Date()
  };
};

export const executeEntityMerge = async (
  db: DatabaseAdapter,
  workspaceName: string,
  sourceId: string,
  body: MergeExecuteBody,
  event: AuthenticatedEvent
): Promise<MergeExecuteResponse> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'entity', workspace: workspaceName },
    operation: async ({ ws, authCtx }) =>
      withCatalogMutationTransaction(db, async tx => {
        // Resolve public ids first, then lock the actual catalog rows before taking the
        // authoritative snapshot. SQLite's BEGIN IMMEDIATE supplies the same serialization.
        const initialPlan = await loadMergePlan(tx, ws, sourceId, body.targetId, authCtx);
        await tx.entityMerge.lockRecords(ws, [initialPlan.source.id, initialPlan.target.id]);
        const lockedPlan = await loadMergePlan(tx, ws, sourceId, body.targetId, authCtx);
        await tx.entityMerge.lockRecords(ws, [
          ...new Set([
            ...lockedPlan.rawDependentIds,
            ...lockedPlan.pairRelations.map(relation => relation.id)
          ])
        ]);
        const plan = await loadMergePlan(tx, ws, sourceId, body.targetId, authCtx);

        httpAssert.true(plan.source.version === body.expectedSourceVersion, {
          status: 409,
          message: 'The source entity changed after the merge preview; refresh and try again.'
        });
        httpAssert.true(plan.target.version === body.expectedTargetVersion, {
          status: 409,
          message: 'The target entity changed after the merge preview; refresh and try again.'
        });
        httpAssert.true(plan.previewFingerprint === body.previewFingerprint, {
          status: 409,
          message: 'The merge participants changed after the preview; refresh and try again.'
        });
        httpAssert.true(plan.blockers.length === 0, {
          status: 409,
          message: firstBlockerMessage(plan.blockers)
        });
        validateExecuteResolutions(plan, body);

        const actor = {
          id: event.context.user.id,
          displayName: event.context.user.display_name
        };
        const mergeId = crypto.randomUUID();
        const sourceIdentityResolution = ['core:slug', 'core:namespace'].some(
          fieldKey => body.fieldResolutions[fieldKey] === 'source'
        );
        if (sourceIdentityResolution) {
          const released = await tx.entityMerge.releaseSourceIdentity(
            ws,
            plan.source.id,
            plan.source.version ?? 1,
            `__merge_${mergeId}`,
            `__merge_${mergeId}`
          );
          httpAssert.true(released, {
            status: 409,
            message: 'The source entity changed while the merge was being applied.'
          });
        }
        const targetUpdate = buildTargetUpdate(
          plan.source,
          plan.target,
          plan.targetSchema,
          plan.fieldConflicts,
          body.fieldResolutions
        );
        const updatedTarget = await updateEntityWithAudit(tx, {
          workspace: ws,
          entityId: plan.target.id,
          previous: plan.target,
          next: targetUpdate,
          actor,
          auditMetadata: { mergeId, sourceId: plan.source.id, targetId: plan.target.id }
        });
        httpAssert.present(updatedTarget, {
          status: 409,
          message: 'The target entity changed while the merge was being applied.'
        });

        const schemaById = new Map(plan.schemas.map(schema => [schema.id, schema]));
        const entitiesAfterTarget = plan.entities.map(entity =>
          entity.id === updatedTarget.id ? updatedTarget : entity
        );
        for (const dependentId of plan.rawDependentIds) {
          if (dependentId === plan.target.id) continue;
          const dependent = entitiesAfterTarget.find(entity => entity.id === dependentId);
          const schema = dependent ? schemaById.get(dependent.schema_id) : undefined;
          if (!dependent || !schema) continue;
          const next = buildDependentUpdate(
            dependent,
            schema,
            entitiesAfterTarget,
            plan.source.id,
            plan.target.id
          );
          if (!next) continue;
          const updated = await updateEntityWithAudit(tx, {
            workspace: ws,
            entityId: dependent.id,
            previous: dependent,
            next,
            actor,
            auditMetadata: {
              mergeId,
              sourceId: plan.source.id,
              targetId: plan.target.id,
              mergeDependent: true
            }
          });
          httpAssert.present(updated, {
            status: 409,
            message: 'A dependent entity changed while the merge was being applied.'
          });
        }

        await tx.entityMerge.applyRelationRewrites(
          ws,
          plan.source.id,
          plan.target.id,
          plan.sourceRelations,
          plan.relationConflicts,
          body.relationResolutions
        );
        await tx.entityMerge.applySideTableRewrites(
          ws,
          plan.source.id,
          plan.target.id,
          body.sideTableResolutions
        );
        await tx.entityMerge.moveRecordVersions(ws, plan.source.id, plan.target.id);

        await tx.catalog.createCatalogRecordMerge({
          merged_record_id: plan.source.id,
          workspace: ws,
          canonical_record_id: plan.target.id,
          merged_public_id: plan.source.public_id,
          merged_slug: plan.source.slug,
          merged_namespace: plan.source.namespace,
          merged_schema_id: plan.source.schema_id,
          merged_at: new Date(),
          merged_by: actor.id,
          merge_id: mergeId
        });
        const deleted = await tx.entityMerge.deleteSourceRecord(
          ws,
          plan.source.id,
          plan.source.version ?? 1
        );
        httpAssert.true(deleted, {
          status: 409,
          message: 'The source entity changed while the merge was being applied.'
        });
        const remainingReferences = await tx.entityMerge.countRemainingReferences(
          ws,
          plan.source.id
        );
        httpAssert.true(remainingReferences === 0, {
          status: 409,
          message: 'The merge left references to the retired entity; no changes were committed.'
        });

        return {
          mergeId,
          sourceId: plan.source.id,
          targetId: updatedTarget.id,
          entity: toApiEntity(
            updatedTarget,
            authCtx,
            plan.targetSchema ?? null,
            updatedTarget.completeness
          )
        };
      })
  });
