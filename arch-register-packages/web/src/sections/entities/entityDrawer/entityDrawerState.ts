import type { EntityRecord } from '@arch-register/api-types/entityContract';
import {
  ENTITY_DRAWER_METADATA_SLOTS,
  ENTITY_DRAWER_SLOTS,
  resolveEntityDrawerSlotItemPresentation,
  type EntityDrawerBadge,
  type EntityDrawerDiagnostic,
  type EntityDrawerMetadataSlot,
  type EntityDrawerItem,
  type EntityDrawerProfile
} from '@arch-register/api-types/entityDrawerConfiguration';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';
import { resolveFieldAccess } from '../../../lib/fieldGroupAccess';
import {
  providerSupportsContext,
  type EntityDrawerProviderContext,
  type EntityDrawerProviderDefinition,
  type EntityDrawerProviderRegistry
} from './EntityDrawerProviderRegistry';

export type EntityDrawerFieldGroupAccess = (
  accessControl: FieldGroupAccessControl | undefined
) => FieldGroupAccess;

export type ResolvedEntityDrawerItem = {
  item: EntityDrawerItem;
  label: string;
  field?: EntitySchema['fields'][number];
  provider?: EntityDrawerProviderDefinition;
};

export type ResolvedEntityDrawerSection = Omit<EntityDrawerProfile['sections'][number], 'items'> & {
  items: ResolvedEntityDrawerItem[];
};

export type ResolvedEntityDrawerBadge = {
  badge: EntityDrawerBadge;
  label: string;
  field?: EntitySchema['fields'][number];
};

export type EntityDrawerRenderModel = {
  badges: ResolvedEntityDrawerBadge[];
  sections: ResolvedEntityDrawerSection[];
  diagnostics: EntityDrawerDiagnostic[];
};

const isMeaningfulValue = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

export const entityDrawerMetadataValue = (
  entity: EntityRecord,
  slot: EntityDrawerMetadataSlot
): unknown => {
  switch (slot) {
    case 'slug':
      return entity._slug;
    case 'description':
      return entity._description;
    case 'owner':
      return entity._owner;
    case 'lifecycle':
      return entity._lifecycle;
    case 'targetLifecycle':
      return entity._targetLifecycle;
    case 'targetLifecycleDate':
      return entity._targetLifecycleDate;
    case 'tags':
      return entity._tags;
    case 'publicId':
      return entity._publicId;
    case 'namespace':
      return entity._namespace;
  }
};

const metadataLabel = (slot: string): string =>
  ENTITY_DRAWER_METADATA_SLOTS.find(candidate => candidate.id === slot)?.label ?? slot;

const slotLabel = (slotId: string): string =>
  ENTITY_DRAWER_SLOTS.find(candidate => candidate.id === slotId)?.label ?? slotId;

const resolveChildrenItem = ({
  item,
  schema,
  schemas,
  sectionId,
  diagnostics
}: {
  item: Extract<EntityDrawerItem, { kind: 'children' }>;
  schema: EntitySchema;
  schemas: EntitySchema[];
  sectionId: string;
  diagnostics: EntityDrawerDiagnostic[];
}): ResolvedEntityDrawerItem | null => {
  const childSchema = schemas.find(candidate => candidate.id === item.childSchemaId);
  const field = childSchema?.fields.find(candidate => candidate.id === item.fieldId);
  if (
    !childSchema ||
    !field ||
    field.archived ||
    field.type !== 'containment' ||
    field.schemaId !== schema.id
  ) {
    diagnostics.push({
      code: 'invalid_children_target',
      schemaId: schema.id,
      sectionId,
      itemId: `${item.childSchemaId}:${item.fieldId}`,
      message: `Drawer children target '${item.childSchemaId}.${item.fieldId}' is missing, archived, or does not contain this schema.`
    });
    return null;
  }
  return { item, label: item.label ?? 'Children' };
};

const supportsSubtreeRollup = (schema: EntitySchema): boolean =>
  schema.fields.some(candidate => candidate.id === 'parent' && candidate.type === 'containment');

const resolveRollupItem = ({
  item,
  schema,
  schemas,
  sectionId,
  diagnostics
}: {
  item: Extract<EntityDrawerItem, { kind: 'rollup' }>;
  schema: EntitySchema;
  schemas: EntitySchema[];
  sectionId: string;
  diagnostics: EntityDrawerDiagnostic[];
}): ResolvedEntityDrawerItem | null => {
  if (item.traversal) {
    const sourceSchema = schemas.find(candidate => candidate.id === item.sourceSchemaId);
    const sourceField = sourceSchema?.fields.find(candidate => candidate.id === item.fieldId);
    if (
      !sourceSchema ||
      !sourceField ||
      sourceField.archived ||
      (sourceField.type !== 'number' && sourceField.type !== 'currency')
    ) {
      diagnostics.push({
        code: 'missing_or_archived_field',
        schemaId: schema.id,
        sectionId,
        itemId: `${item.sourceSchemaId ?? 'source'}.${item.fieldId}`,
        message: `Roll-up source field '${item.sourceSchemaId ?? 'source'}.${item.fieldId}' is missing, archived, or not numeric.`
      });
      return null;
    }
    return { item, field: sourceField, label: item.label ?? sourceField.name };
  }
  if (!supportsSubtreeRollup(schema)) {
    diagnostics.push({
      code: 'unsupported_rollup_schema',
      schemaId: schema.id,
      sectionId,
      itemId: item.fieldId,
      message: `Drawer roll-up requires a 'parent' containment field on '${schema.id}'.`
    });
    return null;
  }
  const field = schema.fields.find(candidate => candidate.id === item.fieldId);
  if (!field || field.archived || (field.type !== 'number' && field.type !== 'currency')) {
    diagnostics.push({
      code: 'missing_or_archived_field',
      schemaId: schema.id,
      sectionId,
      itemId: item.fieldId,
      message: `Roll-up field '${item.fieldId}' is missing, archived, or not numeric.`
    });
    return null;
  }
  return { item, field, label: item.label ?? field.name };
};

const resolveRollupLeafCountItem = ({
  item,
  schema,
  sectionId,
  diagnostics
}: {
  item: Extract<EntityDrawerItem, { kind: 'rollup-leaf-count' }>;
  schema: EntitySchema;
  sectionId: string;
  diagnostics: EntityDrawerDiagnostic[];
}): ResolvedEntityDrawerItem | null => {
  if (!supportsSubtreeRollup(schema)) {
    diagnostics.push({
      code: 'unsupported_rollup_schema',
      schemaId: schema.id,
      sectionId,
      itemId: item.kind,
      message: `Drawer roll-up requires a 'parent' containment field on '${schema.id}'.`
    });
    return null;
  }
  return { item, label: item.label ?? 'Leaf count' };
};

const fieldAccess = (
  schema: EntitySchema,
  field: EntitySchema['fields'][number],
  getFieldGroupAccess: EntityDrawerFieldGroupAccess
): FieldGroupAccess => resolveFieldAccess(schema, field, getFieldGroupAccess);

const fieldDiagnostic = (
  item: Extract<EntityDrawerItem, { kind: 'field' | 'relation' }>,
  schemaId: string,
  sectionId: string
): EntityDrawerDiagnostic => ({
  code: item.kind === 'relation' ? 'missing_relation_field' : 'missing_or_archived_field',
  schemaId,
  sectionId,
  itemId: item.fieldId,
  message: `Drawer field '${item.fieldId}' is missing or inaccessible.`
});

const resolveFieldItem = ({
  item,
  schema,
  sectionId,
  getFieldGroupAccess,
  diagnostics
}: {
  item: Extract<EntityDrawerItem, { kind: 'field' | 'relation' }>;
  schema: EntitySchema;
  sectionId: string;
  getFieldGroupAccess: EntityDrawerFieldGroupAccess;
  diagnostics: EntityDrawerDiagnostic[];
}): ResolvedEntityDrawerItem | null => {
  const field = schema.fields.find(candidate => candidate.id === item.fieldId);
  if (!field || field.archived) {
    diagnostics.push(fieldDiagnostic(item, schema.id, sectionId));
    return null;
  }
  if (
    item.kind === 'relation' &&
    field.type !== 'reference' &&
    field.type !== 'containment' &&
    field.type !== 'typedRelation'
  ) {
    diagnostics.push({
      code: 'missing_relation_field',
      schemaId: schema.id,
      sectionId,
      itemId: item.fieldId,
      message: `Drawer relation '${item.fieldId}' is no longer a relation field.`
    });
    return null;
  }
  if (fieldAccess(schema, field, getFieldGroupAccess) === 'none') return null;
  const resolvedItem =
    item.kind === 'relation' && field.type === 'typedRelation' && item.presentation === undefined
      ? { ...item, presentation: 'mini-panel' as const }
      : item;
  return { item: resolvedItem, field, label: item.label ?? field.name };
};

const resolveTypedRelationListItem = ({
  item,
  schema,
  sectionId,
  getFieldGroupAccess,
  diagnostics
}: {
  item: Extract<EntityDrawerItem, { kind: 'typed-relation-list' }>;
  schema: EntitySchema;
  sectionId: string;
  getFieldGroupAccess: EntityDrawerFieldGroupAccess;
  diagnostics: EntityDrawerDiagnostic[];
}): ResolvedEntityDrawerItem | null => {
  const field = schema.fields.find(candidate => candidate.id === item.fieldId);
  if (!field || field.archived || field.type !== 'typedRelation') {
    diagnostics.push({
      code: 'missing_relation_field',
      schemaId: schema.id,
      sectionId,
      itemId: item.fieldId,
      message: `Drawer typed-relation-list field '${item.fieldId}' is missing or is no longer a typed relation.`
    });
    return null;
  }
  if (fieldAccess(schema, field, getFieldGroupAccess) === 'none') return null;
  return { item, field, label: item.label ?? field.name };
};

const resolveBadge = ({
  badge,
  entity,
  schema,
  getFieldGroupAccess,
  diagnostics
}: {
  badge: EntityDrawerBadge;
  entity: EntityRecord;
  schema: EntitySchema;
  getFieldGroupAccess: EntityDrawerFieldGroupAccess;
  diagnostics: EntityDrawerDiagnostic[];
}): ResolvedEntityDrawerBadge | null => {
  if (badge.kind === 'metadata') {
    return isMeaningfulValue(entityDrawerMetadataValue(entity, badge.slot))
      ? { badge, label: badge.label ?? metadataLabel(badge.slot) }
      : null;
  }
  const field = schema.fields.find(candidate => candidate.id === badge.fieldId);
  if (!field || field.archived) {
    diagnostics.push({
      code: 'missing_or_archived_field',
      schemaId: schema.id,
      itemId: badge.fieldId,
      message: `Drawer badge field '${badge.fieldId}' is missing or archived.`
    });
    return null;
  }
  if (fieldAccess(schema, field, getFieldGroupAccess) === 'none') return null;
  if (!isMeaningfulValue(entity[field.id])) return null;
  return { badge, field, label: badge.label ?? field.name };
};

export const resolveEntityDrawerRenderModel = ({
  entity,
  schema,
  profile,
  providerRegistry,
  providerContext,
  getFieldGroupAccess
}: {
  entity: EntityRecord;
  schema: EntitySchema;
  profile: EntityDrawerProfile;
  providerRegistry: EntityDrawerProviderRegistry;
  providerContext: EntityDrawerProviderContext;
  getFieldGroupAccess: EntityDrawerFieldGroupAccess;
}): EntityDrawerRenderModel => {
  const diagnostics: EntityDrawerDiagnostic[] = [];
  const badges = profile.header.badges.flatMap(badge => {
    const resolved = resolveBadge({
      badge,
      entity,
      schema,
      getFieldGroupAccess,
      diagnostics
    });
    return resolved ? [resolved] : [];
  });
  const sections = profile.sections.flatMap(section => {
    const items = section.items.flatMap(item => {
      if (item.kind === 'placeholder') {
        return [{ item, label: item.message }];
      }
      if (item.kind === 'query') {
        return [{ item, label: item.label ?? 'Query' }];
      }
      if (item.kind === 'metadata') {
        return isMeaningfulValue(entityDrawerMetadataValue(entity, item.slot))
          ? [{ item, label: item.label ?? metadataLabel(item.slot) }]
          : [];
      }
      if (item.kind === 'slot') {
        const provider = providerRegistry.get(item.slotId);
        if (!provider) {
          diagnostics.push({
            code: 'unsupported_slot',
            schemaId: schema.id,
            sectionId: section.id,
            itemId: item.slotId,
            message: `Unsupported drawer slot '${item.slotId}'.`
          });
          return [];
        }
        if (!providerSupportsContext(provider, providerContext)) {
          diagnostics.push({
            code: 'unsupported_slot_for_schema',
            schemaId: schema.id,
            sectionId: section.id,
            itemId: item.slotId,
            message: `Drawer slot '${item.slotId}' is not available for this entity.`
          });
          return [];
        }
        return [
          {
            item: resolveEntityDrawerSlotItemPresentation(item),
            label: item.label ?? slotLabel(item.slotId),
            provider
          }
        ];
      }
      if (item.kind === 'children') {
        const resolved = resolveChildrenItem({
          item,
          schema,
          schemas: providerContext.schemas,
          sectionId: section.id,
          diagnostics
        });
        return resolved ? [resolved] : [];
      }
      if (item.kind === 'rollup') {
        const resolved = resolveRollupItem({
          item,
          schema,
          schemas: providerContext.schemas,
          sectionId: section.id,
          diagnostics
        });
        return resolved ? [resolved] : [];
      }
      if (item.kind === 'rollup-leaf-count') {
        const resolved = resolveRollupLeafCountItem({
          item,
          schema,
          sectionId: section.id,
          diagnostics
        });
        return resolved ? [resolved] : [];
      }
      if (item.kind === 'typed-relation-list') {
        const resolved = resolveTypedRelationListItem({
          item,
          schema,
          sectionId: section.id,
          getFieldGroupAccess,
          diagnostics
        });
        return resolved ? [resolved] : [];
      }
      const resolved = resolveFieldItem({
        item,
        schema,
        sectionId: section.id,
        getFieldGroupAccess,
        diagnostics
      });
      return resolved ? [resolved] : [];
    });
    return items.length > 0 ? [{ ...section, items }] : [];
  });

  return { badges, sections, diagnostics };
};
