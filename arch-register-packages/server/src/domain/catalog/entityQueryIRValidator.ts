import {
  MAX_PATH_HOPS,
  type EntityQuery,
  type PathStep,
  type QueryNode
} from '@arch-register/api-types/entityQueryIR';
import {
  isReferenceOrContainmentField,
  type ReferenceField,
  type SchemaField
} from '@arch-register/api-types/schemaContract';
import type { RelationField as RelationScalarField } from '@arch-register/api-types/relationSchemaContract';
import {
  ASSESSMENT_PRESENCE_FIELD_ID,
  ASSESSMENT_FIELD_PREFIX
} from '@arch-register/api-types/assessmentFilter';
import type { SchemaDbResult } from './db/catalogDatabase';
import type { RelationSchemaDbResult } from './db/relationDatabase';
import { isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';

export type SchemaCatalog = Map<string, SchemaDbResult>;
export type RelationSchemaCatalog = Map<string, RelationSchemaDbResult>;

export type ValidationError = { path: (string | number)[]; message: string };

export type ValidationResult = { ok: true } | { ok: false; errors: ValidationError[] };

// Underscore pseudo-fields matched against the entity row itself, never against schema `fields`.
const PSEUDO_FIELD_IDS = new Set([
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
  '_assessment'
]);

// Underscore pseudo-fields matched against a relation row itself, under a relation-rooted query.
// Deliberately a much smaller set than the entity one: relations have no slug/namespace/name/
// lifecycle/tags/description/completeness/owner.
const RELATION_PSEUDO_FIELD_IDS = new Set([
  '_id',
  '_schemaId',
  '_inEntityId',
  '_outEntityId',
  '_createdAt',
  '_updatedAt'
]);

// Which schema ids actually grant unrestricted access to a field id, and whether at least one
// schema in the catalog restricts it. A field id can be defined by multiple schemas (e.g. two
// unrelated schemas both use `salary`); resolution at the parse/validate layer intentionally
// collapses this to "is the field id known at all" (matching `isKnownFieldId`'s pre-#2592
// behavior), but the compiler needs the full granting set to scope compiled SQL to only the rows
// whose schema actually grants the field — see entityQueryIRCompiler.ts's `schemaScopeClause`.
export type FieldSchemaScope = { grantedSchemaIds: Set<string>; needsScoping: boolean };

export type TypedRelationOwnerSchemaScope = {
  matchingSchemaIds: Set<string>;
  grantedSchemaIds: Set<string>;
};

export const resolveFieldSchemaScope = (
  fieldId: string,
  schemas: SchemaCatalog,
  authCtx: WorkspaceAuthorizationContext | null
): FieldSchemaScope => {
  const grantedSchemaIds = new Set<string>();
  let needsScoping = false;
  for (const schema of schemas.values()) {
    if (!schema.fields.some(f => f.id === fieldId)) continue;
    if (isFieldViewRestricted(authCtx, schema, fieldId)) needsScoping = true;
    else grantedSchemaIds.add(schema.id);
  }
  return { grantedSchemaIds, needsScoping };
};

// Relation-schema counterpart to resolveFieldSchemaScope, for relation-rooted queries (#2701) — a
// relation field id can likewise be defined by multiple relation schemas.
export const resolveRelationFieldSchemaScope = (
  fieldId: string,
  relationSchemas: RelationSchemaCatalog,
  authCtx: WorkspaceAuthorizationContext | null
): FieldSchemaScope => {
  const grantedSchemaIds = new Set<string>();
  let needsScoping = false;
  for (const schema of relationSchemas.values()) {
    if (!schema.fields.some(f => f.id === fieldId)) continue;
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

const isKnownFieldId = (
  fieldId: string,
  schemas: SchemaCatalog,
  authCtx: WorkspaceAuthorizationContext | null
): boolean => {
  if (PSEUDO_FIELD_IDS.has(fieldId) || fieldId.startsWith('_assessment:')) return true;
  return resolveFieldSchemaScope(fieldId, schemas, authCtx).grantedSchemaIds.size > 0;
};

// Resolves the root catalog-record kind a query addresses. When `schemaId` is set, it's looked up
// against both schema registries (they occupy disjoint id spaces) and that lookup wins; the
// explicit `root_kind` field is only consulted for the schema-less "browse everything" case, and
// otherwise only checked for consistency against the schema-derived kind.
const resolveRootKind = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  errors: ValidationError[]
): 'entity' | 'relation' => {
  let resolvedFromSchema: 'entity' | 'relation' | undefined;
  if (query.schemaId) {
    if (schemas.has(query.schemaId)) resolvedFromSchema = 'entity';
    else if (relationSchemas.has(query.schemaId)) resolvedFromSchema = 'relation';
    else errors.push({ path: ['schemaId'], message: `Unknown schemaId '${query.schemaId}'` });
  }
  if (resolvedFromSchema && query.root_kind && query.root_kind !== resolvedFromSchema) {
    errors.push({
      path: ['root_kind'],
      message: `root_kind '${query.root_kind}' does not match schemaId '${query.schemaId}', which resolves to '${resolvedFromSchema}'`
    });
  }
  return resolvedFromSchema ?? query.root_kind ?? 'entity';
};

const isKnownRelationFieldId = (
  fieldId: string,
  relationSchemas: RelationSchemaCatalog,
  authCtx: WorkspaceAuthorizationContext | null
): boolean => {
  if (RELATION_PSEUDO_FIELD_IDS.has(fieldId)) return true;
  for (const schema of relationSchemas.values()) {
    if (
      schema.fields.some(f => f.id === fieldId) &&
      !isFieldViewRestricted(authCtx, schema, fieldId)
    ) {
      return true;
    }
  }
  return false;
};

const relationFieldById = (
  relationSchemaId: string,
  fieldId: string,
  relationSchemas: RelationSchemaCatalog
): RelationScalarField | undefined =>
  relationSchemas.get(relationSchemaId)?.fields.find(f => f.id === fieldId);

const isKnownEntityRelationFieldId = (
  fieldId: string,
  relationSchemas: RelationSchemaCatalog,
  authCtx: WorkspaceAuthorizationContext | null
): boolean => {
  for (const schema of relationSchemas.values()) {
    const field = schema.fields.find(f => f.id === fieldId);
    if (
      field &&
      field.type === 'entityRelation' &&
      !isFieldViewRestricted(authCtx, schema, fieldId)
    ) {
      return true;
    }
  }
  return false;
};

// What kind of row a path step leaves the traversal on, given the kind it started from. `forward`
// is the only step whose landing kind depends on its starting kind (it operates however the
// current position was already typed); every other step kind has a fixed landing kind. Exported
// for the compiler, which needs the same "what kind does this path land on" resolution to pick
// entity- vs relation-shaped SQL for a predicate/projection terminal (entityQueryIRCompiler.ts).
export const kindAfterStep = (
  step: PathStep,
  currentKind: 'entity' | 'relation'
): 'entity' | 'relation' => {
  switch (step.kind) {
    case 'forward':
      return currentKind;
    case 'backward':
    case 'endpoint':
    case 'typedRelation':
    case 'relationForward':
      return 'entity';
    case 'relationBackward':
      return 'relation';
  }
};

export const kindAfterPath = (
  steps: PathStep[],
  startKind: 'entity' | 'relation'
): 'entity' | 'relation' => steps.reduce((kind, step) => kindAfterStep(step, kind), startKind);

/**
 * Validates a query node scoped to a relation instance — either the root of a relation-rooted
 * query, or the `filter` of a `typedRelation`/`relationBackward` path step. A bare `predicate`/
 * `relationExists` addresses a scalar field on the relation itself; one whose path starts with
 * `endpoint` or `relationForward` (#2670) traverses off the relation to an entity, in which case
 * the rest of validation is delegated to `validatePathSteps`/`validateNode` starting from
 * 'relation' context.
 */
const validateRelationNode = (
  node: QueryNode,
  relationSchemaId: string,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  path: (string | number)[],
  hopsUsedBefore: number,
  errors: ValidationError[],
  authCtx: WorkspaceAuthorizationContext | null
): number => {
  switch (node.kind) {
    case 'and':
    case 'or': {
      let maxHops = hopsUsedBefore;
      node.children.forEach((child, index) => {
        const childHops = validateRelationNode(
          child,
          relationSchemaId,
          schemas,
          relationSchemas,
          [...path, 'children', index],
          hopsUsedBefore,
          errors,
          authCtx
        );
        maxHops = Math.max(maxHops, childHops);
      });
      return maxHops;
    }
    case 'not':
      return validateRelationNode(
        node.child,
        relationSchemaId,
        schemas,
        relationSchemas,
        [...path, 'child'],
        hopsUsedBefore,
        errors,
        authCtx
      );
    case 'freeText':
      errors.push({
        path,
        message: "'freeText' is only valid for the starting entity list"
      });
      return hopsUsedBefore;
    case 'relationExists': {
      if (node.path.length === 0) {
        errors.push({
          path: [...path, 'path'],
          message: "'relationExists' requires a non-empty path"
        });
        return hopsUsedBefore;
      }
      const first = node.path[0]!;
      if (first.kind !== 'endpoint' && first.kind !== 'relationForward') {
        errors.push({
          path,
          message:
            'Relation-instance filters may only contain scalar field predicates, or traverse an entityRelation field'
        });
        return hopsUsedBefore;
      }
      return validatePathSteps(
        node.path,
        schemas,
        relationSchemas,
        [...path, 'path'],
        hopsUsedBefore,
        errors,
        authCtx,
        'relation'
      );
    }
    case 'predicate': {
      if (node.path.length > 0) {
        const first = node.path[0]!;
        if (first.kind !== 'endpoint' && first.kind !== 'relationForward') {
          errors.push({
            path: [...path, 'path'],
            message:
              'Relation-instance filters may only contain scalar field predicates, or traverse an entityRelation field'
          });
          return hopsUsedBefore;
        }
        const hopsAfterPath = validatePathSteps(
          node.path,
          schemas,
          relationSchemas,
          [...path, 'path'],
          hopsUsedBefore,
          errors,
          authCtx,
          'relation'
        );
        const landingKind = kindAfterPath(node.path, 'relation');
        if (landingKind === 'relation') {
          if (!isKnownRelationFieldId(node.fieldId, relationSchemas, authCtx)) {
            errors.push({ path: [...path, 'fieldId'], message: `Unknown field '${node.fieldId}'` });
          }
        } else if (!isKnownFieldId(node.fieldId, schemas, authCtx)) {
          errors.push({ path: [...path, 'fieldId'], message: `Unknown field '${node.fieldId}'` });
        }
        return hopsAfterPath;
      }
      const field = relationFieldById(relationSchemaId, node.fieldId, relationSchemas);
      const relationSchema = relationSchemas.get(relationSchemaId);
      if (!relationSchema) {
        errors.push({
          path: [...path, 'fieldId'],
          message: `Unknown relation schema '${relationSchemaId}'`
        });
      } else if (!field || isFieldViewRestricted(authCtx, relationSchema, node.fieldId)) {
        errors.push({
          path: [...path, 'fieldId'],
          message: `Relation schema '${relationSchema.name}' does not define a viewable scalar field '${node.fieldId}'`
        });
      }
      return hopsUsedBefore;
    }
  }
};

const validatePathSteps = (
  steps: PathStep[],
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  path: (string | number)[],
  hopsUsedBefore: number,
  errors: ValidationError[],
  authCtx: WorkspaceAuthorizationContext | null,
  // Which kind of row the path starts on: 'relation' only for the outermost path of a
  // relation-rooted query (query.root/relationExists path, or a top-level projection path) or a
  // path nested inside a relation-scoped filter (typedRelation/relationBackward's `filter`,
  // handled via validateRelationNode delegating back here); 'entity' otherwise, including for a
  // path nested inside an ordinary entity-scoped PathStep.filter.
  startKind: 'entity' | 'relation' = 'entity'
): number => {
  let hopsUsed = hopsUsedBefore;
  let currentKind: 'entity' | 'relation' = startKind;
  steps.forEach((step, index) => {
    hopsUsed += 1;
    const stepPath = [...path, index];
    if (hopsUsed > MAX_PATH_HOPS) {
      errors.push({
        path: stepPath,
        message: `Path exceeds MAX_PATH_HOPS (${MAX_PATH_HOPS})`
      });
    }

    if (step.kind === 'endpoint') {
      if (currentKind !== 'relation') {
        errors.push({
          path: stepPath,
          message: "'endpoint' path step is only valid when the current path position is a relation"
        });
      }
    } else if (step.kind === 'relationForward') {
      if (currentKind !== 'relation') {
        errors.push({
          path: stepPath,
          message:
            "'relationForward' path step is only valid when the current path position is a relation"
        });
      } else {
        const scope = resolveRelationFieldSchemaScope(step.fieldId, relationSchemas, authCtx);
        if (
          scope.grantedSchemaIds.size === 0 ||
          !isKnownEntityRelationFieldId(step.fieldId, relationSchemas, authCtx)
        ) {
          errors.push({
            path: [...stepPath, 'fieldId'],
            message: `Unknown or restricted entityRelation field '${step.fieldId}'`
          });
        }
      }
    } else if (step.kind === 'relationBackward') {
      if (currentKind !== 'entity') {
        errors.push({
          path: stepPath,
          message:
            "'relationBackward' path step is only valid when the current path position is an entity"
        });
      }
      const relationSchema = relationSchemas.get(step.relationSchemaId);
      if (!relationSchema) {
        errors.push({
          path: [...stepPath, 'relationSchemaId'],
          message: `Unknown relation schema '${step.relationSchemaId}'`
        });
      } else {
        const field = relationSchema.fields.find(f => f.id === step.fieldId);
        if (
          !field ||
          field.type !== 'entityRelation' ||
          isFieldViewRestricted(authCtx, relationSchema, step.fieldId)
        ) {
          errors.push({
            path: [...stepPath, 'fieldId'],
            message: `Relation schema '${step.relationSchemaId}' does not define a viewable entityRelation field '${step.fieldId}'`
          });
        }
      }
      if (step.filter && relationSchema) {
        hopsUsed = validateRelationNode(
          step.filter,
          step.relationSchemaId,
          schemas,
          relationSchemas,
          [...stepPath, 'filter'],
          hopsUsed,
          errors,
          authCtx
        );
      }
    } else if (step.kind === 'backward') {
      const ownerSchema = schemas.get(step.ownerSchemaId);
      if (!ownerSchema) {
        errors.push({
          path: [...stepPath, 'ownerSchemaId'],
          message: `Unknown ownerSchemaId '${step.ownerSchemaId}'`
        });
      } else {
        const field = ownerSchema.fields.find(f => f.id === step.fieldId);
        if (
          !field ||
          !isReferenceOrContainmentField(field) ||
          isFieldViewRestricted(authCtx, ownerSchema, step.fieldId)
        ) {
          errors.push({
            path: [...stepPath, 'fieldId'],
            message: `Schema '${step.ownerSchemaId}' does not define a reference/containment field '${step.fieldId}'`
          });
        }
      }
    } else if (step.kind === 'typedRelation') {
      const relationSchema = relationSchemas.get(step.relationSchemaId);
      if (!relationSchema) {
        errors.push({
          path: [...stepPath, 'relationSchemaId'],
          message: `Unknown relation schema '${step.relationSchemaId}'`
        });
      }
      const ownerSchemaIds = Array.isArray(step.ownerSchemaIds) ? step.ownerSchemaIds : [];
      const uniqueOwnerSchemaIds = new Set(ownerSchemaIds);
      if (ownerSchemaIds.length === 0) {
        errors.push({
          path: [...stepPath, 'ownerSchemaIds'],
          message: 'Typed-relation hops require at least one owner schema'
        });
      }
      if (uniqueOwnerSchemaIds.size !== ownerSchemaIds.length) {
        errors.push({
          path: [...stepPath, 'ownerSchemaIds'],
          message: 'Typed-relation owner schema ids must be unique'
        });
      }

      for (const ownerSchemaId of uniqueOwnerSchemaIds) {
        const ownerSchema = schemas.get(ownerSchemaId);
        const ownerField = ownerSchema?.fields.find(
          field =>
            field.id === step.fieldId &&
            field.type === 'typedRelation' &&
            field.relationSchemaId === step.relationSchemaId &&
            field.direction === step.direction
        );
        if (!ownerSchema) {
          errors.push({
            path: [...stepPath, 'ownerSchemaIds'],
            message: `Unknown owner schema '${ownerSchemaId}'`
          });
        } else if (!ownerField || isFieldViewRestricted(authCtx, ownerSchema, ownerField.id)) {
          errors.push({
            path: [...stepPath, 'ownerSchemaIds'],
            message: `Owner schema '${ownerSchemaId}' does not grant a viewable typed-relation field '${step.fieldId}'`
          });
        }
      }

      const scope = resolveTypedRelationOwnerSchemaScope(
        step.fieldId,
        step.relationSchemaId,
        step.direction,
        schemas,
        authCtx
      );
      if (scope.grantedSchemaIds.size === 0) {
        errors.push({
          path: [...stepPath, 'fieldId'],
          message: `No viewable typed-relation field '${step.fieldId}' binds relation schema '${step.relationSchemaId}' at direction '${step.direction}'`
        });
      }
      if (step.filter && relationSchema) {
        hopsUsed = validateRelationNode(
          step.filter,
          step.relationSchemaId,
          schemas,
          relationSchemas,
          [...stepPath, 'filter'],
          hopsUsed,
          errors,
          authCtx
        );
      }
    } else {
      if (!isKnownFieldId(step.fieldId, schemas, authCtx)) {
        errors.push({
          path: [...stepPath, 'fieldId'],
          message: `Unknown field '${step.fieldId}'`
        });
      }
    }

    if (
      step.kind !== 'endpoint' &&
      step.kind !== 'typedRelation' &&
      step.kind !== 'relationBackward' &&
      step.filter
    ) {
      hopsUsed = validateNode(
        step.filter,
        schemas,
        relationSchemas,
        [...stepPath, 'filter'],
        hopsUsed,
        false,
        errors,
        authCtx,
        'entity'
      );
    }

    currentKind = kindAfterStep(step, currentKind);
  });
  return hopsUsed;
};

const validateNode = (
  node: QueryNode,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  path: (string | number)[],
  hopsUsedBefore: number,
  allowFreeText: boolean,
  errors: ValidationError[],
  authCtx: WorkspaceAuthorizationContext | null,
  // 'relation' only at the true root of a relation-rooted query; always 'entity' once nested past
  // an 'endpoint' path step (or for an entity-rooted query throughout).
  rootKind: 'entity' | 'relation' = 'entity'
): number => {
  // Only true for the outermost call (mirrors allowFreeText's own top-of-tree semantics): a path
  // step's own nested filter is validated via validateNode with rootKind forced to 'entity'
  // (see validatePathSteps), so allowEndpointFirst naturally stays false once nested.
  const allowEndpointFirst = allowFreeText && rootKind === 'relation';
  switch (node.kind) {
    case 'and':
    case 'or': {
      // An empty 'and' (vacuously true, e.g. the degenerate mapping of an empty FilterCondition[])
      // is legitimate and matches everything; an empty 'or' (vacuously false) is also accepted as
      // structurally valid, even though a hand-authored query would have little reason to write one.
      let maxHops = hopsUsedBefore;
      node.children.forEach((child, index) => {
        const childHops = validateNode(
          child,
          schemas,
          relationSchemas,
          [...path, 'children', index],
          hopsUsedBefore,
          allowFreeText,
          errors,
          authCtx,
          rootKind
        );
        maxHops = Math.max(maxHops, childHops);
      });
      return maxHops;
    }
    case 'not':
      return validateNode(
        node.child,
        schemas,
        relationSchemas,
        [...path, 'child'],
        hopsUsedBefore,
        allowFreeText,
        errors,
        authCtx,
        rootKind
      );
    case 'freeText':
      if (rootKind === 'relation') {
        errors.push({
          path,
          message: "'freeText' is not supported for relation-rooted queries"
        });
        return hopsUsedBefore;
      }
      if (!allowFreeText) {
        errors.push({
          path,
          message: "'freeText' is only valid for the starting entity list"
        });
      }
      if (node.value.trim() === '') {
        errors.push({ path: [...path, 'value'], message: "'freeText' value must not be empty" });
      }
      return hopsUsedBefore;
    case 'predicate': {
      const pathStartKind: 'entity' | 'relation' = allowEndpointFirst ? 'relation' : 'entity';
      const hopsAfterPath = validatePathSteps(
        node.path,
        schemas,
        relationSchemas,
        [...path, 'path'],
        hopsUsedBefore,
        errors,
        authCtx,
        pathStartKind
      );
      const landingKind = kindAfterPath(node.path, pathStartKind);
      if (landingKind === 'relation') {
        if (!isKnownRelationFieldId(node.fieldId, relationSchemas, authCtx)) {
          errors.push({ path: [...path, 'fieldId'], message: `Unknown field '${node.fieldId}'` });
        }
      } else if (!isKnownFieldId(node.fieldId, schemas, authCtx)) {
        errors.push({ path: [...path, 'fieldId'], message: `Unknown field '${node.fieldId}'` });
      } else if (
        [...schemas.values()].some(schema =>
          schema.fields.some(field => field.id === node.fieldId && field.type === 'typedRelation')
        )
      ) {
        errors.push({
          path: [...path, 'fieldId'],
          message: `Field '${node.fieldId}' is a typed relation and is not queryable`
        });
      }
      return hopsAfterPath;
    }
    case 'relationExists': {
      if (node.path.length === 0) {
        errors.push({
          path: [...path, 'path'],
          message: "'relationExists' requires a non-empty path"
        });
      }
      return validatePathSteps(
        node.path,
        schemas,
        relationSchemas,
        [...path, 'path'],
        hopsUsedBefore,
        errors,
        authCtx,
        allowEndpointFirst ? 'relation' : 'entity'
      );
    }
  }
};

// Detects whether any predicate in the tree addresses `_assessment`/`_assessment:<fieldId>` —
// only ever a predicate's terminal fieldId, never a PathStep's own fieldId (a path step names a
// traversal field, not an assessment address), but it can appear at any depth, including inside a
// PathStep.filter (the `[...]` scoping, §4.3).
const pathUsesAssessmentField = (steps: PathStep[]): boolean =>
  steps.some(
    step => step.kind !== 'endpoint' && step.filter != null && nodeUsesAssessmentField(step.filter)
  );

const nodeUsesAssessmentField = (node: QueryNode): boolean => {
  switch (node.kind) {
    case 'and':
    case 'or':
      return node.children.some(nodeUsesAssessmentField);
    case 'not':
      return nodeUsesAssessmentField(node.child);
    case 'predicate':
      return (
        node.fieldId === ASSESSMENT_PRESENCE_FIELD_ID ||
        node.fieldId.startsWith(ASSESSMENT_FIELD_PREFIX) ||
        pathUsesAssessmentField(node.path)
      );
    case 'relationExists':
      return pathUsesAssessmentField(node.path);
    case 'freeText':
      return false;
  }
};

const projectionUsesAssessmentField = (fieldId: string, path: PathStep[]): boolean =>
  fieldId === ASSESSMENT_PRESENCE_FIELD_ID ||
  fieldId.startsWith(ASSESSMENT_FIELD_PREFIX) ||
  pathUsesAssessmentField(path);

const projectionAlias = (projection: NonNullable<EntityQuery['projections']>[number]): string => {
  if (projection.alias) return projection.alias;
  const path = projection.path
    .map(step => {
      switch (step.kind) {
        case 'forward':
          return step.fieldId;
        case 'backward':
          return `<-${step.ownerSchemaId}.${step.fieldId}`;
        case 'typedRelation':
          return `${step.fieldId}[${step.relationSchemaId}]`;
        case 'endpoint':
          return `endpoint(${step.direction})`;
        case 'relationForward':
          return step.fieldId;
        case 'relationBackward':
          return `<-${step.relationSchemaId}.${step.fieldId}`;
      }
    })
    .join('.');
  return path ? `${path}.${projection.fieldId}` : projection.fieldId;
};

export const validateEntityQueryIR = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  authCtx: WorkspaceAuthorizationContext | null = null,
  relationSchemas: RelationSchemaCatalog = new Map()
): ValidationResult => {
  const errors: ValidationError[] = [];
  const rootKind = resolveRootKind(query, schemas, relationSchemas, errors);
  const rootUsesAssessmentField =
    nodeUsesAssessmentField(query.root) ||
    (query.projections ?? []).some(p => projectionUsesAssessmentField(p.fieldId, p.path));
  if (rootKind === 'relation' && (query.assessmentId || rootUsesAssessmentField)) {
    errors.push({
      path: ['assessmentId'],
      message: 'Assessment fields/assessmentId are not supported for relation-rooted queries'
    });
  }
  if (rootKind === 'entity' && !query.assessmentId && nodeUsesAssessmentField(query.root)) {
    errors.push({
      path: ['assessmentId'],
      message:
        "Query uses '_assessment'/'_assessment:<fieldId>' predicates but assessmentId is not set"
    });
  }
  if (query.projectScope === 'project' && !query.projectId) {
    errors.push({
      path: ['projectId'],
      message: "projectScope 'project' requires projectId"
    });
  }
  if (query.asOf != null && Number.isNaN(Date.parse(query.asOf))) {
    errors.push({ path: ['asOf'], message: `Invalid asOf date '${query.asOf}'` });
  }
  validateNode(query.root, schemas, relationSchemas, ['root'], 0, true, errors, authCtx, rootKind);

  const aliases = new Set<string>();
  for (const [index, projection] of (query.projections ?? []).entries()) {
    const projectionPath = ['projections', index] as (string | number)[];
    validatePathSteps(
      projection.path,
      schemas,
      relationSchemas,
      [...projectionPath, 'path'],
      0,
      errors,
      authCtx,
      rootKind
    );
    if (rootKind === 'relation' && projection.path.length === 0) {
      if (!isKnownRelationFieldId(projection.fieldId, relationSchemas, authCtx)) {
        errors.push({
          path: [...projectionPath, 'fieldId'],
          message: `Unknown field '${projection.fieldId}'`
        });
      }
      const alias = projectionAlias(projection);
      if (aliases.has(alias)) {
        errors.push({
          path: [...projectionPath, 'alias'],
          message: `Duplicate projection alias '${alias}'`
        });
      }
      aliases.add(alias);
      continue;
    }
    projection.path.forEach((step, stepIndex) => {
      if (step.kind !== 'endpoint' && step.filter) {
        errors.push({
          path: [...projectionPath, 'path', stepIndex, 'filter'],
          message: 'Projection paths cannot contain scoped filters'
        });
      }
    });
    // A path ending on relationBackward with no following endpoint/relationForward lands on a
    // relation instance, not an entity — only a `source: 'relation'` projection (terminating at a
    // typedRelation step, per the check below) can read a field off a relation row today.
    if (
      projection.source !== 'relation' &&
      kindAfterPath(projection.path, rootKind) === 'relation'
    ) {
      errors.push({
        path: [...projectionPath, 'path'],
        message:
          'Projection path lands on a relation instance; add an endpoint or relationForward step to reach an entity'
      });
    }
    const relationProjectionStep =
      projection.source === 'relation'
        ? [...projection.path].reverse().find(step => step.kind === 'typedRelation')
        : undefined;
    if (
      projection.source === 'relation' &&
      projection.path[projection.path.length - 1]?.kind !== 'typedRelation'
    ) {
      errors.push({
        path: [...projectionPath, 'source'],
        message: 'Relation projections must terminate at a typedRelation path step'
      });
    }
    if (projection.source === 'relation' && !relationProjectionStep) {
      errors.push({
        path: [...projectionPath, 'source'],
        message: 'Relation projections require a typedRelation path step'
      });
    } else if (
      relationProjectionStep &&
      (!relationFieldById(
        relationProjectionStep.relationSchemaId,
        projection.fieldId,
        relationSchemas
      ) ||
        isFieldViewRestricted(
          authCtx,
          relationSchemas.get(relationProjectionStep.relationSchemaId),
          projection.fieldId
        ))
    ) {
      errors.push({
        path: [...projectionPath, 'fieldId'],
        message: `Unknown or restricted relation field '${projection.fieldId}'`
      });
    } else if (
      projection.source !== 'relation' &&
      !isKnownFieldId(projection.fieldId, schemas, authCtx)
    ) {
      errors.push({
        path: [...projectionPath, 'fieldId'],
        message: `Unknown field '${projection.fieldId}'`
      });
    } else if (
      projection.source !== 'relation' &&
      [...schemas.values()].some(schema =>
        schema.fields.some(
          field => field.id === projection.fieldId && field.type === 'typedRelation'
        )
      )
    ) {
      errors.push({
        path: [...projectionPath, 'fieldId'],
        message: `Field '${projection.fieldId}' is a typed relation and is not queryable`
      });
    }
    const alias = projectionAlias(projection);
    if (aliases.has(alias)) {
      errors.push({
        path: [...projectionPath, 'alias'],
        message: `Duplicate projection alias '${alias}'`
      });
    }
    aliases.add(alias);
    if (!query.assessmentId && projectionUsesAssessmentField(projection.fieldId, projection.path)) {
      errors.push({
        path: ['assessmentId'],
        message:
          "Query uses '_assessment'/'_assessment:<fieldId>' projections but assessmentId is not set"
      });
    }
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
};

// Re-exported for callers that need to distinguish a reference field from a plain scalar when
// deciding whether a path step is even legal to take (used by the compiler as well).
export { isReferenceOrContainmentField };
export type RelationField = ReferenceField | Extract<SchemaField, { type: 'containment' }>;
