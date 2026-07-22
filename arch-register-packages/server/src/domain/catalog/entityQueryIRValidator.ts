import {
  MAX_PATH_HOPS,
  type EntityQuery,
  type PathStep,
  type QueryNode
} from '@arch-register/api-types/entityQueryIR';
import type { ReferenceField, SchemaField } from '@arch-register/api-types/schemaContract';
import {
  ASSESSMENT_PRESENCE_FIELD_ID,
  ASSESSMENT_FIELD_PREFIX
} from '@arch-register/api-types/assessmentFilter';
import type { SchemaDbResult } from './db/catalogDatabase';

export type SchemaCatalog = Map<string, SchemaDbResult>;

export type ValidationError = { path: (string | number)[]; message: string };

export type ValidationResult = { ok: true } | { ok: false; errors: ValidationError[] };

const isRelationField = (
  field: SchemaField
): field is Extract<SchemaField, { type: 'reference' | 'containment' }> =>
  field.type === 'reference' || field.type === 'containment';

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

const isKnownFieldId = (fieldId: string, schemas: SchemaCatalog): boolean => {
  if (PSEUDO_FIELD_IDS.has(fieldId) || fieldId.startsWith('_assessment:')) return true;
  for (const schema of schemas.values()) {
    if (schema.fields.some(f => f.id === fieldId)) return true;
  }
  return false;
};

const validatePathSteps = (
  steps: PathStep[],
  schemas: SchemaCatalog,
  path: (string | number)[],
  hopsUsedBefore: number,
  errors: ValidationError[]
): number => {
  let hopsUsed = hopsUsedBefore;
  steps.forEach((step, index) => {
    hopsUsed += 1;
    const stepPath = [...path, index];
    if (hopsUsed > MAX_PATH_HOPS) {
      errors.push({
        path: stepPath,
        message: `Path exceeds MAX_PATH_HOPS (${MAX_PATH_HOPS})`
      });
    }

    if (step.kind === 'backward') {
      const ownerSchema = schemas.get(step.ownerSchemaId);
      if (!ownerSchema) {
        errors.push({
          path: [...stepPath, 'ownerSchemaId'],
          message: `Unknown ownerSchemaId '${step.ownerSchemaId}'`
        });
      } else {
        const field = ownerSchema.fields.find(f => f.id === step.fieldId);
        if (!field || !isRelationField(field)) {
          errors.push({
            path: [...stepPath, 'fieldId'],
            message: `Schema '${step.ownerSchemaId}' does not define a reference/containment field '${step.fieldId}'`
          });
        }
      }
    } else {
      if (!isKnownFieldId(step.fieldId, schemas)) {
        errors.push({
          path: [...stepPath, 'fieldId'],
          message: `Unknown field '${step.fieldId}'`
        });
      }
    }

    if (step.filter) {
      hopsUsed = validateNode(step.filter, schemas, [...stepPath, 'filter'], hopsUsed, errors);
    }
  });
  return hopsUsed;
};

const validateNode = (
  node: QueryNode,
  schemas: SchemaCatalog,
  path: (string | number)[],
  hopsUsedBefore: number,
  errors: ValidationError[]
): number => {
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
          [...path, 'children', index],
          hopsUsedBefore,
          errors
        );
        maxHops = Math.max(maxHops, childHops);
      });
      return maxHops;
    }
    case 'not':
      return validateNode(node.child, schemas, [...path, 'child'], hopsUsedBefore, errors);
    case 'predicate': {
      const hopsAfterPath = validatePathSteps(
        node.path,
        schemas,
        [...path, 'path'],
        hopsUsedBefore,
        errors
      );
      if (!isKnownFieldId(node.fieldId, schemas)) {
        errors.push({ path: [...path, 'fieldId'], message: `Unknown field '${node.fieldId}'` });
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
      return validatePathSteps(node.path, schemas, [...path, 'path'], hopsUsedBefore, errors);
    }
  }
};

// Detects whether any predicate in the tree addresses `_assessment`/`_assessment:<fieldId>` —
// only ever a predicate's terminal fieldId, never a PathStep's own fieldId (a path step names a
// traversal field, not an assessment address), but it can appear at any depth, including inside a
// PathStep.filter (the `[...]` scoping, §4.3).
const pathUsesAssessmentField = (steps: PathStep[]): boolean =>
  steps.some(step => step.filter != null && nodeUsesAssessmentField(step.filter));

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
  }
};

export const validateEntityQueryIR = (
  query: EntityQuery,
  schemas: SchemaCatalog
): ValidationResult => {
  const errors: ValidationError[] = [];
  if (query.schemaId && !schemas.has(query.schemaId)) {
    errors.push({ path: ['schemaId'], message: `Unknown schemaId '${query.schemaId}'` });
  }
  if (!query.assessmentId && nodeUsesAssessmentField(query.root)) {
    errors.push({
      path: ['assessmentId'],
      message:
        "Query uses '_assessment'/'_assessment:<fieldId>' predicates but assessmentId is not set"
    });
  }
  validateNode(query.root, schemas, ['root'], 0, errors);
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
};

// Re-exported for callers that need to distinguish a reference field from a plain scalar when
// deciding whether a path step is even legal to take (used by the compiler as well).
export const isReferenceOrContainmentField = isRelationField;
export type RelationField = ReferenceField | Extract<SchemaField, { type: 'containment' }>;
