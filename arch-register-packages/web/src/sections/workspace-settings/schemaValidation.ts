import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';

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

/**
 * Checks structural consistency for declared typedRelation projections. Relation endpoint
 * constraints are authoritative, while projections are optional and therefore do not produce
 * diagnostics when an allowed entity schema has no corresponding field.
 */
export const validateWorkspaceSchemas = (
  schemas: EntitySchema[],
  relationSchemas: RelationSchema[]
): SchemaValidationIssue[] => {
  const sortedSchemas = [...schemas].sort(byNameThenId);
  const relationById = new Map(relationSchemas.map(relation => [relation.id, relation]));
  const issues: SchemaValidationIssue[] = [];

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
