import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { requireSchemaRead, requireWorkspaceCapability } from '../auth/authorization';
import { runAuthorizedOperation } from '../operation';
import { httpAssert } from '../../utils/httpAssert';
import {
  buildCreateRelationSchemaInput,
  buildUpdateRelationSchemaInput,
  compileRelationSchemaWithSharedGroups,
  toApiRelationSchema,
  toApiRelationSchemaVersion,
  toFieldMigrationFields
} from './relationSchemaHelpers';
import { assertCategoryExists, buildCategoryLookup } from './categoryOperations';
import type { CategoryLookup } from './schemaHelpers';
import { encodeCaseSubkind } from '../governance/governanceCaseSubkind';
import {
  buildFieldChangeSummary,
  describeHardBlockedChange,
  planFieldMigrations
} from '../fieldMigration/fieldMigrationPlanning';
import type { PendingFieldChange } from '@arch-register/api-types/common';
import type {
  CreateRelationSchemaRequest,
  RelationSchema,
  RelationSchemaVersion,
  UpdateRelationSchemaRequest
} from '@arch-register/api-types/relationSchemaContract';
import { validateDerivedFieldGroupAccess } from '../derived/derivedFields';
import { recalculateEntityDerivedFields } from '../derived/derivedRecalculation';

const dbErrorMessages = {
  unique: 'A relation schema with that name already exists in this workspace',
  foreign: 'Cannot delete relation schema: relation instances still reference it'
} as const;

export const listWorkspaceRelationSchemas = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<RelationSchema[]> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve relation schemas',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      const [schemas, enums, categories] = await Promise.all([
        db.relation.listRelationSchemas(ws),
        db.catalog.listEnums(ws),
        buildCategoryLookup(db, ws)
      ]);
      const counts = await Promise.all(
        schemas.map(schema => db.relation.countRelationsForSchema(ws, schema.id))
      );
      return schemas.map((schema, i) => toApiRelationSchema(schema, counts[i]!, enums, categories));
    }
  });
};

export const getWorkspaceRelationSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<RelationSchema> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve relation schema',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      const [row, enums, categories] = await Promise.all([
        db.relation.getRelationSchema(ws, id),
        db.catalog.listEnums(ws),
        buildCategoryLookup(db, ws)
      ]);
      httpAssert.present(row, { status: 404, message: `Relation schema '${id}' not found` });
      const relationCount = await db.relation.countRelationsForSchema(ws, id);
      return toApiRelationSchema(row, relationCount, enums, categories);
    }
  });
};

export const createWorkspaceRelationSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  body: CreateRelationSchemaRequest,
  event: AuthenticatedEvent
): Promise<RelationSchema> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to create relation schema',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const timestamp = new Date();
      const [entitySchemas, sharedGroups] = await Promise.all([
        db.catalog.listSchemas(ws),
        db.catalog.listSharedFieldGroups(ws)
      ]);
      const knownEntitySchemaIds = new Set(entitySchemas.map(schema => schema.id));
      const requested = buildCreateRelationSchemaInput(ws, body, knownEntitySchemaIds, timestamp);
      const categoryName = await assertCategoryExists(db, ws, requested.category_id);
      const compiled = compileRelationSchemaWithSharedGroups(requested, sharedGroups);
      validateDerivedFieldGroupAccess(compiled.fields, compiled.groups ?? [], 'relation');
      const row = await db.relation.createRelationSchema(compiled);

      await db.relation.createRelationSchemaVersion({
        id: randomUUID(),
        workspace: ws,
        schema_id: row.id,
        version: row.version ?? 1,
        name: row.name,
        category: categoryName,
        description: row.description,
        in_schema_ids: row.in_schema_ids,
        out_schema_ids: row.out_schema_ids,
        in_label: row.in_label,
        out_label: row.out_label,
        fields: row.fields,
        groups: row.groups ?? [],
        validation_rules: row.validation_rules ?? [],
        color: row.color,
        icon: row.icon,
        change_summary: buildFieldChangeSummary(null, toFieldMigrationFields(row.fields)),
        created_by: authCtx.userId,
        created_at: timestamp
      });

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'relation_schema',
        entityId: row.id,
        entityName: row.name,
        changes: { new: extractEntityFields(row) }
      });

      const enums = await db.catalog.listEnums(ws);
      const categories: CategoryLookup =
        row.category_id && categoryName ? new Map([[row.category_id, categoryName]]) : new Map();
      return toApiRelationSchema(row, 0, enums, categories);
    }
  });
};

export const updateWorkspaceRelationSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: UpdateRelationSchemaRequest,
  event: AuthenticatedEvent
): Promise<RelationSchema> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to update relation schema',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const oldRow = await db.relation.getRelationSchema(ws, id);
      httpAssert.present(oldRow, { status: 404, message: `Relation schema '${id}' not found` });

      const [entitySchemas, sharedGroups] = await Promise.all([
        db.catalog.listSchemas(ws),
        db.catalog.listSharedFieldGroups(ws)
      ]);
      const knownEntitySchemaIds = new Set(entitySchemas.map(schema => schema.id));
      const next = buildUpdateRelationSchemaInput(body, oldRow, knownEntitySchemaIds, new Date());
      const categoryName = await assertCategoryExists(db, ws, next.category_id);
      const compiledNext = compileRelationSchemaWithSharedGroups(
        { ...oldRow, ...next, shared_field_group_links: next.shared_field_group_links },
        sharedGroups
      );
      const fieldMigrations = body.fieldMigrations;

      const relationCount = await db.relation.countRelationsForSchema(ws, id);

      const finalFields = [...compiledNext.fields];
      const fieldMigrationPlan = planFieldMigrations(
        toFieldMigrationFields(oldRow.fields),
        toFieldMigrationFields(compiledNext.fields),
        fieldMigrations,
        {
          decisionRequiredFieldIds: relationCount > 0 ? undefined : new Set<string>(),
          applicableFieldIds: relationCount > 0 ? undefined : new Set<string>()
        }
      );
      const dataMigrations = relationCount > 0 ? fieldMigrationPlan.dataMigrations : [];

      if (relationCount > 0) {
        httpAssert.true(fieldMigrationPlan.hardBlocked.length === 0, {
          status: 409,
          message: `Cannot update relation schema: ${fieldMigrationPlan.hardBlocked
            .map(change => describeHardBlockedChange(change))
            .join('; ')}`
        });

        const unresolved = fieldMigrationPlan.unresolved;
        if (unresolved.length > 0) {
          const pendingChanges: PendingFieldChange[] = unresolved.map(change => ({
            fieldId: change.fieldId,
            fieldName: change.fieldName,
            kind: change.kind,
            renamedToId: change.renamedToId,
            entityCount: 0
          }));
          httpAssert.true(false, {
            status: 409,
            message: `Cannot update relation schema: field changes require a migration decision (${pendingChanges.map(c => c.fieldName).join(', ')})`,
            data: { code: 'SCHEMA_MIGRATION_REQUIRED', pendingChanges }
          });
        }

        const oldFieldsById = new Map(oldRow.fields.map(field => [field.id, field]));
        for (const fieldId of fieldMigrationPlan.archiveFieldIds) {
          const oldField = oldFieldsById.get(fieldId);
          if (oldField && !finalFields.some(field => field.id === oldField.id)) {
            finalFields.push({ ...oldField, archived: true });
          }
        }
      }

      validateDerivedFieldGroupAccess(finalFields, compiledNext.groups ?? [], 'relation');

      const changeSummary = buildFieldChangeSummary(
        toFieldMigrationFields(oldRow.fields),
        toFieldMigrationFields(finalFields),
        fieldMigrations
      );

      const row = await db.core.transaction(async tx => {
        for (const migration of dataMigrations) {
          if (migration.action === 'rename') {
            await tx.relation.renameRelationDataField(
              ws,
              id,
              migration.oldFieldId,
              migration.newFieldId
            );
          } else {
            await tx.relation.removeRelationDataField(ws, id, migration.oldFieldId);
            await tx.governanceCaseConfig.deleteCaseConfigForSubkindOrDescendants(
              ws,
              encodeCaseSubkind(id, migration.oldFieldId)
            );
          }
        }

        const updated = await tx.relation.updateRelationSchema(ws, id, {
          name: next.name,
          category_id: next.category_id,
          description: next.description,
          in_schema_ids: next.in_schema_ids,
          out_schema_ids: next.out_schema_ids,
          fields: finalFields,
          groups: compiledNext.groups,
          validation_rules: compiledNext.validation_rules ?? [],
          shared_field_group_links: compiledNext.shared_field_group_links ?? [],
          color: next.color,
          icon: next.icon,
          relation_approval_policy: next.relation_approval_policy,
          version: (oldRow.version ?? 1) + 1,
          updated_at: next.updated_at
        });
        httpAssert.present(updated, { status: 404, message: `Relation schema '${id}' not found` });

        await tx.relation.createRelationSchemaVersion({
          id: randomUUID(),
          workspace: ws,
          schema_id: id,
          version: updated.version ?? 1,
          name: updated.name,
          category: categoryName,
          description: updated.description,
          in_schema_ids: updated.in_schema_ids,
          out_schema_ids: updated.out_schema_ids,
          in_label: updated.in_label,
          out_label: updated.out_label,
          fields: updated.fields,
          groups: updated.groups ?? [],
          validation_rules: updated.validation_rules ?? [],
          color: updated.color,
          icon: updated.icon,
          change_summary: changeSummary,
          created_by: authCtx.userId,
          created_at: next.updated_at
        });

        return updated;
      });

      // A derived-field or its dependency may have been added/changed/removed — re-materialize
      // relation derived values across the workspace, mirroring the entity schema update path.
      const derivedFieldsTouched =
        oldRow.fields.some(field => field.type === 'derived') ||
        row.fields.some(field => field.type === 'derived');
      if (relationCount > 0 && derivedFieldsTouched) {
        await recalculateEntityDerivedFields(db, ws);
      }

      const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row));

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'relation_schema',
        entityId: id,
        entityName: row.name,
        changes,
        metadata: fieldMigrations ? { fieldMigrations } : undefined
      });

      const enums = await db.catalog.listEnums(ws);
      const categories: CategoryLookup =
        row.category_id && categoryName ? new Map([[row.category_id, categoryName]]) : new Map();
      return toApiRelationSchema(row, relationCount, enums, categories);
    }
  });
};

export const listWorkspaceRelationSchemaVersions = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<RelationSchemaVersion[]> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve relation schema version history',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      const schema = await db.relation.getRelationSchema(ws, id);
      httpAssert.present(schema, { status: 404, message: `Relation schema '${id}' not found` });
      const [versions, enums] = await Promise.all([
        db.relation.listRelationSchemaVersions(ws, id),
        db.catalog.listEnums(ws)
      ]);
      return versions.map(version => toApiRelationSchemaVersion(version, enums));
    }
  });
};

export const deleteWorkspaceRelationSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string }> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to delete relation schema',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const schema = await db.relation.getRelationSchema(ws, id);
      httpAssert.present(schema, { status: 404, message: `Relation schema '${id}' not found` });

      const relationCount = await db.relation.countRelationsForSchema(ws, id);
      httpAssert.true(relationCount === 0, {
        status: 409,
        message: 'Cannot delete relation schema: relation instances still reference it'
      });

      await db.relation.deleteRelationSchema(ws, id);
      await db.governanceCaseConfig.deleteCaseConfigForSubkindOrDescendants(ws, id);

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'delete',
        entityType: 'relation_schema',
        entityId: id,
        entityName: schema.name,
        changes: { old: extractEntityFields(schema) }
      });

      return { success: true, message: `Relation schema '${id}' deleted` };
    }
  });
};
