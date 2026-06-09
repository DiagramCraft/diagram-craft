import { randomUUID } from 'node:crypto';
import type { EntityGrantDbCretae, DatabaseAdapter } from '../../db/database';
import { decodeRefs, type EntityLink, type SchemaField } from '../../types';
import { Entity, type SchemaDbResult as InternalEntitySchema } from './db/catalogDatabase';
import type { EntityDbResult } from './db/catalogDatabase';
import { handleDbError, slugify } from '../../utils/http';
import { httpAssert } from '../../utils/httpAssert';

export const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, {
    foreign: '_schemaId references a schema that does not exist',
    unique:
      'An entity with that slug already exists in this namespace for the given schema in this workspace'
  });

export const getLifecycleValues = async (
  db: DatabaseAdapter,
  workspace: string
): Promise<Set<string>> =>
  new Set((await db.workspace.listLifecycleStates(workspace)).map(r => r.id));

export const getTeamIds = async (db: DatabaseAdapter, workspace: string): Promise<Set<string>> =>
  new Set((await db.workspace.listTeams(workspace)).map(r => r.id));

const includesQuery = (value: unknown, query: string) =>
  String(value ?? '')
    .toLowerCase()
    .includes(query);

const entityMatchesPattern = (entity: Entity, pattern: string) => {
  const query = pattern.toLowerCase();
  return (
    includesQuery(entity.name, query) ||
    includesQuery(entity.slug, query) ||
    includesQuery(entity.description, query) ||
    includesQuery(entity.owner, query) ||
    entity.tags.some(tag => includesQuery(tag, query))
  );
};

export const filterEntities = (
  entities: EntityDbResult[],
  options: {
    schemaId: string | null;
    owner: string | null;
    lifecycle: string | null;
    q: string;
  }
) => {
  const trimmed = options.q.trim();
  return entities.filter(entity => {
    if (options.schemaId && entity.schema_id !== options.schemaId) return false;
    if (options.owner && entity.owner !== options.owner) return false;
    if (options.lifecycle && entity.lifecycle !== options.lifecycle) return false;
    if (trimmed && !entityMatchesPattern(entity, trimmed)) return false;
    return true;
  });
};

export type RelationRecord = {
  entityId: string;
  entitySlug: string;
  entityName: string;
  entitySchemaId: string;
  fieldName: string;
  kind: 'reference' | 'containment';
};

export type RelationsResponse = {
  outgoing: RelationRecord[];
  incoming: RelationRecord[];
};

export type EntityMutationPayload = {
  schemaId: string;
  name: string;
  slug: string;
  namespace: string;
  description: string;
  requestedOwner: string | null;
  requestedLifecycle: string | null;
  requestedTargetLifecycle: string | null;
  requestedTargetLifecycleDate: string | null;
  tags: string[];
  links: EntityLink[];
  visibilityMode: 'public' | 'restricted' | null;
  fields: Record<string, unknown>;
};

const relationFields = (fields: SchemaField[]) =>
  fields.filter(
    (field): field is Extract<SchemaField, { type: 'reference' | 'containment' }> =>
      field.type === 'reference' || field.type === 'containment'
  );

const extractId = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (
    value != null &&
    typeof value === 'object' &&
    'id' in value &&
    typeof (value as Record<string, unknown>)['id'] === 'string'
  ) {
    return (value as Record<string, unknown>)['id'] as string;
  }
  return null;
};

export const parseEntityMutationPayload = (
  body: Record<string, unknown>
): EntityMutationPayload => {
  const {
    _schemaId,
    _schema,
    _name,
    _slug,
    _namespace = 'default',
    _description = '',
    _owner = null,
    _lifecycle = null,
    _targetLifecycle = null,
    _targetLifecycleDate = null,
    _tags = [],
    _links = [],
    _visibilityMode,
    ...fields
  } = body;

  const resolvedSchemaId = extractId(_schemaId) ?? extractId(_schema);
  httpAssert.string(resolvedSchemaId, {
    message: '_schemaId is required and must be a string (UUID)'
  });

  const name =
    typeof _name === 'string' ? _name : typeof fields['name'] === 'string' ? fields['name'] : '';
  delete fields['name'];

  const slug = typeof _slug === 'string' && _slug ? _slug : slugify(name);
  httpAssert.present(slug, {
    message: '_slug (or a _name to derive it from) is required'
  });

  return {
    schemaId: resolvedSchemaId,
    name,
    slug,
    namespace: typeof _namespace === 'string' ? _namespace : 'default',
    description: typeof _description === 'string' ? _description : '',
    requestedOwner: extractId(_owner),
    requestedLifecycle: extractId(_lifecycle),
    requestedTargetLifecycle: extractId(_targetLifecycle),
    requestedTargetLifecycleDate:
      typeof _targetLifecycleDate === 'string' ? _targetLifecycleDate : null,
    tags: Array.isArray(_tags) ? _tags.filter((t): t is string => typeof t === 'string') : [],
    links: Array.isArray(_links) ? (_links as EntityLink[]) : [],
    visibilityMode:
      _visibilityMode === 'public' || _visibilityMode === 'restricted' ? _visibilityMode : null,
    fields
  };
};

export const resolveCreateOwner = (
  explicitOwner: string | null,
  parentEntities: Entity[],
  schema: InternalEntitySchema,
  teamIds: Set<string>,
  fallbackOwner: string | null
) => {
  if (explicitOwner && teamIds.has(explicitOwner)) return explicitOwner;
  const inheritedOwner =
    parentEntities.find(parent => parent.owner && teamIds.has(parent.owner))?.owner ?? null;
  if (inheritedOwner) return inheritedOwner;
  if (schema.default_owner && teamIds.has(schema.default_owner)) return schema.default_owner;
  if (fallbackOwner && teamIds.has(fallbackOwner)) return fallbackOwner;
  return null;
};

export const getEntityParentsFromPayload = (
  schema: InternalEntitySchema,
  payload: Record<string, unknown>,
  entityLookup: Map<string, Entity>
) => {
  const parentIds = schema.fields
    .filter(
      (field): field is Extract<InternalEntitySchema['fields'][number], { type: 'containment' }> =>
        field.type === 'containment'
    )
    .flatMap(field => {
      const raw = payload[field.id];
      if (raw == null || raw === '') return [];
      return String(raw)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    });
  return parentIds
    .map(parentId => entityLookup.get(parentId))
    .filter((entity): entity is Entity => entity != null);
};

export const buildEntityRelations = (
  entity: Entity,
  schemas: InternalEntitySchema[],
  entities: Entity[]
): RelationsResponse => {
  const schemaMap = new Map(schemas.map(schema => [schema.id, schema]));
  const entitySchema = schemaMap.get(entity.schema_id);
  const outgoingFields = relationFields(entitySchema?.fields ?? []);
  const entityLookup = new Map(entities.map(row => [row.id, row]));
  const outgoing: RelationRecord[] = [];
  for (const field of outgoingFields) {
    for (const refId of decodeRefs(entity.data[field.id])) {
      const target = entityLookup.get(refId);
      if (!target) continue;
      outgoing.push({
        entityId: refId,
        entitySlug: target.slug ?? refId,
        entityName: target.name ?? target.slug ?? refId,
        entitySchemaId: target.schema_id ?? field.schemaId,
        fieldName: field.name,
        kind: field.type
      });
    }
  }

  const incoming: RelationRecord[] = [];
  for (const row of entities) {
    if (row.id === entity.id) continue;
    const rowSchema = schemaMap.get(row.schema_id);
    if (!rowSchema) continue;
    for (const field of relationFields(rowSchema.fields)) {
      if (!decodeRefs(row.data[field.id]).includes(entity.id)) continue;
      incoming.push({
        entityId: row.id,
        entitySlug: row.slug,
        entityName: row.name || row.slug,
        entitySchemaId: row.schema_id,
        fieldName: field.name,
        kind: field.type
      });
    }
  }

  return { outgoing, incoming };
};

export const buildEntityGrantInputs = (
  workspace: string,
  entityId: string,
  grants: unknown[],
  createdAt: Date,
  idFactory: () => string = randomUUID
): EntityGrantDbCretae[] =>
  grants.map(grant => {
    httpAssert.json(grant, { message: 'Each grant must be an object' });
    const typed = grant as Record<string, unknown>;
    httpAssert.true(typed['principal_type'] === 'user' || typed['principal_type'] === 'team', {
      message: 'principal_type must be user or team'
    });
    httpAssert.string(typed['principal_id'], {
      message: 'principal_id must be a non-empty string'
    });
    httpAssert.true(
      ['viewer', 'editor', 'contributor', 'entity_admin'].includes(String(typed['role'])),
      {
        message: 'role must be viewer, editor, contributor, or entity_admin'
      }
    );
    httpAssert.true(['self', 'subtree'].includes(String(typed['applies_to'])), {
      message: 'applies_to must be self or subtree'
    });
    return {
      id: idFactory(),
      workspace,
      entity_id: entityId,
      principal_type: typed['principal_type'] as 'user' | 'team',
      principal_id: typed['principal_id'] as string,
      role: typed['role'] as 'viewer' | 'editor' | 'contributor' | 'entity_admin',
      applies_to: typed['applies_to'] as 'self' | 'subtree',
      created_at: createdAt
    };
  });
