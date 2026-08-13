import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema, TypedRelationField } from '@arch-register/api-types/schemaContract';

export type SchemaValidationSeverity = 'warning' | 'error';

export type SchemaValidationResource =
  | { kind: 'entity-schema'; id: string }
  | { kind: 'relation-schema'; id: string }
  | { kind: 'entity-field'; schemaId: string; fieldId: string };

export type SchemaValidationNavigationTarget =
  | { kind: 'entity-schema'; id: string }
  | { kind: 'relation-schema'; id: string };

export type SchemaValidationIssue = {
  code:
    | 'TYPED_RELATION_PROJECTION_MISSING'
    | 'TYPED_RELATION_PROJECTION_DANGLING'
    | 'TYPED_RELATION_PROJECTION_NOT_ALLOWED';
  severity: SchemaValidationSeverity;
  relationSchemaId: string | null;
  entitySchemaId: string;
  direction: 'in' | 'out' | null;
  fieldId: string | null;
  message: string;
  mitigation: string;
  resources: SchemaValidationResource[];
  navigationTargets: SchemaValidationNavigationTarget[];
  expected?: {
    relationSchemaId: string;
    direction: 'in' | 'out';
  };
};

const byNameThenId = (a: { name: string; id: string }, b: { name: string; id: string }) =>
  a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

const endpointAllowsSchema = (endpoint: RelationSchema['in'], entitySchemaId: string): boolean =>
  endpoint.schemaIds === 'any' || endpoint.schemaIds.includes(entitySchemaId);

const issueSortKey = (issue: SchemaValidationIssue): string =>
  [
    issue.relationSchemaId ?? '',
    issue.direction ?? '',
    issue.entitySchemaId,
    issue.fieldId ?? '',
    issue.code
  ].join('\u0000');

const typedRelationFields = (schema: EntitySchema): TypedRelationField[] =>
  schema.fields.filter(
    (field): field is TypedRelationField => field.type === 'typedRelation' && !field.archived
  );

/**
 * Checks structural consistency between relation endpoint constraints and entity-schema
 * typedRelation projections. This is intentionally pure and advisory: it does not validate
 * records or mutate either schema collection.
 */
export const validateWorkspaceSchemas = (
  schemas: EntitySchema[],
  relationSchemas: RelationSchema[]
): SchemaValidationIssue[] => {
  const sortedSchemas = [...schemas].sort(byNameThenId);
  const sortedRelations = [...relationSchemas].sort(byNameThenId);
  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
  const relationById = new Map(relationSchemas.map(relation => [relation.id, relation]));
  const issues: SchemaValidationIssue[] = [];

  for (const relation of sortedRelations) {
    for (const direction of ['in', 'out'] as const) {
      const endpoint = relation[direction];
      const endpointSchemaIds =
        endpoint.schemaIds === 'any'
          ? sortedSchemas.map(schema => schema.id)
          : [...new Set(endpoint.schemaIds)].sort();

      for (const entitySchemaId of endpointSchemaIds) {
        const entitySchema = schemaById.get(entitySchemaId);
        if (!entitySchema) continue;

        const matchingFields = typedRelationFields(entitySchema).filter(
          field => field.relationSchemaId === relation.id && field.direction === direction
        );
        if (matchingFields.length > 0) continue;

        issues.push({
          code: 'TYPED_RELATION_PROJECTION_MISSING',
          severity: 'warning',
          relationSchemaId: relation.id,
          entitySchemaId,
          direction,
          fieldId: null,
          message: `${entitySchema.name} does not expose ${relation.name} at the ${direction} endpoint.`,
          mitigation: `Add an active typedRelation field referencing ${relation.name} with direction “${direction}”.`,
          resources: [
            { kind: 'entity-schema', id: entitySchema.id },
            { kind: 'relation-schema', id: relation.id }
          ],
          navigationTargets: [
            { kind: 'entity-schema', id: entitySchema.id },
            { kind: 'relation-schema', id: relation.id }
          ],
          expected: { relationSchemaId: relation.id, direction }
        });
      }
    }
  }

  for (const entitySchema of sortedSchemas) {
    for (const field of entitySchema.fields) {
      if (field.type !== 'typedRelation') continue;

      const relation = relationById.get(field.relationSchemaId);
      const fieldResource = {
        kind: 'entity-field' as const,
        schemaId: entitySchema.id,
        fieldId: field.id
      };

      if (!relation) {
        issues.push({
          code: 'TYPED_RELATION_PROJECTION_DANGLING',
          severity: 'warning',
          relationSchemaId: null,
          entitySchemaId: entitySchema.id,
          direction: field.direction,
          fieldId: field.id,
          message: `${entitySchema.name}.${field.name} references a missing relation schema.`,
          mitigation:
            'Restore the referenced relation schema or remove/update this typedRelation field.',
          resources: [{ kind: 'entity-schema', id: entitySchema.id }, fieldResource],
          navigationTargets: [{ kind: 'entity-schema', id: entitySchema.id }]
        });
        continue;
      }

      if (!endpointAllowsSchema(relation[field.direction], entitySchema.id)) {
        issues.push({
          code: 'TYPED_RELATION_PROJECTION_NOT_ALLOWED',
          severity: 'warning',
          relationSchemaId: relation.id,
          entitySchemaId: entitySchema.id,
          direction: field.direction,
          fieldId: field.id,
          message: `${entitySchema.name}.${field.name} exposes ${relation.name} at ${field.direction}, but this entity type is not allowed at that endpoint.`,
          mitigation: `Add ${entitySchema.name} to the relation’s ${field.direction} endpoint or remove/update this field.`,
          resources: [
            { kind: 'entity-schema', id: entitySchema.id },
            { kind: 'relation-schema', id: relation.id },
            fieldResource
          ],
          navigationTargets: [
            { kind: 'entity-schema', id: entitySchema.id },
            { kind: 'relation-schema', id: relation.id }
          ]
        });
      }
    }
  }

  return issues.sort((a, b) => issueSortKey(a).localeCompare(issueSortKey(b)));
};
