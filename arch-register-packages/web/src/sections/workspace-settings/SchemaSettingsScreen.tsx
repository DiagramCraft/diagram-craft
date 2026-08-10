import { useCallback, useEffect, useRef, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TbCode, TbPlus } from 'react-icons/tb';
import { TypeBadge } from '../../components/TypeBadge';
import { Title } from '../../components/Title';
import { EmptyState } from '../../components/EmptyState';
import { EnumEditorScreen } from './EnumEditorScreen';
import { FieldGroupEditorScreen } from './FieldGroupEditorScreen';
import { RelationSchemaSettingsScreen } from './RelationSchemaSettingsScreen';
import { SchemaVersionHistorySubSection } from './sub-sections/SchemaVersionHistorySubSection';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import type { FieldType } from '../../lib/schemaPresentation';
import type {
  EntityTemplate,
  FieldMigrations,
  PendingFieldChange,
  SchemaField,
  SchemaGroup,
  SharedFieldGroupLink,
  ValidationRule
} from '@arch-register/api-types/schemaContract';
import {
  useCreateSchema,
  useDeleteSchema,
  usePreviewSchemaValidation,
  useSchemaVersions,
  useUpdateSchema,
  getSchemaMigrationRequired
} from '../../hooks/useSchemas';
import { toFieldId } from '../../utils/fieldId';
import {
  buildFieldMigrations,
  createSchemaFieldForType,
  firstRemainingId,
  removeTemplateField,
  updateTemplateFieldId
} from './schemaSettingsHelpers';
import { SchemaEditorForm } from './SchemaEditorForm';
import { SchemaSettingsDialogs } from './SchemaSettingsDialogs';
import type { SchemaPanelTab } from './SchemaEditorTabs';
import styles from './SchemaSettingsScreen.module.css';

const deriveKeyPrefix = (value: string) =>
  value
    .replace(/[^a-z]/gi, '')
    .toUpperCase()
    .slice(0, 5);

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
  const [name, setName] = useState('');
  const [keyPrefix, setKeyPrefix] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [templates, setTemplates] = useState<EntityTemplate[]>([]);
  const [groups, setGroups] = useState<SchemaGroup[]>([]);
  const [sharedFieldGroupLinks, setSharedFieldGroupLinks] = useState<SharedFieldGroupLink[]>([]);
  const [accessDialogGroupId, setAccessDialogGroupId] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EntityTemplate | null>(null);
  const [pendingFieldChanges, setPendingFieldChanges] = useState<PendingFieldChange[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [schemaPanelTab, setSchemaPanelTab] = useState<SchemaPanelTab>('fields');
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);
  const [validationPreviewMessage, setValidationPreviewMessage] = useState<string | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SchemaGroup | null>(null);
  const fieldKeysRef = useRef<Map<string, string>>(new Map());

  const createSchemaMutation = useCreateSchema(workspaceSlug);
  const updateSchemaMutation = useUpdateSchema(workspaceSlug);
  const previewValidationMutation = usePreviewSchemaValidation(workspaceSlug);
  const deleteSchemaMutation = useDeleteSchema(workspaceSlug);
  const { data: schemaVersions, isLoading: schemaVersionsLoading } = useSchemaVersions(
    workspaceSlug,
    showHistory ? (selectedSchemaId ?? null) : null
  );

  const onSelectSchema = useCallback(
    (id: string) => {
      navigate({
        to: '/$workspaceSlug/settings/schemas',
        params: { workspaceSlug },
        search: { schema: id ?? undefined }
      });
    },
    [navigate, workspaceSlug]
  );

  const selectedIndex = schemas.findIndex(schema => schema.id === selectedSchemaId);
  const selected = selectedIndex >= 0 ? (schemas[selectedIndex] ?? null) : null;

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setKeyPrefix(selected.key_prefix);
    setDescription(selected.description);
    setFields(selected.fields);
    setTemplates(selected.templates);
    setGroups(selected.groups);
    setSharedFieldGroupLinks(selected.shared_field_group_links ?? []);
    setValidationRules(selected.validation_rules ?? []);
    setColor(selected.color);
    setIcon(selected.icon);
    setDirty(false);
    setTemplateDialogOpen(false);
    setShowHistory(false);
    setPendingFieldChanges(null);
    setGroupDialogOpen(false);
    setEditingGroup(null);
    fieldKeysRef.current.clear();
  }, [selected]);

  const handleSave = useCallback(
    async (fieldMigrations?: FieldMigrations) => {
      if (!selected || !dirty) return;
      try {
        const schemaChanged =
          fieldMigrations !== undefined ||
          name !== selected.name ||
          keyPrefix !== selected.key_prefix ||
          description !== selected.description ||
          JSON.stringify(fields) !== JSON.stringify(selected.fields) ||
          JSON.stringify(templates) !== JSON.stringify(selected.templates) ||
          JSON.stringify(groups) !== JSON.stringify(selected.groups) ||
          JSON.stringify(sharedFieldGroupLinks) !==
            JSON.stringify(selected.shared_field_group_links ?? []) ||
          JSON.stringify(validationRules) !== JSON.stringify(selected.validation_rules ?? []) ||
          color !== selected.color ||
          icon !== selected.icon;
        if (schemaChanged) {
          await updateSchemaMutation.mutateAsync({
            schemaId: selected.id,
            data: {
              name,
              key_prefix: keyPrefix,
              description,
              fields,
              templates,
              groups,
              shared_field_group_links: sharedFieldGroupLinks,
              validation_rules: validationRules,
              color,
              icon,
              fieldMigrations
            }
          });
        }
        setDirty(false);
        setPendingFieldChanges(null);
      } catch (error: unknown) {
        const migrationRequired = getSchemaMigrationRequired(error);
        if (migrationRequired) {
          setPendingFieldChanges(migrationRequired.pendingChanges);
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : 'Failed to save entity type');
      }
    },
    [
      selected,
      name,
      keyPrefix,
      description,
      fields,
      templates,
      groups,
      sharedFieldGroupLinks,
      validationRules,
      color,
      icon,
      dirty,
      updateSchemaMutation
    ]
  );

  const confirmFieldMigrations = useCallback(
    (choices: import('../../dialogs/FieldMigrationDialog').FieldMigrationChoices) => {
      if (!pendingFieldChanges) return;
      void handleSave(buildFieldMigrations(pendingFieldChanges, choices));
    },
    [pendingFieldChanges, handleSave]
  );

  const handleCreateType = useCallback(async () => {
    try {
      const created = await createSchemaMutation.mutateAsync({
        name: 'New type',
        key_prefix: 'TYPE',
        fields: []
      });
      onSelectSchema(created.id);
    } catch {
      // TODO: surface error
    }
  }, [createSchemaMutation, onSelectSchema]);

  const addValidationRule = () => {
    setValidationRules(current => [
      ...current,
      {
        id: `rule-${Date.now()}`,
        name: 'New validation rule',
        expression: 'true',
        message: 'Validation rule failed',
        severity: 'error',
        active: true
      }
    ]);
    setDirty(true);
  };

  const updateValidationRule = (index: number, patch: Partial<ValidationRule>) => {
    setValidationRules(current =>
      current.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule))
    );
    setDirty(true);
  };

  const toggleValidationRule = (index: number) => {
    setValidationRules(current =>
      current.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, active: !rule.active } : rule
      )
    );
    setDirty(true);
  };

  const deleteValidationRule = (index: number) => {
    setValidationRules(current => current.filter((_, ruleIndex) => ruleIndex !== index));
    setDirty(true);
  };

  const previewValidation = async () => {
    if (!selected) return;
    try {
      const results = await previewValidationMutation.mutateAsync({
        schemaId: selected.id,
        validation_rules: validationRules
      });
      const errors = results.reduce((count, result) => count + result.errors.length, 0);
      const warnings = results.reduce((count, result) => count + result.warnings.length, 0);
      setValidationPreviewMessage(
        `Tested ${results.length} entities: ${errors} blocking error(s), ${warnings} warning(s).`
      );
    } catch (error) {
      setValidationPreviewMessage(error instanceof Error ? error.message : 'Preview failed');
    }
  };

  const doDeleteType = useCallback(async () => {
    if (!selected) return;
    setConfirmDelete(false);
    try {
      await deleteSchemaMutation.mutateAsync(selected.id);
      onSelectSchema(firstRemainingId(schemas, selected.id));
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete');
    }
  }, [selected, deleteSchemaMutation, onSelectSchema, schemas]);

  const updateField = (fieldId: string, patch: Partial<SchemaField>) => {
    if (patch.id && patch.id !== fieldId) {
      const nextFieldId = patch.id;
      const stableKey = fieldKeysRef.current.get(fieldId);
      if (stableKey) {
        fieldKeysRef.current.delete(fieldId);
        fieldKeysRef.current.set(nextFieldId, stableKey);
      }
      setTemplates(current => updateTemplateFieldId(current, fieldId, nextFieldId));
    }
    setFields(current =>
      current.map(field => (field.id === fieldId ? ({ ...field, ...patch } as SchemaField) : field))
    );
    setDirty(true);
  };

  const removeField = (fieldId: string) => {
    setFields(current => current.filter(field => field.id !== fieldId));
    setTemplates(current => removeTemplateField(current, fieldId));
    setDirty(true);
  };

  const addField = (groupId?: string) => {
    const id = toFieldId('new_field');
    fieldKeysRef.current.set(id, crypto.randomUUID());
    setFields(
      current =>
        [
          ...current,
          { id, name: 'new_field', type: 'text', ...(groupId && { groupId }) }
        ] as SchemaField[]
    );
    setDirty(true);
  };

  const addSharedFieldGroup = (groupId: string | undefined) => {
    if (!groupId || sharedFieldGroupLinks.some(link => link.groupId === groupId)) return;
    const sharedGroup = fieldGroups.find(group => group.id === groupId);
    if (!sharedGroup) return;
    setSharedFieldGroupLinks(current => [...current, { groupId }]);
    setGroups(current => [
      ...current,
      {
        id: sharedGroup.id,
        name: sharedGroup.name,
        ...(sharedGroup.description ? { description: sharedGroup.description } : {})
      }
    ]);
    setDirty(true);
  };

  const removeSharedFieldGroup = (groupId: string) => {
    setSharedFieldGroupLinks(current => current.filter(link => link.groupId !== groupId));
    setGroups(current => current.filter(group => group.id !== groupId));
    setDirty(true);
  };

  const setGroupAccess = (groupId: string, teamIds: string[]) => {
    if (sharedFieldGroupLinks.some(link => link.groupId === groupId)) {
      setSharedFieldGroupLinks(current =>
        current.map(link =>
          link.groupId === groupId ? { groupId, ...(teamIds.length > 0 ? { teamIds } : {}) } : link
        )
      );
    } else {
      setGroups(current =>
        current.map(group => {
          if (group.id !== groupId) return group;
          const { accessControl: _accessControl, ...rest } = group;
          return teamIds.length > 0 ? { ...rest, accessControl: { teamIds } } : rest;
        })
      );
    }
    setDirty(true);
  };

  const changeFieldType = (fieldId: string, newType: FieldType) => {
    setFields(current =>
      current.map(field =>
        field.id === fieldId
          ? createSchemaFieldForType(field, newType, current, enums[0]?.id)
          : field
      )
    );
    setTemplates(current => removeTemplateField(current, fieldId));
    setDirty(true);
  };

  const saveTemplate = (template: EntityTemplate) => {
    setTemplates(current => {
      const index = current.findIndex(item => item.id === template.id);
      return index === -1
        ? [...current, template]
        : current.map(item => (item.id === template.id ? template : item));
    });
    setDirty(true);
    setTemplateDialogOpen(false);
  };

  const saveGroup = (group: SchemaGroup) => {
    setGroups(current =>
      current.some(item => item.id === group.id)
        ? current.map(item => (item.id === group.id ? group : item))
        : [...current, group]
    );
    setDirty(true);
    setGroupDialogOpen(false);
  };

  const removeGroup = (groupId: string) => {
    setGroups(current => current.filter(group => group.id !== groupId));
    setFields(current =>
      current.map(field => (field.groupId === groupId ? { ...field, groupId: undefined } : field))
    );
    setDirty(true);
  };

  if (activeTab === 'enums') return <EnumEditorScreen />;
  if (activeTab === 'fieldgroups') return <FieldGroupEditorScreen />;
  if (activeTab === 'relation-types') return <RelationSchemaSettingsScreen />;

  return (
    <div className={styles.screen}>
      {selected ? (
        <div>
          <div className={styles.editorHead}>
            <Title
              breadcrumb={[
                {
                  label: 'Home',
                  onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
                },
                { label: 'Settings' }
              ]}
              titleTestId="schema-editor-title"
              icon={
                <TypeBadge
                  color={color ?? resolveSchemaColor(selected, selectedIndex)}
                  name={selected.name}
                  icon={icon}
                  size={26}
                />
              }
              title={name}
              description={`${selected.entity_count} entities · version ${selected.version}`}
            />
            <Button variant="ghost" onClick={() => setShowHistory(current => !current)}>
              {showHistory ? 'Back to fields' : 'View history'}
            </Button>
          </div>
          {showHistory ? (
            <SchemaVersionHistorySubSection
              versions={schemaVersions}
              isLoading={schemaVersionsLoading}
            />
          ) : (
            <SchemaEditorForm
              name={name}
              keyPrefix={keyPrefix}
              description={description}
              color={color}
              icon={icon}
              dirty={dirty}
              canEdit={canEdit}
              updatePending={updateSchemaMutation.isPending}
              panelTab={schemaPanelTab}
              fields={fields}
              groups={groups}
              sharedFieldGroupLinks={sharedFieldGroupLinks}
              fieldKeys={fieldKeysRef.current}
              schemas={schemas}
              relationSchemas={relationSchemas}
              enums={enums}
              teams={teams}
              templates={templates}
              validationRules={validationRules}
              validationPreviewPending={previewValidationMutation.isPending}
              validationPreviewMessage={validationPreviewMessage}
              onNameChange={value => {
                setName(value);
                if (!dirty || keyPrefix === deriveKeyPrefix(name))
                  setKeyPrefix(deriveKeyPrefix(value));
                setDirty(true);
              }}
              onKeyPrefixChange={value => {
                setKeyPrefix(value.toUpperCase());
                setDirty(true);
              }}
              onDescriptionChange={value => {
                setDescription(value);
                setDirty(true);
              }}
              onColorChange={value => {
                setColor(value);
                setDirty(true);
              }}
              onIconChange={value => {
                setIcon(value);
                setDirty(true);
              }}
              onPanelTabChange={setSchemaPanelTab}
              onAddField={addField}
              onAddGroup={() => {
                setEditingGroup(null);
                setGroupDialogOpen(true);
              }}
              onUpdateField={updateField}
              onChangeFieldType={changeFieldType}
              onRemoveField={removeField}
              onEditGroup={group => {
                setEditingGroup(group);
                setGroupDialogOpen(true);
              }}
              onAccessGroup={setAccessDialogGroupId}
              onRemoveGroup={removeGroup}
              onRemoveSharedGroup={removeSharedFieldGroup}
              onAddTemplate={() => {
                setEditingTemplate(null);
                setTemplateDialogOpen(true);
              }}
              onEditTemplate={template => {
                setEditingTemplate(template);
                setTemplateDialogOpen(true);
              }}
              onDeleteTemplate={templateId => {
                setTemplates(current => current.filter(template => template.id !== templateId));
                setDirty(true);
              }}
              onPreviewValidation={() => void previewValidation()}
              onAddValidationRule={addValidationRule}
              onUpdateValidationRule={updateValidationRule}
              onToggleValidationRule={toggleValidationRule}
              onDeleteValidationRule={deleteValidationRule}
              onDelete={() => setConfirmDelete(true)}
              onSave={() => void handleSave()}
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon={<TbCode size={22} />}
          title="No type selected"
          subtitle="Select an entity type from the sidebar to edit its schema."
          action={
            canEdit && (
              <Button variant="primary" icon={<TbPlus size={12} />} onClick={handleCreateType}>
                New entity type
              </Button>
            )
          }
        />
      )}
      <SchemaSettingsDialogs
        selected={selected}
        workspaceId={workspaceSlug}
        fields={fields}
        templates={templates}
        teams={teams}
        lifecycleStates={lifecycleStates}
        fieldGroups={fieldGroups}
        sharedFieldGroupLinks={sharedFieldGroupLinks}
        groups={groups}
        confirmDelete={confirmDelete}
        errorMessage={errorMessage}
        pendingFieldChanges={pendingFieldChanges}
        groupDialogOpen={groupDialogOpen}
        editingGroup={editingGroup}
        accessDialogGroupId={accessDialogGroupId}
        templateDialogOpen={templateDialogOpen}
        editingTemplate={editingTemplate}
        onConfirmDelete={doDeleteType}
        onCancelDelete={() => setConfirmDelete(false)}
        onCloseError={() => setErrorMessage(null)}
        onCancelMigration={() => setPendingFieldChanges(null)}
        onConfirmMigration={confirmFieldMigrations}
        onCloseGroup={() => setGroupDialogOpen(false)}
        onSaveGroup={saveGroup}
        onAddSharedGroup={groupId => addSharedFieldGroup(groupId)}
        onCloseAccess={() => setAccessDialogGroupId(null)}
        onSetGroupAccess={setGroupAccess}
        onCloseTemplate={() => setTemplateDialogOpen(false)}
        onSaveTemplate={saveTemplate}
      />
    </div>
  );
};
