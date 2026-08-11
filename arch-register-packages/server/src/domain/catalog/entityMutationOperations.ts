import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthorizationContext } from '@arch-register/permissions';
import { slugify } from '../../utils/http';
import { httpAssert } from '../../utils/httpAssert';

import {
  requireEntityAction,
  requireCanCreateTopLevelEntity,
  requireWorkspaceCapability
} from '../auth/authorization';

import type { EntityMutationActor } from './entityMutations';
import { createEntityWithAudit, updateEntityWithAudit, entityToBaseState } from './entityMutations';
import { logAudit, flattenEntityAuditFields } from '../audit/db/auditLogging';
import { toApiEntity } from './entityHelpers';

import {
  handleError,
  parseEntityMutationPayload,
  resolveCreateOwner,
  getEntityParentsFromPayload,
  getLifecycleValues,
  getTeamIds,
  normalizeEntityRelationFields,
  relationFields
} from './dataHelpers';
import type { EntityMutationPayload } from './dataHelpers';
import { formatPublicId } from '../../utils/publicIds';
import { computeEntityCompleteness } from '../../utils/completeness';

import { EntityRecord } from '@arch-register/api-types/entityContract';

import { listAllCatalogEntities } from './entityLoader';

import type {
  Entity,
  EntityDbCreate,
  EntityDbResult,
  EntityVersionKind,
  SchemaDbResult
} from './db/catalogDatabase';
import { entityRequiresApproval } from './entityChangeOperations';
import {
  assertNoExternalEntityFieldWrites,
  normalizeEntityCurrencyFields
} from './entityValidation';
import { equalEntityValue } from './entityDiff';
import { requireNoRestrictedFieldWrites } from '../auth/fieldGroupAccessControl';
import type { ExternalMetadata } from '@arch-register/api-types/common';
import {
  applyExternalFieldUpdate,
  assertExternalUpdateOnlyChangesTarget,
  assertValidExternalUpdateTarget
} from '../externalMetadata/externalMetadataHelpers';
import { assertNoDerivedFieldWrites } from '../derived/derivedFields';
import { isTypedRelationField } from '@arch-register/api-types/schemaContract';
import { applyRelationFieldDelta } from './relationFieldMutations';
import { withCatalogMutationTransaction } from './mutationTransaction';
import { recalculateEntityDerivedFields } from '../derived/derivedRecalculation';
import { assertEntityGraphValid, validateEntityGraph } from './entityValidationRules';

type SupportedCurrencyLookup = (
  workspace: string
) => Promise<{ currencies: Array<{ code: string }> }>;

const getSupportedCurrencyCodes = async (db: DatabaseAdapter, workspace: string) => {
  // Keep lightweight test and extension adapters working while all production workspace
  // implementations expose supported-currency configuration.
  const lookup = (db.workspace as { getSupportedCurrencies?: SupportedCurrencyLookup })
    .getSupportedCurrencies;
  if (lookup == null) return null;
  const config = await lookup.call(db.workspace, workspace);
  return new Set(config.currencies.map(currency => currency.code));
};

const addValidationResult = (
  entity: EntityRecord,
  summary: Awaited<ReturnType<typeof validateEntityGraph>>
) => {
  const current = summary.results.find(result => result.entityId === entity._uid);
  return current && current.warnings.length > 0 ? { ...entity, _validation: current } : entity;
};

export const allocateEntityPublicId = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string,
  timestamp: Date
) => {
  const schema = await db.catalog.getSchema(workspace, schemaId);
  httpAssert.present(schema, { status: 404, message: `Schema '${schemaId}' not found` });
  httpAssert.present(schema.key_prefix, {
    status: 409,
    message: `Schema '${schemaId}' is missing a key prefix`
  });
  const sequenceNumber = await db.workspace.allocatePublicId(schema.key_prefix, timestamp);
  return formatPublicId(schema.key_prefix, sequenceNumber);
};
export const createEntityWithPayload = async (
  db: DatabaseAdapter,
  workspace: string,
  payload: EntityMutationPayload,
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor
): Promise<EntityRecord> => {
  const lifecycleValues = await getLifecycleValues(db, workspace);
  const lifecycle =
    payload.requestedLifecycle && lifecycleValues.has(payload.requestedLifecycle)
      ? payload.requestedLifecycle
      : null;
  const target_lifecycle =
    payload.requestedTargetLifecycle && lifecycleValues.has(payload.requestedTargetLifecycle)
      ? payload.requestedTargetLifecycle
      : null;
  const target_lifecycle_date = payload.requestedTargetLifecycleDate ?? null;
  const teamIds = await getTeamIds(db, workspace);

  try {
    const [schema, entities, currencyConfig] = await Promise.all([
      db.catalog.getSchema(workspace, payload.schemaId),
      listAllCatalogEntities(db, workspace),
      getSupportedCurrencyCodes(db, workspace)
    ]);
    httpAssert.present(schema, {
      status: 404,
      message: `Schema '${payload.schemaId}' not found`
    });
    const normalizedFields = normalizeEntityRelationFields({
      schema,
      fields: payload.fields,
      entities
    });
    if (currencyConfig) {
      normalizeEntityCurrencyFields(schema.fields, normalizedFields, currencyConfig);
    }
    assertNoDerivedFieldWrites(schema.fields, normalizedFields);
    assertNoExternalEntityFieldWrites(schema.fields, {}, normalizedFields);
    if (authCtx) {
      requireNoRestrictedFieldWrites(
        authCtx,
        schema,
        Object.keys(normalizedFields),
        'You do not have permission to set one or more restricted fields on this entity'
      );
    }
    const entityLookup = new Map(entities.map(entity => [entity.id, entity]));
    const parents = getEntityParentsFromPayload(schema, normalizedFields, entityLookup);
    const fallbackOwner = (await db.workspace.listTeams(workspace))[0]?.id ?? null;
    const owner = resolveCreateOwner(
      payload.requestedOwner,
      parents,
      schema,
      teamIds,
      fallbackOwner
    );

    if (authCtx) {
      if (parents.length > 0) {
        parents.forEach(parent =>
          requireEntityAction(
            authCtx,
            parent,
            'create_child',
            'You do not have permission to add children under one or more parent entities'
          )
        );
      } else {
        requireCanCreateTopLevelEntity(
          authCtx,
          owner,
          'Top-level entity creation requires membership in the resolved owner team or a platform admin role'
        );
      }
    }

    const timestamp = new Date();
    return await withCatalogMutationTransaction(db, async tx => {
      const publicId = await allocateEntityPublicId(tx, workspace, payload.schemaId, timestamp);
      const row = await createEntityWithAudit(tx, {
        workspace,
        actor,
        entity: {
          id: randomUUID(),
          workspace,
          public_id: publicId,
          slug: payload.slug,
          namespace: payload.namespace,
          name: payload.name,
          description: payload.description,
          owner,
          lifecycle,
          target_lifecycle,
          target_lifecycle_date,
          tags: payload.tags,
          links: payload.links,
          schema_id: payload.schemaId,
          data: normalizedFields,
          project_id: payload.projectId,
          created_at: timestamp,
          updated_at: timestamp,
          completeness: computeEntityCompleteness(
            { description: payload.description, owner, lifecycle, data: normalizedFields },
            schema
          )
        }
      });

      const recalculatedAvailable = await recalculateEntityDerivedFields(tx, workspace, [row.id]);
      const recalculated = recalculatedAvailable
        ? ((await tx.catalog.getEntity(workspace, row.id)) ?? row)
        : row;
      const validation = await validateEntityGraph(tx, workspace, [row.id]);
      assertEntityGraphValid(validation);
      return addValidationResult(toApiEntity(recalculated, authCtx, schema), validation);
    });
  } catch (error) {
    return handleError(error, 'Failed to create data record');
  }
};

export const createEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  body: Record<string, unknown>,
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor
): Promise<EntityRecord> => createEntityWithPayload(db, workspace, parseEntityMutationPayload(body), authCtx, actor);

type BulkEntityDraft = {
  payload: ReturnType<typeof parseEntityMutationPayload>;
  schema: SchemaDbResult;
  entity: EntityDbCreate;
};

const canonicalizeBulkRelationFields = (
  fields: Record<string, unknown>,
  schema: SchemaDbResult,
  nameToId: Map<string, string>
) => {
  const normalized = { ...fields };
  for (const field of relationFields(schema.fields)) {
    let value = normalized[field.id];
    if (value == null && normalized[field.name] != null) {
      value = normalized[field.name];
      delete normalized[field.name];
    }

    if (typeof value !== 'string') continue;
    const names = value
      .split(',')
      .map(name => name.trim())
      .filter(Boolean);
    normalized[field.id] = names.map(name => {
      const id = nameToId.get(name.toLowerCase());
      httpAssert.present(id, {
        status: 400,
        message: `${field.name} references unknown batch entity '${name}'`
      });
      return id;
    });
  }
  return normalized;
};

const resolveBulkOwners = (
  drafts: BulkEntityDraft[],
  existingEntities: EntityDbResult[],
  teamIds: Set<string>,
  fallbackOwner: string | null
) => {
  const existingById = new Map(existingEntities.map(entity => [entity.id, entity]));
  const draftById = new Map(drafts.map(draft => [draft.entity.id, draft]));
  const resolving = new Set<string>();

  const resolveOwner = (draft: BulkEntityDraft): string | null => {
    const explicit = draft.payload.requestedOwner;
    if (explicit && teamIds.has(explicit)) return explicit;
    if (draft.entity.owner) return draft.entity.owner;
    if (resolving.has(draft.entity.id)) {
      return draft.schema.default_owner && teamIds.has(draft.schema.default_owner)
        ? draft.schema.default_owner
        : fallbackOwner;
    }

    resolving.add(draft.entity.id);
    const parentIds = relationFields(draft.schema.fields)
      .filter(field => field.type === 'containment')
      .flatMap(field => {
        const value = draft.entity.data[field.id];
        return Array.isArray(value)
          ? value.filter((id): id is string => typeof id === 'string')
          : [];
      });
    for (const parentId of parentIds) {
      const parent = existingById.get(parentId);
      const owner =
        parent?.owner ?? (draftById.get(parentId) ? resolveOwner(draftById.get(parentId)!) : null);
      if (owner && teamIds.has(owner)) {
        draft.entity.owner = owner;
        resolving.delete(draft.entity.id);
        return owner;
      }
    }
    resolving.delete(draft.entity.id);
    const owner =
      draft.schema.default_owner && teamIds.has(draft.schema.default_owner)
        ? draft.schema.default_owner
        : fallbackOwner && teamIds.has(fallbackOwner)
          ? fallbackOwner
          : null;
    draft.entity.owner = owner;
    return owner;
  };

  drafts.forEach(resolveOwner);
};

export const bulkCreateEntitiesWithPayloads = async (
  db: DatabaseAdapter,
  workspace: string,
  payloads: EntityMutationPayload[],
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor
): Promise<EntityRecord[]> => {
  try {
    return await db.core.transaction(async tx => {
      const nameToId = new Map<string, string>();
      for (const payload of payloads) {
        const key = payload.name.trim().toLowerCase();
        httpAssert.string(key, { message: '_name is required' });
        httpAssert.true(!nameToId.has(key), {
          status: 400,
          message: `Duplicate batch entity name '${payload.name}'`
        });
        nameToId.set(key, randomUUID());
      }

      const [schemas, existingEntities, lifecycleValues, teamRows] = await Promise.all([
        tx.catalog.listSchemas(workspace),
        listAllCatalogEntities(tx, workspace),
        getLifecycleValues(tx, workspace),
        tx.workspace.listTeams(workspace)
      ]);
      const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
      const teamIds = new Set(teamRows.map(team => team.id));
      const fallbackOwner = teamRows[0]?.id ?? null;
      const timestamp = new Date();

      const drafts: BulkEntityDraft[] = payloads.map(payload => {
        const schema = schemaById.get(payload.schemaId);
        httpAssert.present(schema, {
          status: 404,
          message: `Schema '${payload.schemaId}' not found`
        });
        const lifecycle =
          payload.requestedLifecycle && lifecycleValues.has(payload.requestedLifecycle)
            ? payload.requestedLifecycle
            : null;
        const targetLifecycle =
          payload.requestedTargetLifecycle && lifecycleValues.has(payload.requestedTargetLifecycle)
            ? payload.requestedTargetLifecycle
            : null;
        return {
          payload,
          schema,
          entity: {
            id: nameToId.get(payload.name.trim().toLowerCase())!,
            workspace,
            public_id: '',
            slug: payload.slug,
            namespace: payload.namespace,
            name: payload.name,
            description: payload.description,
            owner: null,
            lifecycle,
            target_lifecycle: targetLifecycle,
            target_lifecycle_date: payload.requestedTargetLifecycleDate,
            tags: payload.tags,
            links: payload.links,
            schema_id: payload.schemaId,
            data: canonicalizeBulkRelationFields(payload.fields, schema, nameToId),
            project_id: payload.projectId,
            created_at: timestamp,
            updated_at: timestamp,
            // Placeholder — recomputed below once owner resolution and relation-field
            // normalization (which run after this draft is built) have settled.
            completeness: 0
          }
        };
      });

      resolveBulkOwners(drafts, existingEntities, teamIds, fallbackOwner);
      const allEntities: Entity[] = [...existingEntities, ...drafts.map(draft => draft.entity)];
      const entityLookup = new Map(allEntities.map(entity => [entity.id, entity]));

      for (const draft of drafts) {
        draft.entity.data = normalizeEntityRelationFields({
          schema: draft.schema,
          fields: draft.entity.data,
          entities: allEntities
        });
        assertNoDerivedFieldWrites(draft.schema.fields, draft.entity.data);
        assertNoExternalEntityFieldWrites(draft.schema.fields, {}, draft.entity.data);
        const parents = getEntityParentsFromPayload(draft.schema, draft.entity.data, entityLookup);
        if (authCtx) {
          requireNoRestrictedFieldWrites(
            authCtx,
            draft.schema,
            Object.keys(draft.entity.data),
            'You do not have permission to set one or more restricted fields on this entity'
          );
          if (parents.length > 0) {
            parents.forEach(parent =>
              requireEntityAction(
                authCtx,
                parent,
                'create_child',
                'You do not have permission to add children under one or more parent entities'
              )
            );
          } else {
            requireCanCreateTopLevelEntity(
              authCtx,
              draft.entity.owner,
              'Top-level entity creation requires membership in the resolved owner team or a platform admin role'
            );
          }
        }
      }

      for (const draft of drafts) {
        draft.entity.public_id = await allocateEntityPublicId(
          tx,
          workspace,
          draft.entity.schema_id,
          timestamp
        );
      }

      const created: EntityRecord[] = [];
      const createdRows: Array<{ id: string; schema: BulkEntityDraft['schema'] }> = [];
      for (const draft of drafts) {
        draft.entity.completeness = computeEntityCompleteness(draft.entity, draft.schema);
        const row = await createEntityWithAudit(tx, {
          workspace,
          actor,
          entity: draft.entity
        });
        created.push(toApiEntity(row, authCtx, draft.schema));
        createdRows.push({ id: row.id, schema: draft.schema });
      }
      const recalculatedAvailable = await recalculateEntityDerivedFields(tx, workspace);
      const validation = await validateEntityGraph(
        tx,
        workspace,
        createdRows.map(createdRow => createdRow.id)
      );
      assertEntityGraphValid(validation);
      return Promise.all(
        createdRows.map(async ({ id, schema }, index) => {
          const row = recalculatedAvailable ? await tx.catalog.getEntity(workspace, id) : null;
          return row
            ? addValidationResult(toApiEntity(row, authCtx, schema), validation)
            : created[index]!;
        })
      );
    });
  } catch (error) {
    return handleError(error, 'Failed to create data records');
  }
};

export const bulkCreateEntities = async (
  db: DatabaseAdapter,
  workspace: string,
  bodies: Record<string, unknown>[],
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor
): Promise<EntityRecord[]> =>
  bulkCreateEntitiesWithPayloads(
    db,
    workspace,
    bodies.map(parseEntityMutationPayload),
    authCtx,
    actor
  );

export const updateEntityWithPayload = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  payload: EntityMutationPayload,
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor,
  versionOptions?: {
    versionKind?: EntityVersionKind;
    appliedCaseRevisionId?: string | null;
    projectId?: string;
  }
): Promise<EntityRecord> => {
  const lifecycleValues = await getLifecycleValues(db, workspace);
  const lifecycle =
    payload.requestedLifecycle && lifecycleValues.has(payload.requestedLifecycle)
      ? payload.requestedLifecycle
      : null;
  const target_lifecycle =
    payload.requestedTargetLifecycle && lifecycleValues.has(payload.requestedTargetLifecycle)
      ? payload.requestedTargetLifecycle
      : null;
  const target_lifecycle_date = payload.requestedTargetLifecycleDate ?? null;
  const teamIds = await getTeamIds(db, workspace);
  const owner =
    payload.requestedOwner && teamIds.has(payload.requestedOwner) ? payload.requestedOwner : null;

  try {
    return await db.core.transaction(async tx => {
      const [oldRow, schema, globalEntities, projectEntities] = await Promise.all([
        tx.catalog.getEntity(workspace, id),
        tx.catalog.getSchema(workspace, payload.schemaId),
        listAllCatalogEntities(tx, workspace),
        versionOptions?.projectId
          ? listAllCatalogEntities(tx, workspace, {
              projectId: versionOptions.projectId,
              projectScope: 'project'
            })
          : Promise.resolve([])
      ]);
      const entities = [
        ...new Map(
          [...globalEntities, ...projectEntities].map(entity => [entity.id, entity])
        ).values()
      ];
      httpAssert.present(oldRow, { status: 404, message: `Data record '${id}' not found` });
      httpAssert.present(schema, {
        status: 404,
        message: `Schema '${payload.schemaId}' not found`
      });
      httpAssert.true(!(await entityRequiresApproval(tx, workspace, schema, oldRow)), {
        status: 409,
        statusText: 'Conflict',
        message: 'This entity requires an approved change proposal before it can be edited'
      });
      if (authCtx) {
        if (payload.external) {
          requireEntityAction(
            authCtx,
            oldRow,
            'view_entity',
            'You do not have permission to view this entity'
          );
          requireWorkspaceCapability(
            authCtx,
            'ent.external_update',
            'You do not have permission to perform external updates on entities'
          );
        } else {
          requireEntityAction(
            authCtx,
            oldRow,
            'edit_entity',
            'You do not have permission to edit this entity'
          );
        }
      }
      const isCasePromotion =
        versionOptions?.versionKind === 'case_applied' &&
        versionOptions.projectId != null &&
        oldRow.project_id === versionOptions.projectId &&
        payload.projectId == null;
      if (
        authCtx &&
        (owner !== oldRow.owner || (payload.projectId !== oldRow.project_id && !isCasePromotion))
      ) {
        requireEntityAction(
          authCtx,
          oldRow,
          'admin_entity',
          'You do not have permission to change ownership or project assignment'
        );
      }

      const normalizedFields = normalizeEntityRelationFields({
        schema,
        fields: payload.fields,
        entities
      });
      const currencyConfig = await getSupportedCurrencyCodes(tx, workspace);
      if (currencyConfig) {
        normalizeEntityCurrencyFields(schema.fields, normalizedFields, currencyConfig);
      }
      assertNoDerivedFieldWrites(schema.fields, normalizedFields);
      if (authCtx) {
        const changedFieldIds = Object.keys(normalizedFields).filter(
          fieldId => !equalEntityValue(oldRow.data[fieldId], normalizedFields[fieldId])
        );
        requireNoRestrictedFieldWrites(
          authCtx,
          schema,
          changedFieldIds,
          'You do not have permission to edit one or more restricted fields on this entity'
        );
      }

      const timestamp = new Date();
      let nextGeneratedMetadata: ExternalMetadata | undefined;
      let auditMetadata: Record<string, unknown> | undefined;
      if (payload.external) {
        assertValidExternalUpdateTarget(
          schema.fields,
          payload.external,
          oldRow.data,
          normalizedFields
        );
        assertExternalUpdateOnlyChangesTarget(
          payload.external.fieldId,
          oldRow.data,
          normalizedFields
        );
        httpAssert.true(payload.schemaId === oldRow.schema_id, {
          status: 400,
          message: 'An external update cannot change the entity schema'
        });
        httpAssert.true(payload.name === oldRow.name, {
          status: 400,
          message: 'An external update cannot change the entity name'
        });
        httpAssert.true(payload.slug === oldRow.slug, {
          status: 400,
          message: 'An external update cannot change the entity slug'
        });
        httpAssert.true(payload.namespace === oldRow.namespace, {
          status: 400,
          message: 'An external update cannot change the entity namespace'
        });
        httpAssert.true(payload.description === oldRow.description, {
          status: 400,
          message: 'An external update cannot change the entity description'
        });
        httpAssert.true(payload.requestedOwner === oldRow.owner, {
          status: 400,
          message: 'An external update cannot change the entity owner'
        });
        httpAssert.true(payload.requestedLifecycle === oldRow.lifecycle, {
          status: 400,
          message: 'An external update cannot change the entity lifecycle'
        });
        httpAssert.true(payload.requestedTargetLifecycle === oldRow.target_lifecycle, {
          status: 400,
          message: 'An external update cannot change the target lifecycle'
        });
        httpAssert.true(payload.requestedTargetLifecycleDate === oldRow.target_lifecycle_date, {
          status: 400,
          message: 'An external update cannot change the target lifecycle date'
        });
        httpAssert.true(JSON.stringify(payload.tags) === JSON.stringify(oldRow.tags), {
          status: 400,
          message: 'An external update cannot change entity tags'
        });
        httpAssert.true(JSON.stringify(payload.links) === JSON.stringify(oldRow.links), {
          status: 400,
          message: 'An external update cannot change entity links'
        });
        httpAssert.true(payload.projectId === oldRow.project_id, {
          status: 400,
          message: 'An external update cannot change entity project assignment'
        });
        nextGeneratedMetadata = {
          ...(oldRow.generated_metadata ?? {}),
          [payload.external.fieldId]: applyExternalFieldUpdate(
            payload.external.fieldId,
            payload.external,
            timestamp
          )
        };
        auditMetadata = {
          external_kind: payload.external.kind,
          external_field_id: payload.external.fieldId,
          source: payload.external.source,
          status: payload.external.status,
          requestId: payload.external.requestId ?? null,
          explanation: payload.external.explanation ?? null,
          failureNotice: payload.external.failureNotice ?? null
        };
      } else {
        assertNoExternalEntityFieldWrites(schema.fields, oldRow.data, normalizedFields);
      }

      if (Object.keys(payload.relations).length > 0) {
        const typedRelationFieldById = new Map(
          schema.fields.filter(isTypedRelationField).map(field => [field.id, field])
        );
        for (const [fieldId, delta] of Object.entries(payload.relations)) {
          const field = typedRelationFieldById.get(fieldId);
          httpAssert.present(field, {
            status: 400,
            message: `'${fieldId}' is not a typedRelation field on schema '${schema.name}'`
          });
          await applyRelationFieldDelta(tx, {
            workspace,
            ownerEntityId: oldRow.id,
            ownerSchema: schema,
            field,
            delta,
            authCtx,
            actor
          });
        }
      }

      const row = await updateEntityWithAudit(tx, {
        workspace,
        entityId: oldRow.id,
        previous: oldRow,
        actor,
        auditMetadata,
        next: {
          slug: payload.slug,
          namespace: payload.namespace,
          name: payload.name,
          description: payload.description,
          owner,
          lifecycle,
          target_lifecycle,
          target_lifecycle_date,
          tags: payload.tags,
          links: payload.links,
          schema_id: payload.schemaId,
          data: normalizedFields,
          project_id: payload.projectId,
          updated_at: timestamp,
          completeness: computeEntityCompleteness(
            { description: payload.description, owner, lifecycle, data: normalizedFields },
            schema
          ),
          ...(nextGeneratedMetadata !== undefined
            ? { generated_metadata: nextGeneratedMetadata }
            : {})
        },
        versionKind: versionOptions?.versionKind,
        appliedCaseRevisionId: versionOptions?.appliedCaseRevisionId
      });

      httpAssert.present(row, { status: 404, message: `Data record '${id}' not found` });
      const recalculatedAvailable = await recalculateEntityDerivedFields(tx, workspace);
      const recalculated = recalculatedAvailable
        ? ((await tx.catalog.getEntity(workspace, id)) ?? row)
        : row;
      const validation = await validateEntityGraph(tx, workspace, [id]);
      assertEntityGraphValid(validation);
      return addValidationResult(toApiEntity(recalculated, authCtx, schema), validation);
    });
  } catch (error) {
    return handleError(error, 'Failed to update data record');
  }
};

export const updateEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: Record<string, unknown>,
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor,
  versionOptions?: {
    versionKind?: EntityVersionKind;
    appliedCaseRevisionId?: string | null;
    projectId?: string;
  }
): Promise<EntityRecord> =>
  updateEntityWithPayload(
    db,
    workspace,
    id,
    parseEntityMutationPayload(body),
    authCtx,
    actor,
    versionOptions
  );

export const cloneEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor
): Promise<EntityRecord> => {
  try {
    return await withCatalogMutationTransaction(db, async tx => {
      const source = await tx.catalog.getEntity(workspace, id);
      httpAssert.present(source, { status: 404, message: `Data record '${id}' not found` });
      const schema = await tx.catalog.getSchema(workspace, source.schema_id);
      httpAssert.present(schema, {
        status: 404,
        message: `Schema '${source.schema_id}' not found`
      });
      if (authCtx)
        requireEntityAction(
          authCtx,
          source,
          'create_child',
          'You do not have permission to clone this entity'
        );

      const baseName = source.name ? `${source.name} (copy)` : source.slug;
      const baseSlug = slugify(baseName);
      const timestamp = new Date();
      const publicId = await allocateEntityPublicId(tx, workspace, source.schema_id, timestamp);
      const row = await createEntityWithAudit(tx, {
        workspace,
        actor,
        entity: {
          id: randomUUID(),
          workspace,
          public_id: publicId,
          slug: baseSlug,
          namespace: source.namespace,
          name: baseName,
          description: source.description,
          owner: source.owner,
          lifecycle: source.lifecycle,
          target_lifecycle: source.target_lifecycle,
          target_lifecycle_date: source.target_lifecycle_date,
          tags: source.tags,
          links: source.links,
          schema_id: source.schema_id,
          data: source.data,
          project_id: source.project_id,
          created_at: timestamp,
          updated_at: timestamp,
          completeness: source.completeness
        }
      });

      const recalculatedAvailable = await recalculateEntityDerivedFields(tx, workspace, [row.id]);
      const recalculated = recalculatedAvailable
        ? ((await tx.catalog.getEntity(workspace, row.id)) ?? row)
        : row;
      const validation = await validateEntityGraph(tx, workspace, [row.id]);
      assertEntityGraphValid(validation);
      return addValidationResult(toApiEntity(recalculated, authCtx, schema), validation);
    });
  } catch (error) {
    return handleError(error, 'Failed to clone data record');
  }
};

export const deleteEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor
): Promise<{ success: boolean; message: string }> => {
  try {
    return await db.core.transaction(async tx => {
      const row = await tx.catalog.getEntity(workspace, id);
      httpAssert.present(row, { status: 404, message: `Data record '${id}' not found` });
      if (authCtx)
        requireEntityAction(
          authCtx,
          row,
          'admin_entity',
          'You do not have permission to delete this entity'
        );

      const watcherUserIds = await tx.watch.listWatcherUserIds(workspace, row.id);
      await tx.catalog.deleteEntity(workspace, row.id);
      await recalculateEntityDerivedFields(tx, workspace);

      const existingVersions = await tx.catalog.listEntityVersions(workspace, row.id);
      const nextVersionNumber =
        existingVersions.reduce((max, v) => Math.max(max, v.version_number), 0) + 1;
      await tx.catalog.createEntityVersion({
        id: randomUUID(),
        workspace,
        record_id: row.id,
        version_number: nextVersionNumber,
        kind: 'deleted',
        commit_message: null,
        created_at: new Date(),
        created_by: actor.id,
        state: entityToBaseState(row),
        applied_case_revision_id: null
      });

      await logAudit(tx, {
        workspace,
        userId: actor.id,
        userDisplayName: actor.displayName,
        watcherUserIds,
        operation: 'delete',
        entityType: 'entity',
        entityId: row.id,
        entityName: row.name,
        entitySlug: row.slug,
        schemaId: row.schema_id,
        changes: { old: flattenEntityAuditFields(row) }
      });

      return { success: true, message: `Data record '${id}' deleted` };
    });
  } catch (error) {
    return handleError(error, 'Failed to delete data record');
  }
};
