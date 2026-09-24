import type { EntityDrawerItem } from '@arch-register/api-types/entityDrawerConfiguration';
import type { TypedRelationField } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';

type TypedRelationListItem = Extract<EntityDrawerItem, { kind: 'typed-relation-list' }>;

export const getTypedRelationAttributeFields = (
  field: Pick<TypedRelationField, 'relationSchemaId'>,
  relationSchemas: RelationSchema[]
): RelationSchema['fields'] =>
  relationSchemas
    .find(relationSchema => relationSchema.id === field.relationSchemaId)
    ?.fields.filter(attributeField => attributeField.archived !== true) ?? [];

export const changeTypedRelationListField = (
  item: TypedRelationListItem,
  fieldId: string
): TypedRelationListItem => ({ ...item, fieldId, attributes: [] });
