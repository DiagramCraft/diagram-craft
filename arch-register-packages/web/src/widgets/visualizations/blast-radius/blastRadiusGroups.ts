import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { BlastRadiusPath } from '../../../hooks/useBlastRadius';
import type { BlastRadiusEntity } from '../../../lib/blastRadiusFilters';
import type { BlastRadiusGroup } from '../../../sections/entities/components/BlastRadiusPanel';

/** One column of a grouped blast radius: the entities reached directly via a typed-relation field. */
export type BlastRadiusGroupConfig = {
  /** Typed-relation field (id or name) on the starting entity's schema. */
  fieldName: string;
  label: string;
  emptyText?: string;
};

export const BLAST_RADIUS_DEFAULT_MAX_DEPTH = 2;

const pathIdFor = (index: number) => `group-${index}`;

const resolveTypedRelationSchemaId = (
  schema: EntitySchema | undefined,
  fieldIdOrName: string
): string | null => {
  const field = schema?.fields.find(
    candidate => candidate.id === fieldIdOrName || candidate.name === fieldIdOrName
  );
  return field?.type === 'typedRelation' ? field.relationSchemaId : null;
};

/** Paths for the groups whose typed-relation field exists on `schema`; others are omitted. */
export const buildBlastRadiusGroupPaths = (
  schema: EntitySchema | undefined,
  groups: readonly BlastRadiusGroupConfig[]
): BlastRadiusPath[] =>
  groups.flatMap((group, index) => {
    const relationSchemaId = resolveTypedRelationSchemaId(schema, group.fieldName);
    return relationSchemaId
      ? [
          {
            id: pathIdFor(index),
            steps: [
              {
                kind: 'unboundTypedRelation' as const,
                relationSchemaId,
                direction: 'both' as const
              }
            ]
          }
        ]
      : [];
  });

const isDepth1Via = (entity: BlastRadiusEntity, pathId: string) =>
  entity.depth === 1 && entity.paths.some(path => path.pathId === pathId && path.depth === 1);

/** One column per configured group, plus a trailing "second order" column for everything else. */
export const buildBlastRadiusGroups = (
  groups: readonly BlastRadiusGroupConfig[]
): BlastRadiusGroup[] => {
  const direct = (entities: BlastRadiusEntity[]) =>
    groups.map((_, index) => entities.filter(entity => isDepth1Via(entity, pathIdFor(index))));

  return [
    ...groups.map((group, index) => ({
      id: pathIdFor(index),
      label: group.label,
      emptyText: group.emptyText ?? `No ${group.label.toLowerCase()} recorded.`,
      select: (entities: BlastRadiusEntity[]) => direct(entities)[index]!
    })),
    {
      id: 'second-order',
      label: 'Second order',
      emptyText: 'Nothing reachable two hops out.',
      showVia: true,
      select: (entities: BlastRadiusEntity[]) => {
        const depth1Ids = new Set(
          direct(entities)
            .flat()
            .map(entity => entity.entityId)
        );
        return entities.filter(entity => !depth1Ids.has(entity.entityId));
      }
    }
  ];
};
