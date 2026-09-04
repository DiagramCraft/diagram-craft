import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import type { Entity, SchemaDbResult } from './db/catalogDatabase';
import type { RelationDbResult } from './db/relationDatabase';
import { requireEntityAction, requireWorkspaceCapability } from '../auth/authorization';
import { runAuthorizedOperation } from '../operation';
import { httpAssert } from '../../utils/httpAssert';
import { buildBatchEntityDependents } from './dataHelpers';
import { listAllCatalogEntities } from './entityLoader';
import { buildDiff, equalEntityValue, redactDataDiff } from './entityDiff';
import { isFieldEditRestricted, isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import type {
  MergeBlocker,
  MergeDependentImpact,
  MergeFieldConflict,
  MergePreview,
  MergeRelationConflict
} from '@arch-register/api-types/entityMergeContract';

const dedupeRelations = (rows: RelationDbResult[]): RelationDbResult[] => {
  const byId = new Map<string, RelationDbResult>();
  for (const row of rows) byId.set(row.id, row);
  return [...byId.values()];
};

const fieldNameById = (schema: SchemaDbResult | undefined): Map<string, string> =>
  new Map((schema?.fields ?? []).map(field => [field.id, field.name]));

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
      conflicts.push({ ...base, note: 'self' });
      continue;
    }
    const duplicate = targetRelationsByKey.get(key(row.schema_id, repointedIn, repointedOut));
    if (duplicate && duplicate.id !== row.id) {
      conflicts.push({ ...base, note: 'duplicate' });
    }
  }
  return conflicts;
};

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
      const [sourceEntity, targetEntity] = await Promise.all([
        db.catalog.getEntity(ws, sourceId),
        db.catalog.getEntity(ws, targetId)
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

      const [schemas, entities, relationSchemas, relationsForPair, openApproval, openCases] =
        await Promise.all([
          db.catalog.listSchemas(ws),
          listAllCatalogEntities(db, ws),
          db.relation.listRelationSchemas(ws),
          db.relation.listRelationsForEntities(ws, [sourceEntity.id, targetEntity.id]),
          db.entityChange.getOpenApproval(ws, sourceEntity.id),
          db.governance.listCases(ws, { subjectId: sourceEntity.id, status: 'open' })
        ]);

      if (openCases.length > 0) {
        blockers.push({
          code: 'open_governance_case',
          message: 'The source entity has an open governance case and cannot be merged.'
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

      // Dependent impact — reverse references that currently point at the source.
      const pairRelations = dedupeRelations([
        ...relationsForPair.outgoing,
        ...relationsForPair.incoming
      ]);
      const entityLookup = new Map<string, Entity>(entities.map(e => [e.id, e]));
      const batch = buildBatchEntityDependents(
        [sourceEntity.id],
        entities,
        schemas,
        { transitive: false },
        authCtx,
        pairRelations,
        relationSchemas
      );
      const { dependents, truncated } = batch.get(sourceEntity.id) ?? {
        dependents: [],
        truncated: false
      };
      const dependentImpact: MergeDependentImpact[] = dependents.map(dependent => ({
        entityId: dependent.entityId,
        entityName: dependent.entityName,
        entitySlug: dependent.entitySlug,
        entitySchemaId: dependent.entitySchemaId,
        schemaName: dependent.schemaName,
        ownerTeamId: entityLookup.get(dependent.entityId)?.owner ?? null,
        fieldName: dependent.fieldName,
        kind: dependent.kind
      }));

      const sourceRelations = pairRelations.filter(
        row => row.in_entity_id === sourceEntity.id || row.out_entity_id === sourceEntity.id
      );
      const relationConflicts = buildRelationConflicts(
        sourceEntity.id,
        targetEntity.id,
        pairRelations,
        relationSchemas
      );

      const entityVersions = await db.catalog.listEntityVersions(ws, sourceEntity.id);

      return {
        sourceId: sourceEntity.id,
        targetId: targetEntity.id,
        fieldConflicts,
        dependentImpact,
        relationConflicts,
        sideTableCounts: {
          entityVersions: entityVersions.length,
          openChangeApprovals: openApproval ? 1 : 0,
          openGovernanceCases: openCases.length,
          incomingRelations: sourceRelations.filter(r => r.out_entity_id === sourceEntity.id)
            .length,
          outgoingRelations: sourceRelations.filter(r => r.in_entity_id === sourceEntity.id).length
        },
        blockers,
        truncated
      } satisfies MergePreview;
    }
  });
