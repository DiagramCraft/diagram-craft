import type { BlastRadiusPath } from '../../../hooks/useBlastRadius';
import type { BlastRadiusEntity } from '../../../lib/blastRadiusFilters';
import type { BlastRadiusGroup } from '../../../sections/entities/components/BlastRadiusPanel';

export const PROVIDES_PATH_ID = 'provides-api';
export const CONSUMES_PATH_ID = 'consumes-api';
export const API_BLAST_RADIUS_MAX_DEPTH = 2;

const typedRelationPath = (id: string, relationSchemaId: string): BlastRadiusPath => ({
  id,
  steps: [{ kind: 'unboundTypedRelation', relationSchemaId, direction: 'both' }]
});

const isDepth1Via = (entity: BlastRadiusEntity, pathId: string) =>
  entity.depth === 1 && entity.paths.some(path => path.pathId === pathId && path.depth === 1);

const providers = (entities: BlastRadiusEntity[]) =>
  entities.filter(entity => isDepth1Via(entity, PROVIDES_PATH_ID));
const consumers = (entities: BlastRadiusEntity[]) =>
  entities.filter(entity => isDepth1Via(entity, CONSUMES_PATH_ID));
const secondOrder = (entities: BlastRadiusEntity[]) => {
  const depth1Ids = new Set([...providers(entities), ...consumers(entities)].map(e => e.entityId));
  return entities.filter(entity => !depth1Ids.has(entity.entityId));
};

export const API_BLAST_RADIUS_GROUPS: readonly BlastRadiusGroup[] = [
  {
    id: 'providers',
    label: 'Providers',
    emptyText: 'No provider relation recorded.',
    select: providers
  },
  {
    id: 'consumers',
    label: 'Direct consumers',
    emptyText: 'No consumer registered against this API.',
    select: consumers
  },
  {
    id: 'second-order',
    label: 'Second order',
    emptyText: 'Nothing reachable two hops out.',
    select: secondOrder,
    showVia: true
  }
];

export const API_BLAST_RADIUS_NO_PATHS_STATE = {
  title: 'Impact cannot be computed',
  subtitle:
    "This workspace's `api` schema has no Provides API/Consumes API typed-relation fields configured."
};

export const buildApiBlastRadiusPaths = (
  providersRelationSchemaId: string | null,
  consumersRelationSchemaId: string | null
): BlastRadiusPath[] => [
  ...(providersRelationSchemaId
    ? [typedRelationPath(PROVIDES_PATH_ID, providersRelationSchemaId)]
    : []),
  ...(consumersRelationSchemaId
    ? [typedRelationPath(CONSUMES_PATH_ID, consumersRelationSchemaId)]
    : [])
];
