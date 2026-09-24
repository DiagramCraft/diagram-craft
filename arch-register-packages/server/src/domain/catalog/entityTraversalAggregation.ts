import type { EntityDependents } from '@arch-register/api-types/entityContract';
import type { EntityTraversalAggregation } from '@arch-register/api-types/entityTraversalContract';
import type { EntityTraversalHop, EntityTraversalResult } from './entityTraversal';

type ImpactPath = EntityTraversalAggregation['entities'][number]['paths'][number];
type ImpactEntity = Omit<EntityTraversalAggregation['entities'][number], 'rank' | 'paths'> & {
  paths: ImpactPath[];
};
type SchemaName = { id: string; name: string };

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const compareCriticalityDescending = (left: number | null, right: number | null): number => {
  if (left == null) return right == null ? 0 : 1;
  if (right == null) return -1;
  return right - left;
};

const sourceString = (source: Record<string, unknown>, fieldId: string): string | null => {
  const value = source[fieldId];
  return typeof value === 'string' ? value : null;
};

const sourceCriticality = (source: Record<string, unknown>): number | null => {
  const value = source['criticality'];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const addImpactPath = (entity: ImpactEntity, path: ImpactPath): void => {
  const identity = `${path.rootId}\u0000${path.pathId}\u0000${path.provenance
    .map(hop => `${hop.context}:${hop.id}:${hop.schemaId}`)
    .join('\u0000')}`;
  if (
    entity.paths.some(
      existing =>
        `${existing.rootId}\u0000${existing.pathId}\u0000${existing.provenance
          .map(hop => `${hop.context}:${hop.id}:${hop.schemaId}`)
          .join('\u0000')}` === identity
    )
  ) {
    return;
  }
  entity.paths.push(path);
  entity.depth = Math.min(entity.depth, path.depth);
};

const groupEntities = (
  entities: readonly ImpactEntity[],
  select: (entity: ImpactEntity) => { key: string | null; label: string }
): EntityTraversalAggregation['groups']['lifecycle'] => {
  const buckets = new Map<string | null, { label: string; entities: ImpactEntity[] }>();
  for (const entity of entities) {
    const { key, label } = select(entity);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { label, entities: [] };
      buckets.set(key, bucket);
    }
    bucket.entities.push(entity);
  }

  const groups = [...buckets.entries()].map(([key, bucket]) => {
    const criticalities = bucket.entities
      .map(entity => entity.criticality)
      .filter((value): value is number => value != null);
    return {
      key,
      label: bucket.label,
      count: bucket.entities.length,
      rank: 0,
      entityIds: bucket.entities.map(entity => entity.entityId),
      highestCriticality: criticalities.length === 0 ? null : Math.max(...criticalities),
      shallowestDepth: Math.min(...bucket.entities.map(entity => entity.depth))
    };
  });

  groups.sort(
    (left, right) =>
      compareCriticalityDescending(left.highestCriticality, right.highestCriticality) ||
      left.shallowestDepth - right.shallowestDepth ||
      right.count - left.count ||
      compareText(left.label, right.label) ||
      compareText(left.key ?? '', right.key ?? '')
  );
  return groups.map((group, index) => ({ ...group, rank: index + 1 }));
};

const toAggregation = (entitiesById: Map<string, ImpactEntity>): EntityTraversalAggregation => {
  const entities = [...entitiesById.values()];
  for (const entity of entities) {
    entity.paths.sort(
      (left, right) =>
        left.depth - right.depth ||
        compareText(left.rootId, right.rootId) ||
        compareText(left.pathId, right.pathId) ||
        compareText(
          left.provenance.map(hop => hop.id).join('\u0000'),
          right.provenance.map(hop => hop.id).join('\u0000')
        )
    );
  }

  entities.sort(
    (left, right) =>
      compareCriticalityDescending(left.criticality, right.criticality) ||
      left.depth - right.depth ||
      compareText(left.entityId, right.entityId)
  );

  const rankedEntities = entities.map((entity, index) => ({ ...entity, rank: index + 1 }));
  return {
    entities: rankedEntities,
    groups: {
      lifecycle: groupEntities(rankedEntities, entity => ({
        key: entity.lifecycleState,
        label: entity.lifecycleState ?? 'Unassigned'
      })),
      owner: groupEntities(rankedEntities, entity => ({
        key: entity.ownerId,
        label: entity.ownerId ?? 'Unassigned'
      })),
      schema: groupEntities(rankedEntities, entity => ({
        key: entity.schemaId,
        label: entity.schemaName
      })),
      criticality: groupEntities(rankedEntities, entity => ({
        key: entity.criticality == null ? null : String(entity.criticality),
        label: entity.criticality == null ? 'Unrated' : String(entity.criticality)
      }))
    }
  };
};

const createImpactEntity = (input: {
  entityId: string;
  entityName: string;
  entitySlug: string;
  schemaId: string;
  schemaName: string;
  ownerId: string | null;
  lifecycleState: string | null;
  criticality: number | null;
  depth: number;
}): ImpactEntity => ({ ...input, paths: [] });

/** Aggregates distinct visible entity terminals while retaining every distinct provenance path. */
export const aggregateEntityTraversalResult = (
  result: EntityTraversalResult,
  schemas: readonly SchemaName[]
): EntityTraversalAggregation => {
  const schemaNames = new Map(schemas.map(schema => [schema.id, schema.name]));
  const entities = new Map<string, ImpactEntity>();

  for (const root of result.roots) {
    for (const pathResult of root.paths) {
      for (const occurrence of pathResult.occurrences) {
        const { terminal, provenance } = occurrence;
        if (terminal.context !== 'entity') continue;

        const source = terminal.source;
        const entityName =
          sourceString(source, '_name') ?? sourceString(source, '_slug') ?? terminal.id;
        let entity = entities.get(terminal.id);
        if (!entity) {
          entity = createImpactEntity({
            entityId: terminal.id,
            entityName,
            entitySlug: sourceString(source, '_slug') ?? terminal.id,
            schemaId: terminal.schemaId,
            schemaName: schemaNames.get(terminal.schemaId) ?? terminal.schemaId,
            ownerId: sourceString(source, '_owner'),
            lifecycleState: sourceString(source, '_lifecycle'),
            criticality: sourceCriticality(source),
            depth: Math.max(0, provenance.length - 1)
          });
          entities.set(terminal.id, entity);
        }

        addImpactPath(entity, {
          rootId: occurrence.rootId,
          pathId: occurrence.pathId,
          depth: Math.max(0, provenance.length - 1),
          provenance: provenance.map(hop => ({ ...hop }))
        });
      }
    }
  }

  return toAggregation(entities);
};

const asTraversalHop = (hop: { entityId: string }): EntityTraversalHop => ({
  context: 'entity',
  id: hop.entityId,
  schemaId: ''
});

/** Adapts permission-filtered dependent results into the same unique-entity aggregation. */
export const aggregateBatchEntityDependents = (
  results: ReadonlyMap<string, EntityDependents>
): EntityTraversalAggregation => {
  const entities = new Map<string, ImpactEntity>();
  for (const [rootId, result] of results) {
    for (const dependent of result.dependents) {
      const path: ImpactPath = {
        rootId,
        pathId: 'dependents',
        depth: dependent.depth,
        provenance: [
          asTraversalHop({ entityId: rootId }),
          ...dependent.viaPath.map(asTraversalHop),
          { context: 'entity', id: dependent.entityId, schemaId: dependent.entitySchemaId }
        ]
      };
      let entity = entities.get(dependent.entityId);
      if (!entity) {
        entity = createImpactEntity({
          entityId: dependent.entityId,
          entityName: dependent.entityName,
          entitySlug: dependent.entitySlug,
          schemaId: dependent.entitySchemaId,
          schemaName: dependent.schemaName,
          ownerId: dependent.ownerId,
          lifecycleState: dependent.lifecycleState,
          criticality: dependent.criticality,
          depth: dependent.depth
        });
        entities.set(dependent.entityId, entity);
      }
      addImpactPath(entity, path);
    }
  }
  return toAggregation(entities);
};

export const aggregateEntityDependents = (
  rootId: string,
  result: EntityDependents
): EntityTraversalAggregation => aggregateBatchEntityDependents(new Map([[rootId, result]]));
