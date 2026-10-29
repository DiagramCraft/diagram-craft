import { useMemo } from 'react';
import type {
  DetailLayoutConfig,
  EntitySchema,
  EntityTemplate,
  SchemaField,
  SchemaGroup
} from '@arch-register/api-types/schemaContract';
import type { FieldType } from '../../lib/schemaPresentation';
import {
  getSchemaMigrationRequired,
  useCreateSchema,
  useDeleteSchema,
  useUpdateSchema
} from '../../hooks/useSchemas';
import {
  createSchemaFieldForType,
  removeTemplateField,
  updateTemplateFieldId
} from './schemaSettingsHelpers';
import { firstRemainingId, type SchemaEditorAdapter } from './schemaEditorState';

/** Entity-type specific draft fields on top of the shared schema editor draft. */
export type EntityEditorExtra = {
  keyPrefix: string;
  categoryId: string | null;
  templates: EntityTemplate[];
  detailLayoutEnabled: boolean;
  // Retains the last-edited custom layout even while disabled, so re-enabling doesn't lose work.
  detailLayout: DetailLayoutConfig | undefined;
};

export type EntitySchemaAdapter = SchemaEditorAdapter<
  EntitySchema,
  SchemaField,
  SchemaGroup,
  EntityEditorExtra,
  FieldType
>;

/** Maps entity schemas to/from the generic schema editor draft and persists them. */
export const useEntitySchemaAdapter = (workspaceSlug: string) => {
  const createSchemaMutation = useCreateSchema(workspaceSlug);
  const updateSchemaMutation = useUpdateSchema(workspaceSlug);
  const deleteSchemaMutation = useDeleteSchema(workspaceSlug);

  const adapter = useMemo<EntitySchemaAdapter>(
    () => ({
      createDraft: schema =>
        schema
          ? {
              name: schema.name,
              keyPrefix: schema.key_prefix,
              categoryId: schema.category?.id ?? null,
              description: schema.description,
              fields: schema.fields,
              templates: schema.templates,
              groups: schema.groups,
              sharedFieldGroupLinks: schema.shared_field_group_links ?? [],
              validationRules: schema.validation_rules ?? [],
              detailLayoutEnabled: schema.detail_layout !== undefined,
              detailLayout: schema.detail_layout,
              color: schema.color,
              icon: schema.icon
            }
          : {
              name: '',
              keyPrefix: '',
              categoryId: null,
              description: '',
              fields: [],
              templates: [],
              groups: [],
              sharedFieldGroupLinks: [],
              validationRules: [],
              detailLayoutEnabled: false,
              detailLayout: undefined,
              color: null,
              icon: null
            },
      createField: (id, groupId) =>
        ({ id, name: 'new_field', type: 'text', ...(groupId ? { groupId } : {}) }) as SchemaField,
      changeFieldType: (field, newType, fields, firstEnumId) =>
        createSchemaFieldForType(field, newType, fields, firstEnumId),
      onFieldIdChange: (draft, previousFieldId, nextFieldId) => ({
        ...draft,
        templates: updateTemplateFieldId(draft.templates, previousFieldId, nextFieldId)
      }),
      onFieldRemoved: (draft, fieldId) => ({
        ...draft,
        templates: removeTemplateField(draft.templates, fieldId)
      }),
      onFieldTypeChanged: (draft, fieldId) => ({
        ...draft,
        templates: removeTemplateField(draft.templates, fieldId)
      }),
      hasChanges: (draft, schema) =>
        draft.keyPrefix !== schema.key_prefix ||
        draft.name !== schema.name ||
        draft.categoryId !== (schema.category?.id ?? null) ||
        draft.description !== schema.description ||
        JSON.stringify(draft.fields) !== JSON.stringify(schema.fields) ||
        JSON.stringify(draft.templates) !== JSON.stringify(schema.templates) ||
        JSON.stringify(draft.groups) !== JSON.stringify(schema.groups) ||
        JSON.stringify(draft.sharedFieldGroupLinks) !==
          JSON.stringify(schema.shared_field_group_links ?? []) ||
        JSON.stringify(draft.validationRules) !== JSON.stringify(schema.validation_rules ?? []) ||
        JSON.stringify(draft.detailLayoutEnabled ? draft.detailLayout : undefined) !==
          JSON.stringify(schema.detail_layout) ||
        draft.color !== schema.color ||
        draft.icon !== schema.icon,
      save: async (schema, draft, fieldMigrations) => {
        await updateSchemaMutation.mutateAsync({
          schemaId: schema.id,
          data: {
            name: draft.name,
            key_prefix: draft.keyPrefix,
            category_id: draft.categoryId,
            description: draft.description,
            fields: draft.fields,
            templates: draft.templates,
            groups: draft.groups,
            shared_field_group_links: draft.sharedFieldGroupLinks,
            validation_rules: draft.validationRules,
            detail_layout: draft.detailLayoutEnabled ? (draft.detailLayout ?? null) : null,
            color: draft.color,
            icon: draft.icon,
            fieldMigrations
          }
        });
      },
      create: draft =>
        createSchemaMutation.mutateAsync({
          name: draft.name,
          key_prefix: draft.keyPrefix,
          category_id: draft.categoryId,
          description: draft.description,
          fields: draft.fields,
          templates: draft.templates,
          groups: draft.groups,
          shared_field_group_links: draft.sharedFieldGroupLinks,
          validation_rules: draft.validationRules,
          detail_layout: draft.detailLayoutEnabled ? (draft.detailLayout ?? null) : null,
          color: draft.color,
          icon: draft.icon
        }),
      isValid: draft => draft.name.trim() !== '' && /^[A-Z]{2,5}$/.test(draft.keyPrefix),
      remove: schema => deleteSchemaMutation.mutateAsync(schema.id).then(() => undefined),
      getMigrationRequired: getSchemaMigrationRequired,
      validationRuleDefaults: () => ({
        id: `rule-${Date.now()}`,
        name: 'New validation rule',
        expression: 'true',
        message: 'Validation rule failed',
        severity: 'error',
        active: true
      }),
      selectAfterDelete: (items, deletedId) => firstRemainingId(items, deletedId),
      labels: {
        subject: 'entity type',
        migrationSubject: 'schema',
        itemNoun: 'entity',
        deleteTitle: 'Delete entity type?',
        deleteConfirmLabel: 'Delete type',
        saveError: 'Failed to save entity type',
        createError: 'Failed to create entity type',
        deleteError: 'Failed to delete'
      }
    }),
    [createSchemaMutation, deleteSchemaMutation, updateSchemaMutation]
  );

  return {
    adapter,
    isSaving: createSchemaMutation.isPending || updateSchemaMutation.isPending
  };
};
