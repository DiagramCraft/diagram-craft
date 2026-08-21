import type { EntitySchema, TypedRelationField } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';

const activeTypedRelationFields = (schema: EntitySchema | null): TypedRelationField[] =>
  (schema?.fields.filter(field => field.type === 'typedRelation' && !field.archived) as
    | TypedRelationField[]
    | undefined) ?? [];

/**
 * Relation schemas applicable to the given entity schema (either endpoint allows this schema)
 * that have no dedicated `typedRelation` field projecting them — i.e. would otherwise only be
 * reachable via the generic Relationships tab. Schema-only computation; does not depend on
 * relation record data.
 */
export const computeApplicableUnboundRelationSchemas = (
  schema: EntitySchema | null,
  relationSchemas: RelationSchema[]
): RelationSchema[] => {
  if (!schema) return [];
  const fields = activeTypedRelationFields(schema);
  return relationSchemas.filter(relationSchema =>
    (['in', 'out'] as const).some(direction => {
      const endpoint = relationSchema[direction];
      const endpointAllowsEntity =
        endpoint.schemaIds === 'any' || endpoint.schemaIds.includes(schema.id);
      const hasProjection = fields.some(
        field => field.relationSchemaId === relationSchema.id && field.direction === direction
      );
      return endpointAllowsEntity && !hasProjection;
    })
  );
};

export type UnboundTypedRelationEndpoint = {
  endpointDirection: 'in' | 'out';
  direction: 'outgoing' | 'incoming';
  label: string;
  records: RelationRecord[];
};

/**
 * Per-direction endpoints (with resolved records) for one unbound relation schema, matching the
 * shape rendered by the entity detail "unbound typed relations" sections.
 */
export const computeUnboundRelationEndpoints = (
  schema: EntitySchema | null,
  relationSchema: RelationSchema,
  typedRelationsOutgoing: RelationRecord[],
  typedRelationsIncoming: RelationRecord[]
): UnboundTypedRelationEndpoint[] => {
  if (!schema) return [];
  const fields = activeTypedRelationFields(schema);
  return (['in', 'out'] as const).flatMap(direction => {
    const endpoint = relationSchema[direction];
    const endpointAllowsEntity =
      endpoint.schemaIds === 'any' || endpoint.schemaIds.includes(schema.id);
    const hasProjection = fields.some(
      field => field.relationSchemaId === relationSchema.id && field.direction === direction
    );
    if (!endpointAllowsEntity || hasProjection) return [];

    const displayDirection = direction === 'in' ? ('outgoing' as const) : ('incoming' as const);
    const records = (
      displayDirection === 'outgoing' ? typedRelationsOutgoing : typedRelationsIncoming
    ).filter(record => record._schema.id === relationSchema.id);
    return [
      {
        endpointDirection: direction,
        direction: displayDirection,
        label:
          endpoint.label ??
          (displayDirection === 'outgoing'
            ? `Outgoing ${relationSchema.name}`
            : `Incoming ${relationSchema.name}`),
        records
      }
    ];
  });
};
