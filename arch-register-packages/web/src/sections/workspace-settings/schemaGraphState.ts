import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { DependencyGraphEdge } from '../../components/DependencyGraph';

const schemaPairKey = (from: string, to: string): string => `${from}::${to}`;

export const buildSchemaGraphEdges = (
  schemas: EntitySchema[],
  relationSchemas: RelationSchema[]
): DependencyGraphEdge[] => {
  const schemaIds = new Set(schemas.map(schema => schema.id));
  const relationSchemaById = new Map(
    relationSchemas.map(relationSchema => [relationSchema.id, relationSchema])
  );
  const referenceEdges = new Map<string, { fields: string[]; kind: string }>();
  const typedEdges: DependencyGraphEdge[] = [];

  for (const schema of schemas) {
    for (const field of schema.fields) {
      if (field.type === 'reference' || field.type === 'containment') {
        const pairKey = schemaPairKey(schema.id, field.schemaId);
        const existing = referenceEdges.get(pairKey);

        if (existing) {
          existing.fields.push(field.name);
          if (field.type === 'containment' && existing.kind !== 'containment') {
            existing.kind = 'containment';
          }
        } else {
          referenceEdges.set(pairKey, {
            fields: [field.name],
            kind: field.type
          });
        }
        continue;
      }

      if (field.type !== 'typedRelation') continue;

      const relationSchema = relationSchemaById.get(field.relationSchemaId);
      if (!relationSchema) continue;

      const otherEndpoint = field.direction === 'out' ? relationSchema.in : relationSchema.out;
      for (const targetSchemaId of new Set(otherEndpoint.schemaIds)) {
        if (!schemaIds.has(targetSchemaId)) continue;

        const from = field.direction === 'out' ? schema.id : targetSchemaId;
        const to = field.direction === 'out' ? targetSchemaId : schema.id;

        typedEdges.push({
          id: `${from}::${to}::typed::${relationSchema.id}::${field.id}`,
          from,
          to,
          label: relationSchema.name,
          kind: 'typed',
          color: relationSchema.color ?? undefined,
          relationId: relationSchema.id
        });
      }
    }
  }

  const genericEdges = Array.from(referenceEdges.entries()).map(([pairKey, data]) => {
    const [from, to] = pairKey.split('::');
    return {
      id: pairKey,
      from: from!,
      to: to!,
      label: data.fields.join(', '),
      kind: data.kind
    };
  });

  return [...genericEdges, ...typedEdges];
};
