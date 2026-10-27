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
  availableSchemaIds: string[];
  /** Incoming relations of this column's entities, i.e. what the next column to the left could show
   *  (before that column's own relation filter). Only meaningful for the center and left columns. */
  relationsToLeft: ExploreRelationOption[];
  /** Outgoing relations of this column's entities, i.e. what the next column to the right could
   *  show (before that column's own relation filter). Only meaningful for the center and right columns. */
  relationsToRight: ExploreRelationOption[];
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
): ExploreViewConfig => {
  const columnSchemaIds = Object.fromEntries(
    Object.entries(config?.columnSchemaIds ?? {}).filter(
      ([columnIndex, schemaId]) => /^-?[1-9]\d*$/.test(columnIndex) && schemaId.length > 0
    )
  );

  const leftDepth = Math.max(0, Math.trunc(config?.leftDepth ?? DEFAULT_EXPLORE_CONFIG.leftDepth));
  const rightDepth = Math.max(
    0,
    Math.trunc(config?.rightDepth ?? DEFAULT_EXPLORE_CONFIG.rightDepth)
  );

  const columnRelationKeys: Record<string, string[]> = Object.fromEntries(
    Object.entries(config?.columnRelationKeys ?? {})
      .filter(([columnIndex]) => /^-?[1-9]\d*$/.test(columnIndex))
      .map(([columnIndex, keys]) => [columnIndex, [...new Set(keys)]])
  );
  // A legacy global relation filter applies to every column that exists now.
  const legacyKeys = [...new Set(config?.relationKeys ?? [])];
  if (legacyKeys.length > 0) {
    const columnIndexes = [
      ...Array.from({ length: leftDepth }, (_, i) => String(-(i + 1))),
      ...Array.from({ length: rightDepth }, (_, i) => String(i + 1))
    ];
    for (const columnIndex of columnIndexes) {
      if (columnRelationKeys[columnIndex] === undefined) {
        columnRelationKeys[columnIndex] = legacyKeys;
      }
    }
  }

  return {
    leftDepth,
    rightDepth,
    relationFieldNames: [
      ...new Set(config?.relationFieldNames ?? DEFAULT_EXPLORE_CONFIG.relationFieldNames)
    ],
    relationKeys: undefined,
    columnRelationKeys: Object.keys(columnRelationKeys).length > 0 ? columnRelationKeys : undefined,
    columnSchemaIds: Object.keys(columnSchemaIds).length > 0 ? columnSchemaIds : undefined,
    fieldIds: config?.fieldIds
  };
};

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
      if (
        field.type === 'reference' ||
        field.type === 'containment' ||
        isTypedRelationField(field)
      ) {
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
  return selectedFieldNames.size === 0 || selectedFieldNames.has(relation.fieldName);
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

const collectRelationOption = (
  options: Map<string, ExploreRelationOption>,
  sourceEntitySchemaId: string,
  targetEntitySchemaId: string,
  relation: EntityRelation
) => {
  const relationKey = buildRelationKey(sourceEntitySchemaId, targetEntitySchemaId, relation);
  if (options.has(relationKey)) return;
  options.set(relationKey, {
    relationKey,
    sourceEntitySchemaId,
    targetEntitySchemaId,
    fieldLabel: getRelationDisplayLabel(relation),
    kind: relation.kind
  });
};

const sortRelationOptions = (options: Map<string, ExploreRelationOption>) =>
  [...options.values()].sort((a, b) =>
    `${a.sourceEntitySchemaId} ${a.fieldLabel} ${a.targetEntitySchemaId}`.localeCompare(
      `${b.sourceEntitySchemaId} ${b.fieldLabel} ${b.targetEntitySchemaId}`
    )
  );

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
  const columns = new Map<number, ExploreColumn>();
  const connectors: ExploreConnector[] = [];

  const centerColumn: ExploreColumn = {
    index: 0,
    direction: 'center',
    hop: 0,
    entities: dedupeColumn(centerEntities.map(toCenterEntity)).filter(
      entity => !excludedEntityIds.has(entity.entityId)
    ),
    availableSchemaIds: [],
    relationsToLeft: [],
    relationsToRight: []
  };
  columns.set(0, centerColumn);

  let currentLeft = centerColumn.entities;
  for (let hop = 1; hop <= normalizedConfig.leftDepth; hop++) {
    const nextEntities: ExploreEntity[] = [];
    const availableSchemaIds = new Set<string>();
    const selectedRelationKeys = new Set(normalizedConfig.columnRelationKeys?.[String(-hop)] ?? []);
    const selectedSchemaId = normalizedConfig.columnSchemaIds?.[String(-hop)];

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
        availableSchemaIds.add(relation.entitySchemaId);
        if (selectedSchemaId != null && relation.entitySchemaId !== selectedSchemaId) continue;
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
    columns.set(-hop, {
      index: -hop,
      direction: 'left',
      hop,
      entities,
      availableSchemaIds: [...availableSchemaIds],
      relationsToLeft: [],
      relationsToRight: []
    });
    currentLeft = entities;
  }

  let currentRight = centerColumn.entities;
  for (let hop = 1; hop <= normalizedConfig.rightDepth; hop++) {
    const nextEntities: ExploreEntity[] = [];
    const availableSchemaIds = new Set<string>();
    const selectedRelationKeys = new Set(normalizedConfig.columnRelationKeys?.[String(hop)] ?? []);
    const selectedSchemaId = normalizedConfig.columnSchemaIds?.[String(hop)];

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
        availableSchemaIds.add(relation.entitySchemaId);
        if (selectedSchemaId != null && relation.entitySchemaId !== selectedSchemaId) continue;
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
    columns.set(hop, {
      index: hop,
      direction: 'right',
      hop,
      entities,
      availableSchemaIds: [...availableSchemaIds],
      relationsToLeft: [],
      relationsToRight: []
    });
    currentRight = entities;
  }

  // Which relations could lead out of each column: the options of that column's "Filter relations".
  // Computed from the column's own entities, so they exist even beyond the last visible column.
  for (const column of columns.values()) {
    if (column.direction !== 'right') {
      const options = new Map<string, ExploreRelationOption>();
      for (const entity of column.entities) {
        for (const relation of relationsMap.get(entity.entityId)?.incoming ?? []) {
          if (excludedEntityIds.has(relation.entityId)) continue;
          collectRelationOption(options, relation.entitySchemaId, entity.schemaId, relation);
        }
      }
      column.relationsToLeft = sortRelationOptions(options);
    }
    if (column.direction !== 'left') {
      const options = new Map<string, ExploreRelationOption>();
      for (const entity of column.entities) {
        for (const relation of relationsMap.get(entity.entityId)?.outgoing ?? []) {
          if (excludedEntityIds.has(relation.entityId)) continue;
          collectRelationOption(options, entity.schemaId, relation.entitySchemaId, relation);
        }
      }
      column.relationsToRight = sortRelationOptions(options);
    }
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
