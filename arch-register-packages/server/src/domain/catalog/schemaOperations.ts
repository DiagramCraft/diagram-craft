import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { requireSchemaRead, requireWorkspaceCapability } from '../auth/authorization';
import { runAuthorizedOperation } from '../operation';
import { handleDbError } from '../../utils/http';
import { httpAssert } from '../../utils/httpAssert';
import { countEntities } from './entityQueryOperations';
import { parseEntityQuery, buildEntityQueryForExecution } from './entityQuery';
import { listAllCatalogEntities } from './entityLoader';
import { enqueueOneOffJobRun } from '../jobs/jobOperations';
import {
  ENTITY_COMPLETENESS_JOB_TYPE,
  ENTITY_COMPLETENESS_SYSTEM_IDENTITY,
  ensureEntityCompletenessScanScheduleExists
} from './entityCompletenessJob';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import {
  toApiSchema,
  toApiSchemaVersion,
  buildCreateSchemaInput,
  buildUpdateSchemaInput,
  toFieldMigrationFields
} from './schemaHelpers';
import {
  buildFieldChangeSummary,
  describeHardBlockedChange,
  planFieldMigrations
} from '../fieldMigration/fieldMigrationPlanning';
import { compileSchemaWithSharedGroups } from './fieldGroupHelpers';
import { encodeCaseSubkind } from '../governance/governanceCaseSubkind';
import {
  materializeDerivedFields,
  validateDerivedFieldGroupAccess
} from '../derived/derivedFields';
import { recalculateEntityDerivedFields } from '../derived/derivedRecalculation';
import { previewEntityValidation } from './entityValidationRules';
import { normalizeEntityScalarFields } from './entityScalarValues';
import { remapWorkspaceCapabilityFieldMappings } from '../workspace/workspaceCapabilityOperations';
import {
  getSchemaGovernancePolicies,
  getSchemaGovernancePoliciesBySchema
} from '../governance/schemaGovernancePolicy';
import {
  EntitySchema,
  CreateSchemaRequest,
  PendingFieldChange,
  SchemaVersion,
  UpdateSchemaRequest
} from '@arch-register/api-types/schemaContract';

const dbErrorMessages = {
  unique: 'A schema with that name already exists in this workspace',
  foreign: 'Cannot delete schema: entities still reference it'
} as const;

const countEntitiesForSchema = (db: DatabaseAdapter, ws: string, schemaId: string) => {
  const parsed = parseEntityQuery({ _schemaId: schemaId });
  return countEntities(db, ws, null, {
    entityQuery: buildEntityQueryForExecution({ _schemaId: schemaId }, parsed)
  });
};

// computeEntityCompleteness only depends on which fields are 'required'/'expected' (not their
// other properties), so completeness is stale only when that specific set changes.
const completenessExpectedFieldIds = (fields: SchemaField[]): string[] =>
  fields
    .filter(f => f.requirementLevel === 'required' || f.requirementLevel === 'expected')
    .map(f => f.id)
    .sort();

const completenessRelevantFieldsChanged = (
  oldFields: SchemaField[],
  newFields: SchemaField[]
): boolean => {
  const before = completenessExpectedFieldIds(oldFields);
  const after = completenessExpectedFieldIds(newFields);
  return before.length !== after.length || before.some((id, index) => id !== after[index]);
};

export const listWorkspaceSchemas = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<EntitySchema[]> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve schemas',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      const [schemas, enums, allEntities, policiesBySchema] = await Promise.all([
        db.catalog.listSchemas(ws),
        db.catalog.listEnums(ws),
        listAllCatalogEntities(db, ws),
        getSchemaGovernancePoliciesBySchema(db, ws)
      ]);
      const countBySchema = new Map<string, number>();
      for (const entity of allEntities) {
        countBySchema.set(entity.schema_id, (countBySchema.get(entity.schema_id) ?? 0) + 1);
      }
      return schemas.map(schema =>
        toApiSchema(
          schema,
          countBySchema.get(schema.id) ?? 0,
          enums,
          policiesBySchema.get(schema.id)
        )
      );
    }
  });
};

export const previewWorkspaceSchemaValidation = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string,
  body: {
    validation_rules: import('@arch-register/api-types/schemaContract').ValidationRule[];
    entityIds?: string[];
  },
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to preview schema validation',
    dbErrorMessages,
    operation: async ({ authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      return previewEntityValidation(
        db,
        workspace,
        schemaId,
        body.validation_rules,
        body.entityIds
      );
    }
  });

export const getWorkspaceSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<EntitySchema> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve schema',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      const [row, enums] = await Promise.all([
        db.catalog.getSchema(ws, id),
        db.catalog.listEnums(ws)
      ]);
      httpAssert.present(row, { status: 404, message: `Schema '${id}' not found` });
      const entityCount = await countEntitiesForSchema(db, ws, id);
      return toApiSchema(row, entityCount, enums, await getSchemaGovernancePolicies(db, ws, id));
    }
  });
};

export const createWorkspaceSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  body: CreateSchemaRequest,
  event: AuthenticatedEvent
): Promise<EntitySchema> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to create schema',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const teamIds = new Set((await db.workspace.listTeams(ws)).map(owner => owner.id));
      const timestamp = new Date();
      const sharedGroups = await db.catalog.listSharedFieldGroups(ws);
      const requested = buildCreateSchemaInput(ws, body, teamIds, timestamp);
      const compiled = compileSchemaWithSharedGroups(requested, sharedGroups);
      validateDerivedFieldGroupAccess(compiled.fields, compiled.groups ?? []);
      const row = await db.catalog.createSchema(compiled);
      httpAssert.present(row.key_prefix, {
        status: 409,
        message: `Schema '${row.id}' is missing a key prefix`
      });
      await db.workspace.registerPublicIdPrefix(row.key_prefix, 'schema', row.id, timestamp);

      await db.catalog.createSchemaVersion({
        id: randomUUID(),
        workspace: ws,
        schema_id: row.id,
        version: row.version ?? 1,
        name: row.name,
        category: row.category ?? null,
        description: row.description,
        fields: row.fields,
        templates: row.templates ?? [],
        groups: row.groups ?? [],
        shared_field_group_links: row.shared_field_group_links ?? [],
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
        entityType: 'entity_schema',
        entityId: row.id,
        entityName: row.name,
        changes: { new: extractEntityFields(row) }
      });

      const enums = await db.catalog.listEnums(ws);
      return toApiSchema(row, 0, enums, await getSchemaGovernancePolicies(db, ws, row.id));
    }
  });
};

export const updateWorkspaceSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: UpdateSchemaRequest,
  event: AuthenticatedEvent
): Promise<EntitySchema> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to update schema',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const oldRow = await db.catalog.getSchema(ws, id);
      httpAssert.present(oldRow, { status: 404, message: `Schema '${id}' not found` });

      const teamIds = new Set((await db.workspace.listTeams(ws)).map(owner => owner.id));
      const next = buildUpdateSchemaInput(body, oldRow, teamIds, new Date());
      const sharedGroups = await db.catalog.listSharedFieldGroups(ws);
      const compiledNext = compileSchemaWithSharedGroups(
        { ...oldRow, ...next, shared_field_group_links: next.shared_field_group_links },
        sharedGroups
      );
      const fieldMigrations = body.fieldMigrations;

      const entityCount = await countEntitiesForSchema(db, ws, id);

      const finalFields = [...compiledNext.fields];
      const fieldMigrationPlan = planFieldMigrations(
        toFieldMigrationFields(oldRow.fields),
        toFieldMigrationFields(compiledNext.fields),
        fieldMigrations,
        {
          decisionRequiredFieldIds: entityCount > 0 ? undefined : new Set<string>(),
          applicableFieldIds: entityCount > 0 ? undefined : new Set<string>()
        }
      );
      const fieldChanges = fieldMigrationPlan.changes;
      const dataMigrations = entityCount > 0 ? fieldMigrationPlan.dataMigrations : [];

      if (entityCount > 0) {
        httpAssert.true(fieldMigrationPlan.hardBlocked.length === 0, {
          status: 409,
          message: `Cannot update schema: ${fieldMigrationPlan.hardBlocked
            .map(change => describeHardBlockedChange(change))
            .join('; ')}`
        });

        const unresolved = fieldMigrationPlan.unresolved;
        if (unresolved.length > 0) {
          const oldFieldsById = new Map(oldRow.fields.map(field => [field.id, field]));
          const entities = await listAllCatalogEntities(db, ws, { schemaId: id });
          const pendingChanges: PendingFieldChange[] = unresolved.map(change => ({
            fieldId: change.fieldId,
            fieldName: oldFieldsById.get(change.fieldId)?.name ?? change.fieldName,
            kind: change.kind,
            renamedToId: change.renamedToId,
            entityCount: entities.filter(
              entity =>
                entity.data[change.fieldId] !== undefined && entity.data[change.fieldId] !== null
            ).length
          }));
          httpAssert.true(false, {
            status: 409,
            message: `Cannot update schema: field changes require a migration decision (${pendingChanges.map(c => c.fieldName).join(', ')})`,
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

      validateDerivedFieldGroupAccess(finalFields, compiledNext.groups ?? []);

      const changeSummary = buildFieldChangeSummary(
        toFieldMigrationFields(oldRow.fields),
        toFieldMigrationFields(finalFields),
        fieldMigrations
      );
      const capabilityFieldRenames = [
        ...fieldChanges.flatMap(change =>
          change.kind === 'renamed' && change.renamedToId
            ? [{ oldFieldId: change.fieldId, newFieldId: change.renamedToId }]
            : []
        ),
        ...dataMigrations.flatMap(migration =>
          migration.action === 'rename'
            ? [{ oldFieldId: migration.oldFieldId, newFieldId: migration.newFieldId }]
            : []
        )
      ];
      const configMigrations: Array<{
        action: 'rename' | 'remove';
        oldFieldId: string;
        newFieldId?: string;
      }> = [];
      for (const oldField of oldRow.fields) {
        if (oldField.type !== 'date') continue;
        const change = fieldChanges.find(candidate => candidate.fieldId === oldField.id);
        if (change?.kind === 'renamed' && change.renamedToId) {
          configMigrations.push({
            action: 'rename',
            oldFieldId: oldField.id,
            newFieldId: change.renamedToId
          });
          continue;
        }
        const nextField = finalFields.find(field => field.id === oldField.id);
        if (nextField?.type !== 'date' || nextField.archived) {
          configMigrations.push({ action: 'remove', oldFieldId: oldField.id });
        }
      }

      const row = await db.core.transaction(async tx => {
        for (const migration of dataMigrations) {
          if (migration.action === 'rename') {
            await tx.catalog.renameEntityDataField(
              ws,
              id,
              migration.oldFieldId,
              migration.newFieldId
            );
          } else {
            await tx.catalog.removeEntityDataField(ws, id, migration.oldFieldId);
            await tx.governanceCaseConfig.deleteCaseConfigForSubkindOrDescendants(
              ws,
              encodeCaseSubkind(id, migration.oldFieldId)
            );
          }
        }

        for (const migration of configMigrations) {
          const oldSubkind = encodeCaseSubkind(id, migration.oldFieldId);
          if (migration.action === 'rename') {
            const config = await tx.governanceCaseConfig.getCaseConfig(
              ws,
              'field-date-reminder',
              oldSubkind
            );
            if (config) {
              await tx.governanceCaseConfig.upsertCaseConfig({
                workspace: ws,
                case_kind: config.case_kind,
                case_subkind: encodeCaseSubkind(id, migration.newFieldId),
                enabled: config.enabled,
                config: config.config,
                updated_at: next.updated_at,
                updated_by: authCtx.userId
              });
            }
          }
          await tx.governanceCaseConfig.deleteCaseConfigForSubkindOrDescendants(ws, oldSubkind);
        }

        await remapWorkspaceCapabilityFieldMappings(
          tx,
          ws,
          { kind: 'entity_schema', id },
          capabilityFieldRenames,
          next.updated_at
        );

        const updated = await tx.catalog.updateSchema(ws, id, {
          name: next.name,
          category: next.category,
          key_prefix: next.key_prefix,
          description: next.description,
          fields: finalFields,
          templates: next.templates,
          groups: compiledNext.groups,
          shared_field_group_links: compiledNext.shared_field_group_links ?? [],
          validation_rules: next.validation_rules,
          color: next.color,
          icon: next.icon,
          default_owner: next.defaultOwner,
          version: (oldRow.version ?? 1) + 1,
          updated_at: next.updated_at
        });
        httpAssert.present(updated, { status: 404, message: `Schema '${id}' not found` });

        if (oldRow.key_prefix !== updated.key_prefix) {
          try {
            await tx.workspace.updatePublicIdPrefix(
              oldRow.key_prefix,
              updated.key_prefix,
              'schema',
              id,
              next.updated_at
            );
          } catch (error) {
            handleDbError(error, 'Failed to update key prefix', {
              unique: 'A schema with that key prefix already exists'
            });
          }
        }

        await tx.catalog.createSchemaVersion({
          id: randomUUID(),
          workspace: ws,
          schema_id: id,
          version: updated.version ?? 1,
          name: updated.name,
          category: updated.category ?? null,
          description: updated.description,
          fields: updated.fields,
          templates: updated.templates ?? [],
          groups: updated.groups ?? [],
          shared_field_group_links: updated.shared_field_group_links ?? [],
          color: updated.color,
          icon: updated.icon,
          validation_rules: updated.validation_rules ?? [],
          change_summary: changeSummary,
          created_by: authCtx.userId,
          created_at: next.updated_at
        });

        if (entityCount > 0) {
          const entities = await listAllCatalogEntities(tx, ws, { schemaId: id });
          const currencyConfig = await tx.workspace.getSupportedCurrencies(ws);
          const supportedCurrencies = new Set(
            currencyConfig.currencies.map(currency => currency.code)
          );
          for (const entity of entities) {
            const normalizedData = normalizeEntityScalarFields({
              schemaFields: finalFields,
              fields: entity.data,
              supportedCurrencies
            });
            await tx.catalog.updateEntityDerivedFields(
              ws,
              entity.id,
              materializeDerivedFields(
                finalFields,
                normalizedData,
                {
                  objectType: 'entity',
                  objectId: entity.id
                },
                compiledNext.groups ?? []
              )
            );
          }
        }

        await recalculateEntityDerivedFields(tx, ws);

        return updated;
      });

      if (entityCount > 0 && completenessRelevantFieldsChanged(oldRow.fields, row.fields)) {
        await ensureEntityCompletenessScanScheduleExists(db, ws, next.updated_at);
        await enqueueOneOffJobRun(
          db,
          {
            workspace: ws,
            jobType: ENTITY_COMPLETENESS_JOB_TYPE,
            systemIdentity: ENTITY_COMPLETENESS_SYSTEM_IDENTITY,
            payload: { schemaId: id }
          },
          next.updated_at
        );
      }

      const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row));

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'entity_schema',
        entityId: id,
        entityName: row.name,
        changes,
        metadata: fieldMigrations ? { fieldMigrations } : undefined
      });

      const enums = await db.catalog.listEnums(ws);
      return toApiSchema(row, entityCount, enums, await getSchemaGovernancePolicies(db, ws, id));
    }
  });
};

export const listWorkspaceSchemaVersions = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<SchemaVersion[]> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve schema version history',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      const schema = await db.catalog.getSchema(ws, id);
      httpAssert.present(schema, { status: 404, message: `Schema '${id}' not found` });
      const [versions, enums] = await Promise.all([
        db.catalog.listSchemaVersions(ws, id),
        db.catalog.listEnums(ws)
      ]);
      return versions.map(version => toApiSchemaVersion(version, enums));
    }
  });
};

export const deleteWorkspaceSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string }> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to delete schema',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'schema.edit');
      const schema = await db.catalog.getSchema(ws, id);
      httpAssert.present(schema, { status: 404, message: `Schema '${id}' not found` });

      const entityCount = await countEntitiesForSchema(db, ws, id);
      httpAssert.true(entityCount === 0, {
        status: 409,
        message: 'Cannot delete schema: entities still reference it'
      });

      await db.catalog.deleteSchema(ws, id);
      await db.governanceCaseConfig.deleteCaseConfigForSubkindOrDescendants(ws, id);
      if (schema.key_prefix) {
        await db.workspace.deletePublicIdPrefix(schema.key_prefix);
      }

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'delete',
        entityType: 'entity_schema',
        entityId: id,
        entityName: schema.name,
        changes: { old: extractEntityFields(schema) }
      });

      return { success: true, message: `Schema '${id}' deleted` };
    }
  });
};
