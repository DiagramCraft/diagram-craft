import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TbCode, TbPlus } from 'react-icons/tb';
import { TypeBadge } from '../../components/TypeBadge';
import { EntityTemplateDialog } from '../../dialogs/EntityTemplateDialog';
import { EnumEditorScreen } from './EnumEditorScreen';
import { FieldGroupEditorScreen } from './FieldGroupEditorScreen';
import { RelationSchemaSettingsScreen } from './RelationSchemaSettingsScreen';
import { SchemaVersionHistorySubSection } from './sub-sections/SchemaVersionHistorySubSection';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import type { FieldType } from '../../lib/schemaPresentation';
import type {
  EntitySchema,
  EntityTemplate,
  SchemaField,
  SchemaGroup
} from '@arch-register/api-types/schemaContract';
import type { EntityCapability } from '@arch-register/api-types/entityCapabilityContract';
import {
  useCreateSchema,
  useDeleteSchema,
  usePreviewSchemaValidation,
  useSchemaVersions,
  useUpdateSchema,
  getSchemaMigrationRequired
} from '../../hooks/useSchemas';
import {
  createSchemaFieldForType,
  removeTemplateField,
  updateCapabilityFieldMappingId,
  updateTemplateFieldId
} from './schemaSettingsHelpers';
import { SchemaEditorForm } from './SchemaEditorForm';
import { SchemaEditorDialogs } from './SchemaEditorDialogs';
import { SchemaEditorScreenShell } from './SchemaEditorScreenShell';
import {
  firstRemainingId,
  useSchemaEditorController,
  type SchemaEditorAdapter
} from './schemaEditorState';
import type { SchemaPanelTab } from './SchemaEditorTabs';

const deriveKeyPrefix = (value: string) =>
  value
    .replace(/[^a-z]/gi, '')
    .toUpperCase()
    .slice(0, 5);

type EntityEditorExtra = {
  keyPrefix: string;
  category: string;
  templates: EntityTemplate[];
  entityCapabilities: EntityCapability[];
};

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

export const SchemaSettingsScreen = () => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const selectedSchemaId = search.schema;
  const activeTab = search.tab ?? 'types';
  const {
    workspaceSlug,
    schemas,
    relationSchemas,
    enums,
    fieldGroups = [],
    permissions,
    teams,
    lifecycleStates
  } = useWorkspaceContext();
  const canEdit = permissions.canEditSchemas;
  const selectedIndex = schemas.findIndex(schema => schema.id === selectedSchemaId);
  const selected = selectedIndex >= 0 ? (schemas[selectedIndex] ?? null) : null;

  const createSchemaMutation = useCreateSchema(workspaceSlug);
  const updateSchemaMutation = useUpdateSchema(workspaceSlug);
  const previewValidationMutation = usePreviewSchemaValidation(workspaceSlug);
  const deleteSchemaMutation = useDeleteSchema(workspaceSlug);

  const onSelectSchema = useCallback(
    (id: string) => {
      navigate({
        to: '/$workspaceSlug/settings/schemas',
        params: { workspaceSlug },
        search: { schema: id || undefined }
      });
    },
    [navigate, workspaceSlug]
  );

  const adapter = useMemo<
    SchemaEditorAdapter<EntitySchema, SchemaField, SchemaGroup, EntityEditorExtra, FieldType>
  >(
    () => ({
      createDraft: schema => ({
        name: schema.name,
        keyPrefix: schema.key_prefix,
        category: schema.category ?? '',
        description: schema.description,
        fields: schema.fields,
        templates: schema.templates,
        entityCapabilities: schema.entity_capabilities ?? [],
        groups: schema.groups,
        sharedFieldGroupLinks: schema.shared_field_group_links ?? [],
        validationRules: schema.validation_rules ?? [],
        color: schema.color,
        icon: schema.icon
      }),
      createField: (id, groupId) =>
        ({ id, name: 'new_field', type: 'text', ...(groupId ? { groupId } : {}) }) as SchemaField,
      changeFieldType: (field, newType, fields, firstEnumId) =>
        createSchemaFieldForType(field, newType, fields, firstEnumId),
      onFieldIdChange: (draft, previousFieldId, nextFieldId) => ({
        ...draft,
        templates: updateTemplateFieldId(draft.templates, previousFieldId, nextFieldId),
        entityCapabilities: updateCapabilityFieldMappingId(
          draft.entityCapabilities,
          previousFieldId,
          nextFieldId
        )
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
        draft.category !== (schema.category ?? '') ||
        draft.description !== schema.description ||
        JSON.stringify(draft.fields) !== JSON.stringify(schema.fields) ||
        JSON.stringify(draft.templates) !== JSON.stringify(schema.templates) ||
        JSON.stringify(draft.groups) !== JSON.stringify(schema.groups) ||
        JSON.stringify(draft.sharedFieldGroupLinks) !==
          JSON.stringify(schema.shared_field_group_links ?? []) ||
        JSON.stringify(draft.entityCapabilities) !==
          JSON.stringify(schema.entity_capabilities ?? []) ||
        JSON.stringify(draft.validationRules) !== JSON.stringify(schema.validation_rules ?? []) ||
        draft.color !== schema.color ||
        draft.icon !== schema.icon,
      save: async (schema, draft, fieldMigrations) => {
        await updateSchemaMutation.mutateAsync({
          schemaId: schema.id,
          data: {
            name: draft.name,
            key_prefix: draft.keyPrefix,
            category: draft.category,
            description: draft.description,
            fields: draft.fields,
            templates: draft.templates,
            groups: draft.groups,
            shared_field_group_links: draft.sharedFieldGroupLinks,
            entity_capabilities: draft.entityCapabilities,
            validation_rules: draft.validationRules,
            color: draft.color,
            icon: draft.icon,
            fieldMigrations
          }
        });
      },
      create: () =>
        createSchemaMutation.mutateAsync({
          name: 'New type',
          key_prefix: 'TYPE',
          fields: []
        }),
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

  const editor = useSchemaEditorController({
    selected,
    items: schemas,
    fieldGroups,
    firstEnumId: enums[0]?.id,
    adapter,
    onSelect: onSelectSchema
  });
  const draft = editor.draft;
  const [schemaPanelTab, setSchemaPanelTab] = useState<SchemaPanelTab>('fields');
  const [validationPreviewMessage, setValidationPreviewMessage] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EntityTemplate | null>(null);

  const { data: schemaVersions, isLoading: schemaVersionsLoading } = useSchemaVersions(
    workspaceSlug,
    editor.showHistory ? (selectedSchemaId ?? null) : null
  );

  useEffect(() => {
    if (!selectedSchemaId) return;
    setSchemaPanelTab('fields');
    setValidationPreviewMessage(null);
    setTemplateDialogOpen(false);
    setEditingTemplate(null);
  }, [selectedSchemaId]);

  const previewValidation = useCallback(async () => {
    if (!selected || !draft) return;
    try {
      const results = await previewValidationMutation.mutateAsync({
        schemaId: selected.id,
        validation_rules: draft.validationRules
      });
      const errors = results.reduce((count, result) => count + result.errors.length, 0);
      const warnings = results.reduce((count, result) => count + result.warnings.length, 0);
      setValidationPreviewMessage(
        `Tested ${results.length} entities: ${errors} blocking error(s), ${warnings} warning(s).`
      );
    } catch (error) {
      setValidationPreviewMessage(error instanceof Error ? error.message : 'Preview failed');
    }
  }, [draft, previewValidationMutation, selected]);

  if (activeTab === 'enums') return <EnumEditorScreen />;
  if (activeTab === 'fieldgroups') return <FieldGroupEditorScreen />;
  if (activeTab === 'relation-types') return <RelationSchemaSettingsScreen />;

  return (
    <SchemaEditorScreenShell
      hasSelection={Boolean(selected && draft)}
      breadcrumb={[
        {
          label: 'Home',
          onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
        },
        { label: 'Settings' }
      ]}
      titleTestId="schema-editor-title"
      icon={
        selected && draft ? (
          <TypeBadge
            color={draft.color ?? resolveSchemaColor(selected, selectedIndex)}
            name={selected.name}
            icon={draft.icon}
            size={26}
          />
        ) : undefined
      }
      title={draft?.name ?? ''}
      description={
        selected ? `${selected.entity_count} entities · version ${selected.version}` : undefined
      }
      headerAction={
        <Button variant="ghost" onClick={() => editor.setShowHistory(current => !current)}>
          {editor.showHistory ? 'Back to fields' : 'View history'}
        </Button>
      }
      history={
        editor.showHistory ? (
          <SchemaVersionHistorySubSection
            versions={schemaVersions}
            isLoading={schemaVersionsLoading}
          />
        ) : null
      }
      editor={
        selected && draft ? (
          <SchemaEditorForm
            name={draft.name}
            keyPrefix={draft.keyPrefix}
            category={draft.category}
            description={draft.description}
            color={draft.color}
            icon={draft.icon}
            dirty={editor.dirty}
            canEdit={canEdit}
            updatePending={updateSchemaMutation.isPending}
            panelTab={schemaPanelTab}
            fields={draft.fields}
            groups={draft.groups}
            sharedFieldGroupLinks={draft.sharedFieldGroupLinks}
            fieldKeys={editor.fieldKeys}
            schemas={schemas}
            relationSchemas={relationSchemas}
            enums={enums}
            teams={teams}
            templates={draft.templates}
            entityCapabilities={draft.entityCapabilities}
            validationRules={draft.validationRules}
            validationPreviewPending={previewValidationMutation.isPending}
            validationPreviewMessage={validationPreviewMessage}
            onNameChange={value =>
              editor.updateDraft(current => ({
                ...current,
                name: value,
                keyPrefix:
                  !editor.dirty || current.keyPrefix === deriveKeyPrefix(current.name)
                    ? deriveKeyPrefix(value)
                    : current.keyPrefix
              }))
            }
            onKeyPrefixChange={value =>
              editor.updateDraft(current => ({ ...current, keyPrefix: value.toUpperCase() }))
            }
            onCategoryChange={value =>
              editor.updateDraft(current => ({ ...current, category: value }))
            }
            onDescriptionChange={value =>
              editor.updateDraft(current => ({ ...current, description: value }))
            }
            onColorChange={value => editor.updateDraft(current => ({ ...current, color: value }))}
            onIconChange={value => editor.updateDraft(current => ({ ...current, icon: value }))}
            onPanelTabChange={setSchemaPanelTab}
            onAddField={editor.addField}
            onAddGroup={() => {
              editor.setEditingGroup(null);
              editor.setGroupDialogOpen(true);
            }}
            onUpdateField={editor.updateField}
            onChangeFieldType={editor.changeFieldType}
            onRemoveField={editor.removeField}
            onEditGroup={group => {
              editor.setEditingGroup(group);
              editor.setGroupDialogOpen(true);
            }}
            onAccessGroup={editor.setAccessDialogGroupId}
            onRemoveGroup={editor.removeGroup}
            onRemoveSharedGroup={editor.removeSharedFieldGroup}
            onAddTemplate={() => {
              setEditingTemplate(null);
              setTemplateDialogOpen(true);
            }}
            onEditTemplate={template => {
              setEditingTemplate(template);
              setTemplateDialogOpen(true);
            }}
            onDeleteTemplate={templateId =>
              editor.updateDraft(current => ({
                ...current,
                templates: current.templates.filter(template => template.id !== templateId)
              }))
            }
            onAddEntityCapability={type =>
              editor.updateDraft(current =>
                current.entityCapabilities.some(capability => capability.type === type)
                  ? current
                  : {
                      ...current,
                      entityCapabilities: [...current.entityCapabilities, { type }]
                    }
              )
            }
            onUpdateEntityCapability={(index, patch) =>
              editor.updateDraft(current => ({
                ...current,
                entityCapabilities: current.entityCapabilities.map((capability, capabilityIndex) =>
                  capabilityIndex === index ? { ...capability, ...patch } : capability
                )
              }))
            }
            onDeleteEntityCapability={index =>
              editor.updateDraft(current => ({
                ...current,
                entityCapabilities: current.entityCapabilities.filter(
                  (_, capabilityIndex) => capabilityIndex !== index
                )
              }))
            }
            onPreviewValidation={() => void previewValidation()}
            onAddValidationRule={editor.addValidationRule}
            onUpdateValidationRule={editor.updateValidationRule}
            onToggleValidationRule={editor.toggleValidationRule}
            onDeleteValidationRule={editor.deleteValidationRule}
            onDelete={() => editor.setConfirmDelete(true)}
            onSave={() => void editor.save()}
          />
        ) : null
      }
      emptyIcon={<TbCode size={22} />}
      emptyTitle="No type selected"
      emptySubtitle="Select an entity type from the sidebar to edit its schema."
      emptyAction={
        canEdit ? (
          <Button
            variant="primary"
            icon={<TbPlus size={12} />}
            onClick={() => void editor.create()}
          >
            New entity type
          </Button>
        ) : null
      }
      dialogs={
        <SchemaEditorDialogs
          selectedName={selected?.name ?? null}
          subjectLabel="entity type"
          migrationSubjectLabel="schema"
          migrationItemNoun="entity"
          deleteTitle="Delete entity type?"
          deleteConfirmLabel="Delete type"
          fieldGroups={fieldGroups}
          sharedFieldGroupLinks={draft?.sharedFieldGroupLinks ?? []}
          groups={draft?.groups ?? []}
          teams={teams}
          confirmDelete={editor.confirmDelete}
          errorMessage={editor.errorMessage}
          pendingFieldChanges={editor.pendingFieldChanges}
          groupDialogOpen={editor.groupDialogOpen}
          editingGroup={editor.editingGroup}
          accessDialogGroupId={editor.accessDialogGroupId}
          onConfirmDelete={() => void editor.deleteSelected()}
          onCancelDelete={() => editor.setConfirmDelete(false)}
          onCloseError={() => editor.setErrorMessage(null)}
          onCancelMigration={() => editor.setPendingFieldChanges(null)}
          onConfirmMigration={editor.confirmFieldMigrations}
          onCloseGroup={() => editor.setGroupDialogOpen(false)}
          onSaveGroup={editor.saveGroup}
          onAddSharedGroup={editor.addSharedFieldGroup}
          onCloseAccess={() => editor.setAccessDialogGroupId(null)}
          onSetGroupAccess={editor.setGroupAccess}
          extraDialogs={
            selected && draft ? (
              <EntityTemplateDialog
                open={templateDialogOpen}
                onClose={() => setTemplateDialogOpen(false)}
                onSave={template => {
                  editor.updateDraft(current => {
                    const index = current.templates.findIndex(item => item.id === template.id);
                    return {
                      ...current,
                      templates:
                        index === -1
                          ? [...current.templates, template]
                          : current.templates.map(item =>
                              item.id === template.id ? template : item
                            )
                    };
                  });
                  setTemplateDialogOpen(false);
                }}
                workspaceId={workspaceSlug}
                schema={
                  { ...selected, fields: draft.fields, templates: draft.templates } as EntitySchema
                }
                template={editingTemplate}
                templates={draft.templates}
                teams={teams}
                lifecycleStates={lifecycleStates}
              />
            ) : null
          }
        />
      }
    />
  );
};
