import { randomUUID } from 'node:crypto';
import type { EntityGrantDbCretae, DatabaseAdapter } from '../../db/database';
import { decodeRefs } from '../../types';
import { Entity, type SchemaDbResult as InternalEntitySchema } from './db/catalogDatabase';
import type { EntityDbResult } from './db/catalogDatabase';
import { handleDbError, slugify } from '../../utils/http';
import { httpAssert } from '../../utils/httpAssert';
import { ContainmentField, SchemaField } from '@arch-register/api-types/schemaContract';
import { EntityLink } from '@arch-register/api-types/entityContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';

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

export const matchesFilterCondition = (
  entity: EntityDbResult,
  condition: FilterCondition,
  completeness: number | null
): boolean => {
  if (condition.fieldId === '_tags') {
    const tags = entity.tags;
    if (condition.op === 'empty') return tags.length === 0;
    if (condition.op === 'not_empty') return tags.length > 0;
    const expected = String(condition.value ?? '');
    switch (condition.op) {
      case 'equals': return tags.some(t => t === expected);
      case 'not_equals': return !tags.some(t => t === expected);
      case 'contains': return tags.some(t => t.toLowerCase().includes(expected.toLowerCase()));
      default: return true;
    }
  }

  let value: unknown;
  switch (condition.fieldId) {
    case '_schemaId': value = entity.schema_id; break;
    case '_lifecycle': value = entity.lifecycle; break;
    case '_owner': value = entity.owner; break;
    case '_name': value = entity.name; break;
    case '_slug': value = entity.slug; break;
    case '_description': value = entity.description; break;
    case '_namespace': value = entity.namespace; break;
    case '_completeness': value = completeness; break;
    case '_updatedAt': value = entity.updated_at; break;
    default: value = entity.data[condition.fieldId];
  }

  if (condition.op === 'empty') return value == null || value === '';
  if (condition.op === 'not_empty') return value != null && value !== '';
  if (value == null) return false;

  const expected = condition.value;
  switch (condition.op) {
    case 'equals': return String(value) === String(expected);
    case 'not_equals': return String(value) !== String(expected);
    case 'contains': return String(value).toLowerCase().includes(String(expected).toLowerCase());
    case 'starts_with': return String(value).toLowerCase().startsWith(String(expected).toLowerCase());
    case 'ends_with': return String(value).toLowerCase().endsWith(String(expected).toLowerCase());
    case 'gt': return Number(value) > Number(expected);
    case 'lt': return Number(value) < Number(expected);
    case 'gte': return Number(value) >= Number(expected);
    case 'lte': return Number(value) <= Number(expected);
    case 'before': {
      const valueTime = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
      const expectedTime = new Date(String(expected)).getTime();
      return !Number.isNaN(valueTime) && !Number.isNaN(expectedTime) && valueTime < expectedTime;
    }
    default: return true;
  }
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
  publicId: string;
  entitySlug: string;
  entityName: string;
  entitySchemaId: string;
  fieldName: string;
  fieldPredicate?: string;
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

export const relationFields = (fields: SchemaField[]) =>
  fields.filter(
    (field): field is Extract<SchemaField, { type: 'reference' | 'containment' }> =>
      field.type === 'reference' || field.type === 'containment'
  );

const normalizeRelationIds = (value: unknown, field: Extract<SchemaField, { type: 'reference' | 'containment' }>) => {
  httpAssert.true(Array.isArray(value), {
    message: `${field.name} must be provided as an array of entity ids`
  });

  const rawValues = Array.isArray(value) ? value : [];
  const ids = rawValues
    .map((item: unknown) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);

  httpAssert.true(ids.length === rawValues.length, {
    message: `${field.name} must contain only non-empty string ids`
  });

  return ids;
};

const validateContainmentField = (field: ContainmentField) => {
  httpAssert.true(field.maxCount === 1, {
    message: `${field.name} containment fields must have maxCount set to 1`
  });
  httpAssert.true(field.minCount === 0 || field.minCount === 1, {
    message: `${field.name} containment fields must have minCount set to 0 or 1`
  });
};

export const normalizeEntityRelationFields = ({
  schema,
  fields,
  entities
}: {
  schema: InternalEntitySchema;
  fields: Record<string, unknown>;
  entities: Entity[];
}) => {
  const entityLookup = new Map(entities.map(entity => [entity.id, entity]));
  const normalizedFields = { ...fields };

  for (const field of relationFields(schema.fields)) {
    if (field.type === 'containment') validateContainmentField(field);

    const rawValue = normalizedFields[field.id];
    const ids =
      rawValue == null || rawValue === ''
        ? []
        : normalizeRelationIds(rawValue, field);

    httpAssert.true(ids.length >= field.minCount, {
      message: `${field.name} requires at least ${field.minCount} relation(s)`
    });
    httpAssert.true(field.maxCount === -1 || ids.length <= field.maxCount, {
      message: `${field.name} allows at most ${field.maxCount} relation(s)`
    });

    for (const id of ids) {
      const target = entityLookup.get(id);
      httpAssert.present(target, {
        status: 400,
        message: `${field.name} references unknown entity '${id}'`
      });
      httpAssert.true(target.workspace === schema.workspace, {
        message: `${field.name} references an entity in a different workspace`
      });
      httpAssert.true(target.schema_id === field.schemaId, {
        message: `${field.name} must reference entities of schema '${field.schemaId}'`
      });
    }

    normalizedFields[field.id] = ids;
  }

  return normalizedFields;
};

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
      return decodeRefs(raw);
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
        publicId: target.public_id ?? refId,
        entitySlug: target.slug ?? refId,
        entityName: target.name ?? target.slug ?? refId,
        entitySchemaId: target.schema_id,
        fieldName: field.name,
        fieldPredicate: field.predicate,
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
        publicId: row.public_id ?? row.id,
        entitySlug: row.slug,
        entityName: row.name || row.slug,
        entitySchemaId: row.schema_id,
        fieldName: field.name,
        fieldPredicate: field.predicate,
        kind: field.type
      });
    }
  }

  return { outgoing, incoming };
};

export type DependentRecord = RelationRecord & {
  schemaName: string;
  lifecycleState: string | null;
  depth: number;
  viaPath: Array<{ entityId: string; entityName: string }>;
};

export type DependentsResponse = {
  dependents: DependentRecord[];
  truncated: boolean;
};

const MAX_DEPENDENTS_NODES = 500;

export const buildEntityDependents = (
  entityId: string,
  entities: Entity[],
  schemas: InternalEntitySchema[],
  options: { transitive: boolean; maxDepth?: number }
): DependentsResponse => {
  const maxDepth = options.maxDepth ?? 5;
  const schemaMap = new Map(schemas.map(s => [s.id, s]));
  const entityMap = new Map(entities.map(e => [e.id, e]));

  // Build inverse index: for each entity id, which entities reference it
  const incomingIndex = new Map<string, Array<{ entity: Entity; fieldName: string; fieldPredicate?: string; kind: 'reference' | 'containment' }>>();
  for (const entity of entities) {
    const schema = schemaMap.get(entity.schema_id);
    if (!schema) continue;
    for (const field of relationFields(schema.fields)) {
      for (const refId of decodeRefs(entity.data[field.id])) {
        if (!incomingIndex.has(refId)) incomingIndex.set(refId, []);
        incomingIndex.get(refId)!.push({ entity, fieldName: field.name, fieldPredicate: field.predicate, kind: field.type });
      }
    }
  }

  const visited = new Set<string>([entityId]);
  const dependents: DependentRecord[] = [];
  let truncated = false;

  // BFS queue entries: [id, depth, viaPath]
  type QueueEntry = [string, number, Array<{ entityId: string; entityName: string }>];
  const queue: QueueEntry[] = [[entityId, 0, []]];

  while (queue.length > 0) {
    const [currentId, depth, viaPath] = queue.shift()!;
    if (depth >= maxDepth) {
      truncated = true;
      continue;
    }

    for (const { entity, fieldName, fieldPredicate, kind } of incomingIndex.get(currentId) ?? []) {
      if (visited.has(entity.id)) continue;
      visited.add(entity.id);

      if (dependents.length >= MAX_DEPENDENTS_NODES) {
        truncated = true;
        continue;
      }

      const schema = schemaMap.get(entity.schema_id);
      dependents.push({
        entityId: entity.id,
        publicId: entity.public_id ?? entity.id,
        entitySlug: entity.slug ?? entity.id,
        entityName: entity.name || entity.slug || entity.id,
        entitySchemaId: entity.schema_id,
        schemaName: schema?.name ?? entity.schema_id,
        lifecycleState: entity.lifecycle ?? null,
        fieldName,
        fieldPredicate,
        kind,
        depth: depth + 1,
        viaPath
      });

      if (options.transitive) {
        const currentEntity = entityMap.get(currentId);
        queue.push([
          entity.id,
          depth + 1,
          [...viaPath, { entityId: currentId, entityName: currentEntity?.name || currentEntity?.slug || currentId }]
        ]);
      }
    }
  }

  return { dependents, truncated };
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
