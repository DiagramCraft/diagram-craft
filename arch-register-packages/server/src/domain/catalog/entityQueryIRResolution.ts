import type { EntityQuery, PathStep } from '@arch-register/api-types/entityQueryIR';
import {
  isReferenceOrContainmentField,
  type SchemaField
} from '@arch-register/api-types/schemaContract';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import { isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import type { SchemaDbResult } from './db/catalogDatabase';
import type { RelationSchemaDbResult } from './db/relationDatabase';

export type SchemaCatalog = Map<string, SchemaDbResult>;
export type RelationSchemaCatalog = Map<string, RelationSchemaDbResult>;

export type FieldSchemaScope = {
  grantedSchemaIds: Set<string>;
  needsScoping: boolean;
};

export type TypedRelationOwnerSchemaScope = {
  matchingSchemaIds: Set<string>;
  grantedSchemaIds: Set<string>;
};

export type QueryRootKind = 'entity' | 'relation';

export type RootKindResolution = {
  rootKind: QueryRootKind;
  resolvedFromSchema?: QueryRootKind;
  unknownSchemaId?: string;
};

export const ENTITY_PSEUDO_FIELD_IDS = new Set([
  '_id',
  '_schemaId',
  '_lifecycle',
  '_owner',
  '_name',
  '_slug',
  '_description',
  '_namespace',
  '_completeness',
  '_updatedAt',
  '_tags',
  '_conformanceStatus',
  '_conformanceEvaluatedAt',
  '_conformanceStale',
  '_assessment'
]);

export const RELATION_PSEUDO_FIELD_IDS = new Set([
  '_id',
  '_schemaId',
  '_inEntityId',
  '_outEntityId',
  '_createdAt',
  '_updatedAt'
]);

/**
 * Resolve the catalog-record kind without producing validation errors. The validator turns the
 * metadata into user-facing errors; the compiler consumes the same result after validation.
 */
export const resolveEntityQueryRootKind = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog
): RootKindResolution => {
  if (!query.schemaId) {
    return { rootKind: query.root_kind ?? 'entity' };
  }

  if (schemas.has(query.schemaId)) {
    return { rootKind: 'entity', resolvedFromSchema: 'entity' };
  }
  if (relationSchemas.has(query.schemaId)) {
    return { rootKind: 'relation', resolvedFromSchema: 'relation' };
  }
  return {
    rootKind: query.root_kind ?? 'entity',
    unknownSchemaId: query.schemaId
  };
};

export const resolveFieldSchemaScope = (
  fieldId: string,
  schemas: SchemaCatalog,
  authCtx: WorkspaceAuthorizationContext | null
): FieldSchemaScope => {
  const grantedSchemaIds = new Set<string>();
  let needsScoping = false;
  for (const schema of schemas.values()) {
    if (!schema.fields.some(field => field.id === fieldId)) continue;
    if (isFieldViewRestricted(authCtx, schema, fieldId)) needsScoping = true;
    else grantedSchemaIds.add(schema.id);
  }
  return { grantedSchemaIds, needsScoping };
};

export const resolveRelationFieldSchemaScope = (
  fieldId: string,
  relationSchemas: RelationSchemaCatalog,
  authCtx: WorkspaceAuthorizationContext | null
): FieldSchemaScope => {
  const grantedSchemaIds = new Set<string>();
  let needsScoping = false;
  for (const schema of relationSchemas.values()) {
    if (!schema.fields.some(field => field.id === fieldId)) continue;
    if (isFieldViewRestricted(authCtx, schema, fieldId)) needsScoping = true;
    else grantedSchemaIds.add(schema.id);
  }
  return { grantedSchemaIds, needsScoping };
};

export const resolveTypedRelationOwnerSchemaScope = (
  fieldId: string,
  relationSchemaId: string,
  direction: 'in' | 'out',
  schemas: SchemaCatalog,
  authCtx: WorkspaceAuthorizationContext | null,
  currentSchemaId?: string
): TypedRelationOwnerSchemaScope => {
  const candidateSchemas = currentSchemaId
    ? [schemas.get(currentSchemaId)].filter((schema): schema is SchemaDbResult => schema != null)
    : [...schemas.values()];
  const matchingSchemaIds = new Set<string>();
  const grantedSchemaIds = new Set<string>();

  for (const schema of candidateSchemas) {
    const field = schema.fields.find(
      candidate =>
        candidate.id === fieldId &&
        candidate.type === 'typedRelation' &&
        candidate.relationSchemaId === relationSchemaId &&
        candidate.direction === direction
    );
    if (!field) continue;
    matchingSchemaIds.add(schema.id);
    if (!isFieldViewRestricted(authCtx, schema, field.id)) grantedSchemaIds.add(schema.id);
  }

  return { matchingSchemaIds, grantedSchemaIds };
};

export const schemaFieldById = (
  schema: SchemaDbResult | undefined,
  fieldId: string
): SchemaField | undefined => schema?.fields.find(field => field.id === fieldId);

export const relationFieldById = (
  relationSchema: RelationSchemaDbResult | undefined,
  fieldId: string
) => relationSchema?.fields.find(field => field.id === fieldId);

export const schemasDefiningField = (
  fieldId: string,
  schemas: SchemaCatalog,
  authCtx: WorkspaceAuthorizationContext | null,
  predicate: (field: SchemaField) => boolean = () => true
): SchemaDbResult[] =>
  [...schemas.values()].filter(schema => {
    const field = schemaFieldById(schema, fieldId);
    return field != null && predicate(field) && !isFieldViewRestricted(authCtx, schema, fieldId);
  });

export const availableSchemaIds = <T>(
  schemaIds: Iterable<string>,
  schemas: ReadonlyMap<string, T>
): string[] => [...new Set(schemaIds)].filter(schemaId => schemas.has(schemaId));

/** A wildcard ('any') endpoint resolves to every known entity schema id. */
export const resolveEndpointSchemaIds = <T>(
  schemaIds: string[] | 'any' | undefined,
  schemas: ReadonlyMap<string, T>
): Iterable<string> => (schemaIds === 'any' ? schemas.keys() : (schemaIds ?? []));

export const kindAfterStep = (step: PathStep, currentKind: QueryRootKind): QueryRootKind => {
  switch (step.kind) {
    case 'forward':
      return currentKind;
    case 'backward':
    case 'endpoint':
    case 'typedRelation':
    case 'unboundTypedRelation':
    case 'relationForward':
      return 'entity';
    case 'relationBackward':
      return 'relation';
  }
};

export const kindAfterPath = (steps: PathStep[], startKind: QueryRootKind): QueryRootKind =>
  steps.reduce((kind, step) => kindAfterStep(step, kind), startKind);

export { isReferenceOrContainmentField };
