import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  exploreViewConfigSchema,
  type ExploreViewConfig
} from '@arch-register/api-types/viewContract';
import type { EntityRelationData } from '../../../hooks/useEntities';
import { getRelationDisplayLabel } from '../../../lib/entityRelations';
import type { EntityRelation } from '@arch-register/api-types/entityContract';

export type ExploreEntity = {
  entityId: string;
  publicId: string;
  name: string;
  slug: string;
  schemaId: string;
  description?: string;
  ownerName?: string | null;
  lifecycleId?: string | null;
  record?: EntityRecord;
};

export type ExploreColumn = {
  index: number;
  direction: 'left' | 'center' | 'right';
  hop: number;
  entities: ExploreEntity[];
};

export type ExploreConnector = {
  fromColumn: number;
  fromEntityId: string;
  fromEntityName: string;
  toColumn: number;
  toEntityId: string;
  toEntityName: string;
  fieldName: string;
  fieldLabel: string;
  kind: EntityRelation['kind'];
};

export type ExploreRelationFieldOption = {
  label: string;
  value: string;
};

export type ExploreGraph = {
  columns: ExploreColumn[];
  connectors: ExploreConnector[];
  duplicateIds: Set<string>;
  visibleEntityIds: string[];
};

export const DEFAULT_EXPLORE_CONFIG: ExploreViewConfig = {
  leftDepth: 1,
  rightDepth: 1,
  relationFieldNames: [], fieldIds: undefined
};

export const normalizeExploreConfig = (
  config: Partial<ExploreViewConfig> | null | undefined
): ExploreViewConfig => ({
  leftDepth: Math.max(0, Math.trunc(config?.leftDepth ?? DEFAULT_EXPLORE_CONFIG.leftDepth)),
  rightDepth: Math.max(0, Math.trunc(config?.rightDepth ?? DEFAULT_EXPLORE_CONFIG.rightDepth)),
  relationFieldNames: [...new Set(config?.relationFieldNames ?? DEFAULT_EXPLORE_CONFIG.relationFieldNames)],
  fieldIds: config?.fieldIds
});

export const parseExploreConfigValue = (raw: string | undefined): ExploreViewConfig | null => {
  if (raw == null) return null;

  try {
    const parsed = JSON.parse(raw);
    const result = exploreViewConfigSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

export const buildRelationFieldOptions = (
  schemas: EntitySchema[]
): ExploreRelationFieldOption[] => {
  const labels = new Map<string, string>();

  for (const schema of schemas) {
    for (const field of schema.fields) {
      if (field.type === 'reference' || field.type === 'containment') {
        labels.set(field.name, field.predicate ?? field.name);
      }
    }
  }

  return [...labels.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ label, value }));
};

export const buildDefaultRelationFieldNames = (schemas: EntitySchema[]): string[] => {
  const names = new Set<string>();

  for (const schema of schemas) {
    for (const field of schema.fields) {
      if (field.type === 'reference') {
        names.add(field.name);
      }
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b));
};

const toCenterEntity = (entity: EntityRecord): ExploreEntity => ({
  entityId: entity._uid,
  publicId: entity._publicId,
  name: entity._name,
  slug: entity._slug,
  schemaId: entity._schema.id,
  description: entity._description,
  ownerName: entity._owner?.name,
  lifecycleId: entity._lifecycle?.id,
  record: entity
});

const toRelatedEntity = (relation: EntityRelation): ExploreEntity => ({
  entityId: relation.entityId,
  publicId: relation.publicId,
  name: relation.entityName,
  slug: relation.entitySlug,
  schemaId: relation.entitySchemaId
});

const shouldIncludeRelation = (
  selectedFieldNames: Set<string>,
  relation: Pick<EntityRelation, 'fieldName' | 'kind'>
) =>
  selectedFieldNames.size === 0
    ? relation.kind !== 'containment'
    : selectedFieldNames.has(relation.fieldName);

const dedupeColumn = (entities: ExploreEntity[]) => {
  const seen = new Set<string>();
  return entities.filter(entity => {
    if (seen.has(entity.entityId)) return false;
    seen.add(entity.entityId);
    return true;
  });
};

export const buildExploreGraph = ({
  centerEntities,
  relationsMap,
  config
}: {
  centerEntities: EntityRecord[];
  relationsMap: Map<string, EntityRelationData>;
  config: ExploreViewConfig;
}): ExploreGraph => {
  const normalizedConfig = normalizeExploreConfig(config);
  const selectedFieldNames = new Set(normalizedConfig.relationFieldNames);
  const columns = new Map<number, ExploreColumn>();
  const connectors: ExploreConnector[] = [];

  const centerColumn: ExploreColumn = {
    index: 0,
    direction: 'center',
    hop: 0,
    entities: dedupeColumn(centerEntities.map(toCenterEntity))
  };
  columns.set(0, centerColumn);

  let currentLeft = centerColumn.entities;
  for (let hop = 1; hop <= normalizedConfig.leftDepth; hop++) {
    const nextEntities: ExploreEntity[] = [];

    for (const entity of currentLeft) {
      const relationData = relationsMap.get(entity.entityId);
      if (!relationData) continue;

      for (const relation of relationData.incoming) {
        if (!shouldIncludeRelation(selectedFieldNames, relation)) continue;
        nextEntities.push(toRelatedEntity(relation));
        connectors.push({
          fromColumn: -hop,
          fromEntityId: relation.entityId,
          fromEntityName: relation.entityName,
          toColumn: 1 - hop,
          toEntityId: entity.entityId,
          toEntityName: entity.name || entity.slug,
          fieldName: relation.fieldName,
          fieldLabel: getRelationDisplayLabel(relation),
          kind: relation.kind
        });
      }
    }

    const entities = dedupeColumn(nextEntities);
    columns.set(-hop, { index: -hop, direction: 'left', hop, entities });
    currentLeft = entities;
  }

  let currentRight = centerColumn.entities;
  for (let hop = 1; hop <= normalizedConfig.rightDepth; hop++) {
    const nextEntities: ExploreEntity[] = [];

    for (const entity of currentRight) {
      const relationData = relationsMap.get(entity.entityId);
      if (!relationData) continue;

      for (const relation of relationData.outgoing) {
        if (!shouldIncludeRelation(selectedFieldNames, relation)) continue;
        nextEntities.push(toRelatedEntity(relation));
        connectors.push({
          fromColumn: hop - 1,
          fromEntityId: entity.entityId,
          fromEntityName: entity.name || entity.slug,
          toColumn: hop,
          toEntityId: relation.entityId,
          toEntityName: relation.entityName,
          fieldName: relation.fieldName,
          fieldLabel: getRelationDisplayLabel(relation),
          kind: relation.kind
        });
      }
    }

    const entities = dedupeColumn(nextEntities);
    columns.set(hop, { index: hop, direction: 'right', hop, entities });
    currentRight = entities;
  }

  const orderedColumns = [...columns.values()].sort((a, b) => a.index - b.index);
  const visibleEntityIds = orderedColumns.flatMap(column => column.entities.map(entity => entity.entityId));

  const counts = new Map<string, number>();
  for (const entityId of visibleEntityIds) {
    counts.set(entityId, (counts.get(entityId) ?? 0) + 1);
  }

  const duplicateIds = new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([entityId]) => entityId)
  );

  return {
    columns: orderedColumns,
    connectors,
    duplicateIds,
    visibleEntityIds: [...new Set(visibleEntityIds)]
  };
};
