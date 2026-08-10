import type { AuthorizationContext } from '@arch-register/permissions';
import type { MetricConfig, MetricTraversalStep } from '@arch-register/api-types/metricContract';
import { decodeRefs } from '../../types';
import { isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import {
  canViewTypedRelation,
  canViewTypedRelationFromEndpoint
} from '../catalog/relationAccessControl';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { RelationDbResult, RelationSchemaDbResult } from '../catalog/db/relationDatabase';
import type { DatabaseAdapter } from '../../db/database';
import { buildContainmentChildrenIndex, collectDescendantIds } from './metricDescendants';

const MAX_TRAVERSAL_RESULTS = 5000;

export type MetricTerminal =
  | { kind: 'entity'; entity: EntityDbResult }
  | { kind: 'relation'; relation: RelationDbResult; schema: RelationSchemaDbResult };

export type MetricTraversalResult = {
  terminals: MetricTerminal[];
  duplicateCount: number;
};

type EntityOccurrence = {
  entity: EntityDbResult;
  lastRelation: RelationDbResult | null;
};

const relationField = (
  schema: SchemaDbResult | undefined,
  fieldId: string,
  ownerSchemaId?: string
) => {
  if (!schema || (ownerSchemaId != null && schema.id !== ownerSchemaId)) return undefined;
  return schema.fields.find(field => field.id === fieldId);
};

const validEntityRelationField = (
  schemas: SchemaDbResult[],
  schemaId: string,
  step: Extract<MetricTraversalStep, { kind: 'relation' }>
) => {
  const schema = schemas.find(candidate => candidate.id === schemaId);
  const field = relationField(
    schema,
    step.fieldId,
    step.direction === 'backward' ? step.ownerSchemaId : undefined
  );
  return field?.type === 'reference' || field?.type === 'containment' ? field : undefined;
};

const dedupeRelationRows = (rows: RelationDbResult[]) => {
  const byId = new Map<string, RelationDbResult>();
  for (const row of rows) byId.set(row.id, row);
  return [...byId.values()];
};

const collectContainmentTerminals = (
  boxId: string,
  metric: MetricConfig,
  entities: EntityDbResult[],
  schemas: SchemaDbResult[],
  authCtx: AuthorizationContext | null
): MetricTraversalResult => {
  const entityById = new Map(entities.map(entity => [entity.id, entity]));
  const childrenOf = buildContainmentChildrenIndex(schemas, entities, authCtx);
  const terminals = collectDescendantIds(boxId, childrenOf)
    .map(id => entityById.get(id))
    .filter(
      (entity): entity is EntityDbResult =>
        entity != null && entity.schema_id === metric.sourceSchemaId
    )
    .map(entity => ({ kind: 'entity' as const, entity }));
  return { terminals, duplicateCount: 0 };
};

const getTypedRelations = async (
  db: DatabaseAdapter,
  workspace: string,
  entityIds: string[]
): Promise<{ outgoing: RelationDbResult[]; incoming: RelationDbResult[] }> =>
  entityIds.length === 0
    ? { outgoing: [], incoming: [] }
    : db.relation.listRelationsForEntities(workspace, [...new Set(entityIds)]);

const expandRelationStep = (
  occurrences: EntityOccurrence[],
  step: Extract<MetricTraversalStep, { kind: 'relation' }>,
  entities: EntityDbResult[],
  schemas: SchemaDbResult[],
  authCtx: AuthorizationContext | null
): EntityOccurrence[] => {
  const entityById = new Map(entities.map(entity => [entity.id, entity]));
  const results: EntityOccurrence[] = [];
  const currentSchemaById = new Map(schemas.map(schema => [schema.id, schema]));
  const reverseIndex = new Map<string, EntityDbResult[]>();

  if (step.direction === 'backward') {
    for (const candidate of entities) {
      const field = validEntityRelationField(schemas, candidate.schema_id, step);
      if (
        !field ||
        isFieldViewRestricted(authCtx, currentSchemaById.get(candidate.schema_id), field.id)
      ) {
        continue;
      }
      for (const targetId of decodeRefs(candidate.data[field.id])) {
        const owners = reverseIndex.get(targetId) ?? [];
        owners.push(candidate);
        reverseIndex.set(targetId, owners);
      }
    }
  }

  for (const occurrence of occurrences) {
    const currentSchema = currentSchemaById.get(occurrence.entity.schema_id);
    if (step.direction === 'forward') {
      const field = validEntityRelationField(schemas, occurrence.entity.schema_id, step);
      if (!field || isFieldViewRestricted(authCtx, currentSchema, field.id)) continue;
      for (const targetId of decodeRefs(occurrence.entity.data[field.id])) {
        const target = entityById.get(targetId);
        if (target) results.push({ entity: target, lastRelation: null });
      }
    } else {
      for (const owner of reverseIndex.get(occurrence.entity.id) ?? []) {
        results.push({ entity: owner, lastRelation: null });
      }
    }
    if (results.length >= MAX_TRAVERSAL_RESULTS) break;
  }
  return results.slice(0, MAX_TRAVERSAL_RESULTS);
};

const expandTypedRelationStep = async (
  db: DatabaseAdapter,
  workspace: string,
  occurrences: EntityOccurrence[],
  step: Extract<MetricTraversalStep, { kind: 'typedRelation' }>,
  entities: EntityDbResult[],
  schemas: SchemaDbResult[],
  relationSchemas: RelationSchemaDbResult[],
  authCtx: AuthorizationContext | null
): Promise<EntityOccurrence[]> => {
  const entityById = new Map(entities.map(entity => [entity.id, entity]));
  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
  const relationSchema = relationSchemas.find(schema => schema.id === step.relationSchemaId);
  if (!relationSchema) return [];

  const relationData = await getTypedRelations(
    db,
    workspace,
    occurrences.map(occurrence => occurrence.entity.id)
  );
  const outgoingByEntity = new Map<string, RelationDbResult[]>();
  for (const row of relationData.outgoing) {
    const rows = outgoingByEntity.get(row.in_entity_id) ?? [];
    rows.push(row);
    outgoingByEntity.set(row.in_entity_id, rows);
  }
  const incomingByEntity = new Map<string, RelationDbResult[]>();
  for (const row of relationData.incoming) {
    const rows = incomingByEntity.get(row.out_entity_id) ?? [];
    rows.push(row);
    incomingByEntity.set(row.out_entity_id, rows);
  }

  const results: EntityOccurrence[] = [];
  for (const occurrence of occurrences) {
    const currentSchema = schemaById.get(occurrence.entity.schema_id);
    const typedField = currentSchema?.fields.find(
      field =>
        field.type === 'typedRelation' &&
        field.id === step.fieldId &&
        field.relationSchemaId === step.relationSchemaId &&
        field.direction === step.direction
    );
    if (!typedField) continue;
    // A typed-relation field's direction identifies the endpoint occupied by the current entity.
    // An `in` field therefore follows the row's outgoing edge to its `out` endpoint, while an
    // `out` field follows the incoming edge to its `in` endpoint.
    const rows =
      step.direction === 'in'
        ? (outgoingByEntity.get(occurrence.entity.id) ?? [])
        : (incomingByEntity.get(occurrence.entity.id) ?? []);
    for (const row of dedupeRelationRows(rows)) {
      if (row.schema_id !== step.relationSchemaId) continue;
      const targetId = step.direction === 'in' ? row.out_entity_id : row.in_entity_id;
      const target = entityById.get(targetId);
      const targetSchema = target ? schemaById.get(target.schema_id) : undefined;
      if (!target || !targetSchema) continue;
      if (
        !canViewTypedRelation(
          authCtx,
          [
            {
              schema: currentSchema,
              direction: step.direction
            },
            {
              schema: targetSchema,
              direction: step.direction === 'in' ? 'out' : 'in'
            }
          ],
          row.schema_id,
          row.owner
        ) ||
        !canViewTypedRelationFromEndpoint(authCtx, currentSchema, row.schema_id, step.direction)
      ) {
        continue;
      }
      results.push({ entity: target, lastRelation: row });
      if (results.length >= MAX_TRAVERSAL_RESULTS) return results;
    }
  }
  return results;
};

const collectPathTerminals = async (
  db: DatabaseAdapter,
  workspace: string,
  boxId: string,
  metric: MetricConfig,
  entities: EntityDbResult[],
  schemas: SchemaDbResult[],
  relationSchemas: RelationSchemaDbResult[],
  authCtx: AuthorizationContext | null
): Promise<MetricTraversalResult> => {
  if (metric.path == null || metric.path.length === 0) {
    return collectContainmentTerminals(boxId, metric, entities, schemas, authCtx);
  }

  const entityById = new Map(entities.map(entity => [entity.id, entity]));
  const startEntity = entityById.get(boxId);
  if (!startEntity) return { terminals: [], duplicateCount: 0 };

  const terminals: MetricTerminal[] = [];
  // A map can show several hierarchy levels at once. Allow a configured path to begin at any
  // valid suffix so `containment → typedRelation` works for Domain boxes while its typedRelation
  // suffix also works for the rendered System boxes.
  for (let startIndex = 0; startIndex < metric.path.length; startIndex++) {
    let occurrences: EntityOccurrence[] = [{ entity: startEntity, lastRelation: null }];
    for (const step of metric.path.slice(startIndex)) {
      occurrences =
        step.kind === 'relation'
          ? expandRelationStep(occurrences, step, entities, schemas, authCtx)
          : await expandTypedRelationStep(
              db,
              workspace,
              occurrences,
              step,
              entities,
              schemas,
              relationSchemas,
              authCtx
            );
      if (occurrences.length === 0) break;
    }

    for (const occurrence of occurrences) {
      if (metric.sourceContext === 'relation') {
        const relation = occurrence.lastRelation;
        const relationSchema = relation
          ? relationSchemas.find(schema => schema.id === relation.schema_id)
          : undefined;
        if (relation && relationSchema && relation.schema_id === metric.sourceSchemaId) {
          terminals.push({ kind: 'relation', relation, schema: relationSchema });
        }
      } else if (occurrence.entity.schema_id === metric.sourceSchemaId) {
        terminals.push({ kind: 'entity', entity: occurrence.entity });
      }
    }
  }

  const unique = new Map<string, MetricTerminal>();
  for (const terminal of terminals) {
    const id = terminal.kind === 'entity' ? terminal.entity.id : terminal.relation.id;
    if (!unique.has(id)) unique.set(id, terminal);
  }
  return {
    terminals: [...unique.values()],
    duplicateCount: Math.max(0, terminals.length - unique.size)
  };
};

export const collectMetricTerminals = async (options: {
  db: DatabaseAdapter;
  workspace: string;
  boxEntityIds: string[];
  metric: MetricConfig;
  entities: EntityDbResult[];
  schemas: SchemaDbResult[];
  relationSchemas: RelationSchemaDbResult[];
  authCtx: AuthorizationContext | null;
}): Promise<Map<string, MetricTraversalResult>> => {
  const results = new Map<string, MetricTraversalResult>();
  for (const boxId of options.boxEntityIds) {
    results.set(
      boxId,
      await collectPathTerminals(
        options.db,
        options.workspace,
        boxId,
        options.metric,
        options.entities,
        options.schemas,
        options.relationSchemas,
        options.authCtx
      )
    );
  }
  return results;
};
