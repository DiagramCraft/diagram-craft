import { useMemo } from 'react';
import type {
  RelationEndpoint,
  RelationField,
  RelationSchema,
  RelationSchemaGroup
} from '@arch-register/api-types/relationSchemaContract';
import type { RelationFieldType } from '../../lib/schemaPresentation';
import {
  getRelationSchemaConstraintViolation,
  getRelationSchemaMigrationRequired,
  useCreateRelationSchema,
  useDeleteRelationSchema,
  useUpdateRelationSchema
} from '../../hooks/useRelationSchemas';
import { createRelationFieldForType } from './relationSchemaSettingsHelpers';
import { firstRemainingId, type SchemaEditorAdapter } from './schemaEditorState';

const EMPTY_ENDPOINT: RelationEndpoint = { schemaIds: [] };

const isValidEndpoint = (endpoint: RelationEndpoint): boolean =>
  endpoint.schemaIds === 'any' || endpoint.schemaIds.length > 0;

/** Relation-type specific draft fields on top of the shared schema editor draft. */
export type RelationEditorExtra = {
  categoryId: string | null;
  inEndpoint: RelationEndpoint;
  outEndpoint: RelationEndpoint;
  uniqueEndpointPair: boolean;
};

export type RelationSchemaAdapter = SchemaEditorAdapter<
  RelationSchema,
  RelationField,
  RelationSchemaGroup,
  RelationEditorExtra,
  RelationFieldType
>;

/** Maps relation schemas to/from the generic schema editor draft and persists them. */
export const useRelationSchemaAdapter = (workspaceSlug: string) => {
  const createRelationSchemaMutation = useCreateRelationSchema(workspaceSlug);
  const updateRelationSchemaMutation = useUpdateRelationSchema(workspaceSlug);
  const deleteRelationSchemaMutation = useDeleteRelationSchema(workspaceSlug);

  const adapter = useMemo<RelationSchemaAdapter>(
    () => ({
      createDraft: schema =>
        schema
          ? {
              name: schema.name,
              categoryId: schema.category?.id ?? null,
              description: schema.description,
              inEndpoint: schema.in,
              outEndpoint: schema.out,
              uniqueEndpointPair: schema.unique_endpoint_pair ?? false,
              fields: schema.fields,
              groups: schema.groups,
              sharedFieldGroupLinks: schema.shared_field_group_links ?? [],
              validationRules: schema.validation_rules ?? [],
              color: schema.color,
              icon: schema.icon
            }
          : {
              name: '',
              categoryId: null,
              description: '',
              inEndpoint: EMPTY_ENDPOINT,
              outEndpoint: EMPTY_ENDPOINT,
              uniqueEndpointPair: false,
              fields: [],
              groups: [],
              sharedFieldGroupLinks: [],
              validationRules: [],
              color: null,
              icon: null
            },
      createField: (id, groupId) =>
        ({ id, name: 'new_field', type: 'text', ...(groupId ? { groupId } : {}) }) as RelationField,
      changeFieldType: (field, newType, _fields, firstEnumId) =>
        createRelationFieldForType(field, newType, firstEnumId),
      hasChanges: (draft, schema) =>
        draft.name !== schema.name ||
        draft.categoryId !== (schema.category?.id ?? null) ||
        draft.description !== schema.description ||
        JSON.stringify(draft.inEndpoint) !== JSON.stringify(schema.in) ||
        JSON.stringify(draft.outEndpoint) !== JSON.stringify(schema.out) ||
        draft.uniqueEndpointPair !== (schema.unique_endpoint_pair ?? false) ||
        JSON.stringify(draft.fields) !== JSON.stringify(schema.fields) ||
        JSON.stringify(draft.groups) !== JSON.stringify(schema.groups) ||
        JSON.stringify(draft.sharedFieldGroupLinks) !==
          JSON.stringify(schema.shared_field_group_links ?? []) ||
        JSON.stringify(draft.validationRules) !== JSON.stringify(schema.validation_rules ?? []) ||
        draft.color !== schema.color ||
        draft.icon !== schema.icon,
      save: async (schema, draft, fieldMigrations) => {
        await updateRelationSchemaMutation.mutateAsync({
          relationSchemaId: schema.id,
          data: {
            name: draft.name,
            category_id: draft.categoryId,
            description: draft.description,
            in: draft.inEndpoint,
            out: draft.outEndpoint,
            unique_endpoint_pair: draft.uniqueEndpointPair,
            fields: draft.fields,
            groups: draft.groups,
            shared_field_group_links: draft.sharedFieldGroupLinks,
            validation_rules: draft.validationRules,
            color: draft.color,
            icon: draft.icon,
            fieldMigrations
          }
        });
      },
      create: draft =>
        createRelationSchemaMutation.mutateAsync({
          name: draft.name,
          category_id: draft.categoryId,
          description: draft.description,
          in: draft.inEndpoint,
          out: draft.outEndpoint,
          unique_endpoint_pair: draft.uniqueEndpointPair,
          fields: draft.fields,
          groups: draft.groups,
          shared_field_group_links: draft.sharedFieldGroupLinks,
          validation_rules: draft.validationRules,
          color: draft.color,
          icon: draft.icon
        }),
      isValid: draft =>
        draft.name.trim() !== '' &&
        isValidEndpoint(draft.inEndpoint) &&
        isValidEndpoint(draft.outEndpoint),
      remove: schema => deleteRelationSchemaMutation.mutateAsync(schema.id).then(() => undefined),
      getMigrationRequired: getRelationSchemaMigrationRequired,
      getConstraintViolation: getRelationSchemaConstraintViolation,
      validationRuleDefaults: () => ({
        id: `rule-${Date.now()}`,
        name: 'New rule',
        expression: 'true',
        message: 'Relation validation failed',
        severity: 'error',
        active: true
      }),
      selectAfterDelete: (items, deletedId) => firstRemainingId(items, deletedId),
      labels: {
        subject: 'relation type',
        itemNoun: 'relation',
        deleteTitle: 'Delete relation type?',
        deleteConfirmLabel: 'Delete type',
        saveError: 'Failed to save relation type',
        createError: 'Failed to create relation type',
        deleteError: 'Failed to delete'
      }
    }),
    [createRelationSchemaMutation, deleteRelationSchemaMutation, updateRelationSchemaMutation]
  );

  return {
    adapter,
    isSaving: createRelationSchemaMutation.isPending || updateRelationSchemaMutation.isPending
  };
};
