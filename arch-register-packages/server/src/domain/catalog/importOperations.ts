import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter, EntityDbUpdate, EntityDbCreate } from '../../db/database';
import { parseCsv, validateCsvData, csvRowToEntity } from '../../utils/csvImport';
import { computeChanges, extractEntityFields, flattenEntityAuditFields, logAudit } from '../audit/db/auditLogging';
import { slugify } from '../../utils/http';
import type { AuthorizationContext } from '@arch-register/permissions';
import { requireCanCreateTopLevelEntity, requireEntityAction } from '../auth/authorization';
import { PermissionChecker } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';
import { formatPublicId } from '../../utils/publicIds';
import {
  getLifecycleValues,
  getTeamIds,
  resolveCreateOwner
} from './dataHelpers';

const checker = new PermissionChecker();

export type ImportParseInput = {
  workspace: string;
  schemaId: string;
  csvContent: string;
};

export type ImportCommitInput = {
  workspace: string;
  schemaId: string;
  entities: Array<Record<string, unknown> & { _existingId?: string }>;
  auditUser: { id: string; display_name: string };
};

export const importParse = async (
  db: DatabaseAdapter,
  authCtx: AuthorizationContext,
  input: ImportParseInput
) => {
  const { workspace, schemaId, csvContent } = input;

  const schema = await db.catalog.getSchema(workspace, schemaId);
  httpAssert.present(schema, { status: 404, message: 'Schema not found' });

  const parseResult = parseCsv(csvContent);
  const validatedRows = validateCsvData(parseResult.rows, schema.fields);

  const allEntities = await db.catalog.listEntities(workspace);
  const schemaEntities = allEntities.filter(e => e.schema_id === schemaId);

  const existingEntitiesMap = new Map(schemaEntities.map(e => [e.id, e]));
  const entitiesBySlug = new Map(schemaEntities.map(e => [`${e.namespace}:${e.slug}`, e]));
  const entitiesByName = new Map<string, (typeof allEntities)[0][]>();
  for (const entity of schemaEntities) {
    const name = entity.name.toLowerCase().trim();
    const list = entitiesByName.get(name) ?? [];
    list.push(entity);
    entitiesByName.set(name, list);
  }

  const entities = validatedRows.map(row => {
    const rowName = row.data['Name']?.toLowerCase().trim();
    const rowSlug = row.data['Slug']?.trim();
    const rowNamespace = row.data['Namespace']?.trim() || 'default';

    let existingEntity: (typeof allEntities)[0] | undefined;
    let matchType: 'id' | 'slug' | 'name' | 'none' = 'none';
    let nameMatches: typeof allEntities = [];
    const constraintViolations: Array<{
      type: 'duplicate_slug' | 'wrong_workspace' | 'wrong_schema';
      message: string;
    }> = [];

    if (row.existingId) {
      const entityById = existingEntitiesMap.get(row.existingId);
      if (entityById) {
        if (entityById.workspace !== workspace) {
          constraintViolations.push({
            type: 'wrong_workspace',
            message: 'ID exists but belongs to different workspace'
          });
          row.errors.push('ID exists but belongs to different workspace');
        } else if (entityById.schema_id !== schemaId) {
          constraintViolations.push({
            type: 'wrong_schema',
            message: 'ID exists but belongs to different schema type'
          });
          row.errors.push('ID exists but belongs to different schema type');
        } else {
          matchType = 'id';
          existingEntity = entityById;
        }
      }
    }

    if (matchType === 'none' && rowSlug) {
      const entityBySlug = entitiesBySlug.get(`${rowNamespace}:${rowSlug}`);
      if (entityBySlug) {
        matchType = 'slug';
        existingEntity = entityBySlug;
      }
    }

    if (matchType === 'none' && rowName && entitiesByName.has(rowName)) {
      matchType = 'name';
      nameMatches = entitiesByName.get(rowName)!;
      existingEntity = nameMatches[0];
    }

    if (matchType === 'none' || matchType === 'name') {
      const proposedSlug = rowSlug || (rowName ? slugify(rowName) : '');
      if (proposedSlug) {
        const wouldConflict = entitiesBySlug.has(`${rowNamespace}:${proposedSlug}`);
        if (wouldConflict) {
          constraintViolations.push({
            type: 'duplicate_slug',
            message: `Slug "${proposedSlug}" already exists in namespace "${rowNamespace}"`
          });
          if (matchType === 'none') {
            row.errors.push(
              `Slug "${proposedSlug}" already exists in namespace "${rowNamespace}"`
            );
          }
        }
      }
    }

    const isUpdate = matchType === 'id' || matchType === 'slug';

    if ((isUpdate || matchType === 'name') && existingEntity) {
      const hasPermission = checker.hasEntityPermission(authCtx, existingEntity, 'edit_entity');
      if (!hasPermission) {
        return {
          rowNumber: row.rowNumber,
          errors: [...row.errors, 'No permission to update this entity'],
          entity: null,
          isUpdate: false,
          matchType: 'none' as const,
          nameMatches: [],
          existingId: row.existingId,
          existingEntity: null,
          constraintViolations
        };
      }
    }

    return {
      rowNumber: row.rowNumber,
      errors: row.errors,
      entity: row.errors.length === 0 ? csvRowToEntity(row.data, schema.fields) : null,
      isUpdate,
      matchType,
      nameMatches:
        matchType === 'name'
          ? nameMatches.map(e => ({
              id: e.id,
              publicId: e.public_id ?? e.id,
              name: e.name,
              slug: e.slug,
              namespace: e.namespace
            }))
          : [],
      existingId: existingEntity?.id ?? row.existingId,
      existingEntity:
        (isUpdate || matchType === 'name') && existingEntity
          ? {
              _name: existingEntity.name,
              _slug: existingEntity.slug,
              _namespace: existingEntity.namespace,
              _description: existingEntity.description,
              _owner: existingEntity.owner,
              _lifecycle: existingEntity.lifecycle,
              _tags: existingEntity.tags,
              ...(existingEntity.links && existingEntity.links.length > 0
                ? { _links: existingEntity.links }
                : {}),
              ...existingEntity.data
            }
          : null,
      constraintViolations: constraintViolations.length > 0 ? constraintViolations : undefined
    };
  });

  return {
    schemaId,
    schemaName: schema.name,
    totalRows: parseResult.totalRows,
    validRows: parseResult.validRows,
    entities
  };
};

export const importCommit = async (
  db: DatabaseAdapter,
  authCtx: AuthorizationContext,
  input: ImportCommitInput
) => {
  const { workspace, schemaId, entities: entityList, auditUser } = input;

  const schema = await db.catalog.getSchema(workspace, schemaId);
  httpAssert.present(schema, { status: 404, message: 'Schema not found' });

  requireCanCreateTopLevelEntity(
    authCtx,
    schema.id,
    'You do not have permission to create entities of this type'
  );

  const [lifecycleValues, teamIds, allEntities] = await Promise.all([
    getLifecycleValues(db, workspace),
    getTeamIds(db, workspace),
    db.catalog.listEntities(workspace)
  ]);

  const nameToId = new Map(allEntities.map(e => [e.name.toLowerCase(), e.id]));
  const entitiesById = new Map(allEntities.map(e => [e.id, e]));
  const entitiesBySlug = new Map(
    allEntities
      .filter(e => e.schema_id === schemaId && e.workspace === workspace)
      .map(e => [`${e.namespace}:${e.slug}`, e])
  );

  const createdIds: string[] = [];
  const updatedIds: string[] = [];

  for (const entityData of entityList) {
    const existingId = entityData._existingId as string | undefined;
    const existingEntity = existingId ? entitiesById.get(existingId) : undefined;

    if (existingId) {
      if (!existingEntity) throw new Error(`Entity ${existingId} not found`);
      if (existingEntity.workspace !== workspace)
        throw new Error(`Entity ${existingId} belongs to different workspace`);
      if (existingEntity.schema_id !== schemaId)
        throw new Error(`Entity ${existingId} has different schema type`);
    } else {
      const proposedSlug =
        (entityData._slug as string) || slugify((entityData._name as string) ?? '');
      const proposedNamespace = (entityData._namespace as string) || 'default';
      if (entitiesBySlug.has(`${proposedNamespace}:${proposedSlug}`)) {
        throw new Error(
          `Slug "${proposedSlug}" already exists in namespace "${proposedNamespace}"`
        );
      }
    }

    const isUpdate = !!existingEntity;
    const owner = resolveCreateOwner(
      (entityData._owner as string | null) ?? null,
      [],
      schema,
      teamIds,
      authCtx.userId
    );

    const lifecycle = (entityData._lifecycle as string | null) ?? null;
    if (lifecycle && !lifecycleValues.has(lifecycle))
      throw new Error(`Invalid lifecycle value: ${lifecycle}`);
    const target_lifecycle = (entityData._targetLifecycle as string | null) ?? null;
    if (target_lifecycle && !lifecycleValues.has(target_lifecycle))
      throw new Error(`Invalid target_lifecycle value: ${target_lifecycle}`);
    const target_lifecycle_date = (entityData._targetLifecycleDate as string | null) ?? null;

    const resolvedData = { ...entityData };
    for (const field of schema.fields) {
      if (
        (field.type === 'reference' || field.type === 'containment') &&
        resolvedData[field.id]
      ) {
        const value = resolvedData[field.id];
        if (typeof value === 'string') {
          const refNames = value
            .split(',')
            .map(n => n.trim())
            .filter(Boolean);
          const refIds = refNames
            .map(name => nameToId.get(name.toLowerCase()))
            .filter((id): id is string => id !== undefined);
          if (refIds.length > 0) {
            resolvedData[field.id] = refIds.join(',');
          } else {
            delete resolvedData[field.id];
          }
        }
      }
    }

    if (isUpdate && existingId && existingEntity) {
      requireEntityAction(
        authCtx,
        existingEntity,
        'edit_entity',
        'You do not have permission to update this entity'
      );

      const updateInput: EntityDbUpdate = {
        name: (resolvedData._name as string) ?? existingEntity.name,
        slug: (resolvedData._slug as string) ?? existingEntity.slug,
        namespace: (resolvedData._namespace as string) ?? existingEntity.namespace,
        description: (resolvedData._description as string) ?? existingEntity.description,
        owner,
        lifecycle,
        target_lifecycle,
        target_lifecycle_date,
        tags: Array.isArray(resolvedData._tags)
          ? (resolvedData._tags as string[])
          : existingEntity.tags,
        links: existingEntity.links,
        schema_id: existingEntity.schema_id,
        data: extractEntityFields(Object.fromEntries(Object.entries(resolvedData).filter(([k]) => !k.startsWith('_')))),
        visibility_mode: existingEntity.visibility_mode,
        updated_at: new Date()
      };

      const updatedEntity = await db.catalog.updateEntity(workspace, existingId, updateInput);
      if (!updatedEntity) throw new Error(`Failed to update entity ${existingId}`);

      await logAudit(db, {
        workspace,
        userId: auditUser.id,
        userDisplayName: auditUser.display_name,
        operation: 'update',
        entityType: 'entity',
        entityId: existingId,
        entityName: updatedEntity.name,
        entitySlug: updatedEntity.slug,
        schemaId: updatedEntity.schema_id,
        changes: computeChanges(
          flattenEntityAuditFields(existingEntity),
          flattenEntityAuditFields(updatedEntity)
        )
      });

      updatedIds.push(existingId);
      nameToId.set(updatedEntity.name.toLowerCase(), existingId);
    } else {
      httpAssert.present(schema.key_prefix, { status: 409, message: `Schema '${schemaId}' is missing a key prefix` });
      const createInput: EntityDbCreate = {
        public_id: formatPublicId(
          schema.key_prefix,
          await db.workspace.allocatePublicId(schema.key_prefix, new Date())
        ),
        id: randomUUID(),
        workspace,
        schema_id: schemaId,
        name: (resolvedData._name as string) ?? '',
        slug: slugify((resolvedData._slug as string) ?? (resolvedData._name as string) ?? ''),
        namespace: (resolvedData._namespace as string) ?? '',
        description: (resolvedData._description as string) ?? '',
        owner,
        lifecycle,
        target_lifecycle,
        target_lifecycle_date,
        tags: Array.isArray(resolvedData._tags) ? (resolvedData._tags as string[]) : [],
        links: [],
        data: extractEntityFields(Object.fromEntries(Object.entries(resolvedData).filter(([k]) => !k.startsWith('_')))),
        visibility_mode: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      const entity = await db.catalog.createEntity(createInput);
      await logAudit(db, {
        workspace,
        userId: auditUser.id,
        userDisplayName: auditUser.display_name,
        operation: 'create',
        entityType: 'entity',
        entityId: entity.id,
        entityName: entity.name,
        entitySlug: entity.slug,
        schemaId: entity.schema_id,
        changes: { new: flattenEntityAuditFields(entity) }
      });

      createdIds.push(entity.id);
      nameToId.set(entity.name.toLowerCase(), entity.id);
    }
  }

  return { created: createdIds.length, updated: updatedIds.length, ids: [...createdIds, ...updatedIds] };
};
