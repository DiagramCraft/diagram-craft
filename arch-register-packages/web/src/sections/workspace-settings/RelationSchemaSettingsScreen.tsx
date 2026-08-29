import { useCallback, useMemo } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus, TbShare2 } from 'react-icons/tb';
import { TypeBadge } from '../../components/TypeBadge';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveSchemaColor, type RelationFieldType } from '../../lib/schemaPresentation';
import type {
  RelationEndpoint,
  RelationField,
  RelationSchema,
  RelationSchemaGroup
} from '@arch-register/api-types/relationSchemaContract';
import {
  getRelationSchemaMigrationRequired,
  useCreateRelationSchema,
  useDeleteRelationSchema,
  useRelationSchemaVersions,
  useUpdateRelationSchema
} from '../../hooks/useRelationSchemas';
import { RelationEditorForm } from './RelationEditorForm';
import { SchemaEditorDialogs } from './SchemaEditorDialogs';
import { SchemaEditorScreenShell } from './SchemaEditorScreenShell';
import { SchemaVersionHistorySubSection } from './sub-sections/SchemaVersionHistorySubSection';
import { createRelationFieldForType } from './relationSchemaSettingsHelpers';
import {
  firstRemainingId,
  useSchemaEditorController,
  type SchemaEditorAdapter
} from './schemaEditorState';

const EMPTY_ENDPOINT: RelationEndpoint = { schemaIds: [] };
export const NEW_RELATION_SCHEMA_ID = 'new';
const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

const isValidEndpoint = (endpoint: RelationEndpoint): boolean =>
  endpoint.schemaIds === 'any' || endpoint.schemaIds.length > 0;

type RelationEditorExtra = {
  categoryId: string | null;
  inEndpoint: RelationEndpoint;
  outEndpoint: RelationEndpoint;
};

export const RelationSchemaSettingsScreen = () => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const selectedRelationSchemaId = search.relationSchema;
  const isNew = selectedRelationSchemaId === NEW_RELATION_SCHEMA_ID;
  const {
    workspaceSlug,
    schemas,
    relationSchemas,
    enums,
    fieldGroups = [],
    permissions,
    teams
  } = useWorkspaceContext();
  const canEdit = permissions.canEditSchemas;
  const selectedIndex = relationSchemas.findIndex(schema => schema.id === selectedRelationSchemaId);
  const selected = selectedIndex >= 0 ? (relationSchemas[selectedIndex] ?? null) : null;

  const createRelationSchemaMutation = useCreateRelationSchema(workspaceSlug);
  const updateRelationSchemaMutation = useUpdateRelationSchema(workspaceSlug);
  const deleteRelationSchemaMutation = useDeleteRelationSchema(workspaceSlug);

  const onSelectRelationSchema = useCallback(
    (id: string) => {
      navigate({
        to: '/$workspaceSlug/settings/schemas',
        params: { workspaceSlug },
        search: { tab: 'relation-types', relationSchema: id || undefined }
      });
    },
    [navigate, workspaceSlug]
  );

  const adapter = useMemo<
    SchemaEditorAdapter<
      RelationSchema,
      RelationField,
      RelationSchemaGroup,
      RelationEditorExtra,
      RelationFieldType
    >
  >(
    () => ({
      createDraft: schema =>
        schema
          ? {
              name: schema.name,
              categoryId: schema.category?.id ?? null,
              description: schema.description,
              inEndpoint: schema.in,
              outEndpoint: schema.out,
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

  const editor = useSchemaEditorController({
    selected,
    isNew,
    items: relationSchemas,
    fieldGroups,
    firstEnumId: enums[0]?.id,
    adapter,
    onSelect: onSelectRelationSchema
  });
  const draft = editor.draft;

  const { data: versions, isLoading: versionsLoading } = useRelationSchemaVersions(
    workspaceSlug,
    editor.showHistory && selected ? (selectedRelationSchemaId ?? null) : null
  );

  return (
    <SchemaEditorScreenShell
      hasSelection={Boolean((selected || isNew) && draft)}
      breadcrumb={[
        {
          label: 'Home',
          onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
        },
        { label: 'Settings' }
      ]}
      titleTestId="relation-schema-editor-title"
      icon={
        (selected || isNew) && draft ? (
          <TypeBadge
            color={
              draft.color ??
              (selected ? resolveSchemaColor(selected, selectedIndex) : 'var(--base-fg-dim)')
            }
            name={selected?.name ?? draft.name}
            icon={draft.icon}
            size={26}
          />
        ) : undefined
      }
      title={draft?.name ?? ''}
      description={
        selected ? `${selected.relation_count} relations · version ${selected.version}` : undefined
      }
      headerAction={
        selected ? (
          <Button variant="ghost" onClick={() => editor.setShowHistory(current => !current)}>
            {editor.showHistory ? 'Back to fields' : 'View history'}
          </Button>
        ) : undefined
      }
      history={
        editor.showHistory ? (
          <SchemaVersionHistorySubSection versions={versions} isLoading={versionsLoading} />
        ) : null
      }
      editor={
        (selected || isNew) && draft ? (
          <RelationEditorForm
            name={draft.name}
            categoryId={draft.categoryId}
            description={draft.description}
            inEndpoint={draft.inEndpoint}
            outEndpoint={draft.outEndpoint}
            color={draft.color}
            icon={draft.icon}
            dirty={editor.dirty}
            canEdit={canEdit}
            updatePending={
              updateRelationSchemaMutation.isPending || createRelationSchemaMutation.isPending
            }
            saveBlocked={!editor.dirty || !adapter.isValid?.(draft)}
            fields={draft.fields}
            groups={draft.groups}
            sharedFieldGroupLinks={draft.sharedFieldGroupLinks}
            fieldKeys={editor.fieldKeys}
            schemas={schemas}
            enums={enums}
            teams={teams}
            validationRules={draft.validationRules}
            onNameChange={value => editor.updateDraft(current => ({ ...current, name: value }))}
            onCategoryChange={value =>
              editor.updateDraft(current => ({ ...current, categoryId: value }))
            }
            onDescriptionChange={value =>
              editor.updateDraft(current => ({ ...current, description: value }))
            }
            onInEndpointChange={endpoint =>
              editor.updateDraft(current => ({ ...current, inEndpoint: endpoint }))
            }
            onOutEndpointChange={endpoint =>
              editor.updateDraft(current => ({ ...current, outEndpoint: endpoint }))
            }
            onColorChange={value => editor.updateDraft(current => ({ ...current, color: value }))}
            onIconChange={value => editor.updateDraft(current => ({ ...current, icon: value }))}
            onAddField={editor.addField}
            onAddGroup={() => {
              editor.setEditingGroup(null);
              editor.setGroupDialogOpen(true);
            }}
            onUpdateField={editor.updateField}
            onChangeFieldType={editor.changeFieldType}
            onRemoveField={editor.removeField}
            onReorderField={editor.reorderFields}
            onEditGroup={group => {
              editor.setEditingGroup(group);
              editor.setGroupDialogOpen(true);
            }}
            onAccessGroup={editor.setAccessDialogGroupId}
            onRemoveGroup={editor.removeGroup}
            onRemoveSharedGroup={editor.removeSharedFieldGroup}
            onAddValidationRule={editor.addValidationRule}
            onUpdateValidationRule={editor.updateValidationRule}
            onToggleValidationRule={editor.toggleValidationRule}
            onDeleteValidationRule={editor.deleteValidationRule}
            onDelete={selected ? () => editor.setConfirmDelete(true) : undefined}
            onSave={() => void editor.save()}
          />
        ) : null
      }
      emptyIcon={<TbShare2 size={22} />}
      emptyTitle="No relation type selected"
      emptySubtitle="Select a relation type from the sidebar to edit it."
      emptyAction={
        canEdit ? (
          <Button
            variant="primary"
            icon={<TbPlus size={12} />}
            onClick={() => onSelectRelationSchema(NEW_RELATION_SCHEMA_ID)}
          >
            New relation type
          </Button>
        ) : null
      }
      dialogs={
        <SchemaEditorDialogs
          selectedName={selected?.name ?? null}
          subjectLabel="relation type"
          migrationSubjectLabel="relation type"
          migrationItemNoun="relation"
          deleteTitle="Delete relation type?"
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
        />
      }
    />
  );
};
