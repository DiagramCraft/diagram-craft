import {
  encodeFieldSort,
  isFieldSort,
  parseSort
} from '../../../../entities/components/entityBrowserSort';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type {
  EntityQuery,
  PathStep,
  ProjectionField,
  QueryNode
} from '@arch-register/api-types/entityQueryIR';

/**
 * A seeded, cross-workspace `EntityBrowserEmbedConfig` authors non-standard (schema) fields by
 * NAME, never by id — a schema's actual field ids are workspace-specific (resolved via capability
 * field-role binding when the schema is instantiated). This module resolves those names against
 * the live workspace's schema at render time, mirroring `dashboardSidebarConfigSchema.schemaName`.
 * Standard fields (`_owner`, `_lifecycle`, ...) and projection ids (`_projection:<alias>`) are
 * never resolved. Scope is deliberately narrow: only a single forward hop (`path.length === 1`,
 * `kind === 'forward'`) is resolved; anything deeper, or already using a real id, passes through
 * unchanged rather than throwing.
 *
 * A single forward hop naming a `typedRelation` field is upgraded to a real `typedRelation` step
 * (the field carries the relation schema id and direction, which a seed can't know). Given the
 * workspace's schemas, a projection's terminal `fieldId` is also resolved by name, against the
 * schema at the end of that step (or the relation schema for `source: 'relation'`).
 */

export type FieldResolutionContext = {
  schemas: readonly EntitySchema[];
  relationSchemas: readonly RelationSchema[];
};

/** Resolves a `field:<name>:asc|desc` sort's field NAME to the live schema's field id; other
 *  sorts, standard/projection ids and unknown names pass through unchanged. */
export const resolveSort = (sort: string, rootSchema: EntitySchema | undefined): string => {
  const parsed = isFieldSort(sort) ? parseSort(sort) : null;
  if (!rootSchema || !parsed || parsed.key.startsWith('_')) return sort;
  const field = rootSchema.fields.find(candidate => candidate.name === parsed.key);
  return field ? encodeFieldSort(field.id, parsed.dir) : sort;
};

export const resolveTableFieldIds = (
  viewConfig: unknown,
  rootSchema: EntitySchema | undefined
): unknown => {
  if (
    !rootSchema ||
    viewConfig == null ||
    typeof viewConfig !== 'object' ||
    !Array.isArray((viewConfig as { fieldIds?: unknown }).fieldIds)
  ) {
    return viewConfig;
  }
  const fieldIds = (viewConfig as { fieldIds: string[] }).fieldIds.map(id => {
    if (id.startsWith('_')) return id;
    return rootSchema.fields.find(field => field.name === id)?.id ?? id;
  });
  return { ...viewConfig, fieldIds };
};

const resolvePathFieldName = (path: PathStep[], rootSchema: EntitySchema): PathStep[] => {
  const [step] = path;
  if (path.length !== 1 || step?.kind !== 'forward') return path;
  const field = rootSchema.fields.find(candidate => candidate.name === step.fieldId);
  if (!field) return path;
  if (field.type === 'typedRelation') {
    return [
      {
        kind: 'typedRelation',
        fieldId: field.id,
        relationSchemaId: field.relationSchemaId,
        direction: field.direction,
        ownerSchemaIds: [rootSchema.id],
        ...(step.filter ? { filter: step.filter } : {})
      }
    ];
  }
  return [{ ...step, fieldId: field.id }];
};

/**
 * An `entity-picker` sidebar leaves its `$variable` placeholder literal when nothing is picked
 * (`dashboardSidebarVariables.ts`), so a path predicate like `_id in ['$policyId']` must read as
 * "has a related entity" (`relationExists`) rather than "matches nothing".
 */
const isUnresolvedPlaceholderPredicate = (node: QueryNode): boolean =>
  node.kind === 'predicate' &&
  node.path.length > 0 &&
  node.op === 'in' &&
  Array.isArray(node.value) &&
  node.value.length > 0 &&
  node.value.every(value => typeof value === 'string' && value.startsWith('$'));

const resolveQueryNodeFieldNames = (node: QueryNode, rootSchema: EntitySchema): QueryNode => {
  switch (node.kind) {
    case 'and':
    case 'or':
      return {
        ...node,
        children: node.children.map(child => resolveQueryNodeFieldNames(child, rootSchema))
      };
    case 'not':
      return { ...node, child: resolveQueryNodeFieldNames(node.child, rootSchema) };
    case 'relationExists':
      return { ...node, path: resolvePathFieldName(node.path, rootSchema) };
    case 'predicate':
      if (node.path.length === 0) {
        if (node.fieldId.startsWith('_')) return node;
        const field = rootSchema.fields.find(candidate => candidate.name === node.fieldId);
        return field ? { ...node, fieldId: field.id } : node;
      }
      if (isUnresolvedPlaceholderPredicate(node)) {
        return { kind: 'relationExists', path: resolvePathFieldName(node.path, rootSchema) };
      }
      return { ...node, path: resolvePathFieldName(node.path, rootSchema) };
    default:
      return node;
  }
};

/** The field list a projection's terminal `fieldId` names live in, when it can be determined. */
const terminalFields = (
  projection: ProjectionField,
  path: PathStep[],
  rootSchema: EntitySchema,
  context: FieldResolutionContext | undefined
): ReadonlyArray<{ id: string; name: string }> | undefined => {
  if (path.length === 0) return rootSchema.fields;
  const last = path[path.length - 1];
  if (!context || path.length !== 1 || last?.kind !== 'typedRelation') return undefined;
  const relationSchema = context.relationSchemas.find(
    candidate => candidate.id === last.relationSchemaId
  );
  if (!relationSchema) return undefined;
  if ('source' in projection && projection.source === 'relation') return relationSchema.fields;
  const neighbourSchemaIds = (last.direction === 'in' ? relationSchema.out : relationSchema.in)
    .schemaIds;
  if (neighbourSchemaIds === 'any' || neighbourSchemaIds.length !== 1) return undefined;
  return context.schemas.find(schema => schema.id === neighbourSchemaIds[0])?.fields;
};

const resolveProjectionFieldNames = (
  projection: ProjectionField,
  rootSchema: EntitySchema,
  context: FieldResolutionContext | undefined
): ProjectionField => {
  const path = resolvePathFieldName(projection.path, rootSchema);
  const resolved = { ...projection, path } as ProjectionField;
  if (!('fieldId' in resolved) || !resolved.fieldId || resolved.fieldId.startsWith('_')) {
    return resolved;
  }
  const fieldId = resolved.fieldId;
  const field = terminalFields(resolved, path, rootSchema, context)?.find(
    candidate => candidate.name === fieldId
  );
  return field ? { ...resolved, fieldId: field.id } : resolved;
};

/** Resolves every field NAME in an advanced `entityQuery` against the root schema, and pins its
 *  `schemaId` to the already-resolved `typeFilter`. */
export const resolveEntityQuery = (
  query: EntityQuery,
  rootSchema: EntitySchema | undefined,
  typeFilter: string | null,
  context?: FieldResolutionContext
): EntityQuery => {
  if (!rootSchema) return query;
  return {
    ...query,
    schemaId: typeFilter ?? query.schemaId,
    root: resolveQueryNodeFieldNames(query.root, rootSchema),
    projections: query.projections?.map(projection =>
      resolveProjectionFieldNames(projection, rootSchema, context)
    )
  };
};
