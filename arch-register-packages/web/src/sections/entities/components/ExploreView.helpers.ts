import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  isReferenceOrContainmentField,
  isTypedRelationField
} from '@arch-register/api-types/schemaContract';
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
  fromEntitySchemaId: string;
  toColumn: number;
  toEntityId: string;
  toEntityName: string;
  toEntitySchemaId: string;
  fieldName: string;
  fieldLabel: string;
  kind: EntityRelation['kind'];
  relationKey: string;
};

export type ExploreRelationOption = {
  relationKey: string;
  sourceEntitySchemaId: string;
  targetEntitySchemaId: string;
  fieldLabel: string;
  kind: EntityRelation['kind'];
};

export type ExploreRelationFieldOption = {
  label: string;
  value: string;
  kind: 'typed' | 'reference' | 'containment';
  relationSchemaId?: string;
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
  relationFieldNames: [],
  fieldIds: undefined
};

export const normalizeExploreConfig = (
  config: Partial<ExploreViewConfig> | null | undefined
): ExploreViewConfig => ({
  leftDepth: Math.max(0, Math.trunc(config?.leftDepth ?? DEFAULT_EXPLORE_CONFIG.leftDepth)),
  rightDepth: Math.max(0, Math.trunc(config?.rightDepth ?? DEFAULT_EXPLORE_CONFIG.rightDepth)),
  relationFieldNames: [
    ...new Set(config?.relationFieldNames ?? DEFAULT_EXPLORE_CONFIG.relationFieldNames)
  ],
  relationKeys: config?.relationKeys == null ? undefined : [...new Set(config.relationKeys)],
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
  const options = new Map<string, ExploreRelationFieldOption>();

  for (const schema of schemas) {
    for (const field of schema.fields) {
      if (isReferenceOrContainmentField(field)) {
        options.set(field.name, {
          value: field.name,
          label: field.predicate ?? field.name,
          kind: field.type
        });
      } else if (isTypedRelationField(field)) {
        options.set(field.name, {
          value: field.name,
          label: field.name,
          kind: 'typed',
          relationSchemaId: field.relationSchemaId
        });
      }
    }
  }

  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
};

export const buildDefaultRelationFieldNames = (schemas: EntitySchema[]): string[] => {
  const names = new Set<string>();

  for (const schema of schemas) {
    for (const field of schema.fields) {
      if (field.type === 'reference' || isTypedRelationField(field)) {
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

export const buildRelationKey = (
  sourceEntitySchemaId: string,
  targetEntitySchemaId: string,
  relation: Pick<EntityRelation, 'fieldName' | 'fieldPredicate'>
) =>
  JSON.stringify([sourceEntitySchemaId, getRelationDisplayLabel(relation), targetEntitySchemaId]);

const shouldIncludeRelation = (
  selectedFieldNames: Set<string>,
  selectedRelationKeys: Set<string>,
  sourceEntitySchemaId: string,
  targetEntitySchemaId: string,
  relation: Pick<EntityRelation, 'fieldName' | 'fieldPredicate' | 'kind' | 'relationId'>
) => {
  if (selectedRelationKeys.size > 0) {
    return selectedRelationKeys.has(
      buildRelationKey(sourceEntitySchemaId, targetEntitySchemaId, relation)
    );
  }
  return selectedFieldNames.size === 0
    ? relation.kind !== 'containment'
    : selectedFieldNames.has(relation.fieldName);
};

const toExploreConnector = ({
  sourceEntityId,
  sourceEntityName,
  sourceEntitySchemaId,
  targetEntityId,
  targetEntityName,
  targetEntitySchemaId,
  fromColumn,
  toColumn,
  relation
}: {
  sourceEntityId: string;
  sourceEntityName: string;
  sourceEntitySchemaId: string;
  targetEntityId: string;
  targetEntityName: string;
  targetEntitySchemaId: string;
  fromColumn: number;
  toColumn: number;
  relation: EntityRelation;
}): ExploreConnector => ({
  fromColumn,
  fromEntityId: sourceEntityId,
  fromEntityName: sourceEntityName,
  fromEntitySchemaId: sourceEntitySchemaId,
  toColumn,
  toEntityId: targetEntityId,
  toEntityName: targetEntityName,
  toEntitySchemaId: targetEntitySchemaId,
  fieldName: relation.fieldName,
  fieldLabel: getRelationDisplayLabel(relation),
  kind: relation.kind,
  relationKey: buildRelationKey(sourceEntitySchemaId, targetEntitySchemaId, relation)
});

export const buildExploreRelationOptions = (
  connectors: ExploreConnector[]
): ExploreRelationOption[] => {
  const options = new Map<string, ExploreRelationOption>();

  for (const connector of connectors) {
    options.set(connector.relationKey, {
      relationKey: connector.relationKey,
      sourceEntitySchemaId: connector.fromEntitySchemaId,
      targetEntitySchemaId: connector.toEntitySchemaId,
      fieldLabel: connector.fieldLabel,
      kind: connector.kind
    });
  }

  return [...options.values()].sort((a, b) =>
    `${a.sourceEntitySchemaId} ${a.fieldLabel} ${a.targetEntitySchemaId}`.localeCompare(
      `${b.sourceEntitySchemaId} ${b.fieldLabel} ${b.targetEntitySchemaId}`
    )
  );
};

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
  config,
  excludedEntityIds = new Set<string>()
}: {
  centerEntities: EntityRecord[];
  relationsMap: Map<string, EntityRelationData>;
  config: ExploreViewConfig;
  excludedEntityIds?: ReadonlySet<string>;
}): ExploreGraph => {
  const normalizedConfig = normalizeExploreConfig(config);
  const selectedFieldNames = new Set(normalizedConfig.relationFieldNames);
  const selectedRelationKeys = new Set(normalizedConfig.relationKeys ?? []);
  const columns = new Map<number, ExploreColumn>();
  const connectors: ExploreConnector[] = [];

  const centerColumn: ExploreColumn = {
    index: 0,
    direction: 'center',
    hop: 0,
    entities: dedupeColumn(centerEntities.map(toCenterEntity)).filter(
      entity => !excludedEntityIds.has(entity.entityId)
    )
  };
  columns.set(0, centerColumn);

  let currentLeft = centerColumn.entities;
  for (let hop = 1; hop <= normalizedConfig.leftDepth; hop++) {
    const nextEntities: ExploreEntity[] = [];

    for (const entity of currentLeft) {
      const relationData = relationsMap.get(entity.entityId);
      if (!relationData) continue;

      for (const relation of relationData.incoming) {
        if (excludedEntityIds.has(relation.entityId)) continue;
        if (
          !shouldIncludeRelation(
            selectedFieldNames,
            selectedRelationKeys,
            relation.entitySchemaId,
            entity.schemaId,
            relation
          )
        )
          continue;
        nextEntities.push(toRelatedEntity(relation));
        connectors.push(
          toExploreConnector({
            sourceEntityId: relation.entityId,
            sourceEntityName: relation.entityName,
            sourceEntitySchemaId: relation.entitySchemaId,
            targetEntityId: entity.entityId,
            targetEntityName: entity.name ?? entity.slug,
            targetEntitySchemaId: entity.schemaId,
            fromColumn: -hop,
            toColumn: 1 - hop,
            relation
          })
        );
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
        if (excludedEntityIds.has(relation.entityId)) continue;
        if (
          !shouldIncludeRelation(
            selectedFieldNames,
            selectedRelationKeys,
            entity.schemaId,
            relation.entitySchemaId,
            relation
          )
        )
          continue;
        nextEntities.push(toRelatedEntity(relation));
        connectors.push(
          toExploreConnector({
            sourceEntityId: entity.entityId,
            sourceEntityName: entity.name ?? entity.slug,
            sourceEntitySchemaId: entity.schemaId,
            targetEntityId: relation.entityId,
            targetEntityName: relation.entityName,
            targetEntitySchemaId: relation.entitySchemaId,
            fromColumn: hop - 1,
            toColumn: hop,
            relation
          })
        );
      }
    }

    const entities = dedupeColumn(nextEntities);
    columns.set(hop, { index: hop, direction: 'right', hop, entities });
    currentRight = entities;
  }

  const orderedColumns = [...columns.values()].sort((a, b) => a.index - b.index);
  const visibleEntityIds = orderedColumns.flatMap(column =>
    column.entities.map(entity => entity.entityId)
  );

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
