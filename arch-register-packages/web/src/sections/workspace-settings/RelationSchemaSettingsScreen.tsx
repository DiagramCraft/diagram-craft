import { useCallback, useEffect, useRef, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus, TbShare2 } from 'react-icons/tb';
import { TypeBadge } from '../../components/TypeBadge';
import { Title } from '../../components/Title';
import { EmptyState } from '../../components/EmptyState';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveSchemaColor, type RelationFieldType } from '../../lib/schemaPresentation';
import type {
  RelationEndpoint,
  RelationField,
  RelationSchemaGroup
} from '@arch-register/api-types/relationSchemaContract';
import type {
  FieldMigrations,
  PendingFieldChange,
  SharedFieldGroupLink,
  ValidationRule
} from '@arch-register/api-types/schemaContract';
import {
  getRelationSchemaMigrationRequired,
  useCreateRelationSchema,
  useDeleteRelationSchema,
  useRelationSchemaVersions,
  useUpdateRelationSchema
} from '../../hooks/useRelationSchemas';
import { toFieldId } from '../../utils/fieldId';
import { RelationEditorForm } from './RelationEditorForm';
import { RelationSchemaSettingsDialogs } from './RelationSchemaSettingsDialogs';
import { SchemaVersionHistorySubSection } from './sub-sections/SchemaVersionHistorySubSection';
import {
  buildRelationFieldMigrations,
  createRelationFieldForType,
  firstRemainingRelationSchemaId
} from './relationSchemaSettingsHelpers';
import styles from './SchemaSettingsScreen.module.css';

const EMPTY_ENDPOINT: RelationEndpoint = { schemaIds: [] };
const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

export const RelationSchemaSettingsScreen = () => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const selectedRelationSchemaId = search.relationSchema;
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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inEndpoint, setInEndpoint] = useState<RelationEndpoint>(EMPTY_ENDPOINT);
  const [outEndpoint, setOutEndpoint] = useState<RelationEndpoint>(EMPTY_ENDPOINT);
  const [fields, setFields] = useState<RelationField[]>([]);
  const [groups, setGroups] = useState<RelationSchemaGroup[]>([]);
  const [sharedFieldGroupLinks, setSharedFieldGroupLinks] = useState<SharedFieldGroupLink[]>([]);
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);
  const [accessDialogGroupId, setAccessDialogGroupId] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingFieldChanges, setPendingFieldChanges] = useState<PendingFieldChange[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RelationSchemaGroup | null>(null);
  const fieldKeysRef = useRef<Map<string, string>>(new Map());

  const createRelationSchemaMutation = useCreateRelationSchema(workspaceSlug);
  const updateRelationSchemaMutation = useUpdateRelationSchema(workspaceSlug);
  const deleteRelationSchemaMutation = useDeleteRelationSchema(workspaceSlug);
  const { data: versions, isLoading: versionsLoading } = useRelationSchemaVersions(
    workspaceSlug,
    showHistory ? (selectedRelationSchemaId ?? null) : null
  );

  const onSelectRelationSchema = useCallback(
    (id: string) => {
      navigate({
        to: '/$workspaceSlug/settings/schemas',
        params: { workspaceSlug },
        search: { tab: 'relation-types', relationSchema: id ?? undefined }
      });
    },
    [navigate, workspaceSlug]
  );

  const selectedIndex = relationSchemas.findIndex(schema => schema.id === selectedRelationSchemaId);
  const selected = selectedIndex >= 0 ? relationSchemas[selectedIndex] ?? null : null;

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setDescription(selected.description);
    setInEndpoint(selected.in);
    setOutEndpoint(selected.out);
    setFields(selected.fields);
    setGroups(selected.groups);
    setSharedFieldGroupLinks(selected.shared_field_group_links ?? []);
    setValidationRules(selected.validation_rules ?? []);
    setColor(selected.color);
    setIcon(selected.icon);
    setDirty(false);
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
        await updateRelationSchemaMutation.mutateAsync({
          relationSchemaId: selected.id,
          data: {
            name,
            description,
            in: inEndpoint,
            out: outEndpoint,
            fields,
            groups,
            shared_field_group_links: sharedFieldGroupLinks,
            validation_rules: validationRules,
            color,
            icon,
            fieldMigrations
          }
        });
        setDirty(false);
        setPendingFieldChanges(null);
      } catch (error: unknown) {
        const migrationRequired = getRelationSchemaMigrationRequired(error);
        if (migrationRequired) {
          setPendingFieldChanges(migrationRequired.pendingChanges);
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : 'Failed to save relation type');
      }
    },
    [
      selected,
      name,
      description,
      inEndpoint,
      outEndpoint,
      fields,
      groups,
      sharedFieldGroupLinks,
      validationRules,
      color,
      icon,
      dirty,
      updateRelationSchemaMutation
    ]
  );

  const confirmFieldMigrations = useCallback(
    (choices: import('../../dialogs/FieldMigrationDialog').FieldMigrationChoices) => {
      if (!pendingFieldChanges) return;
      void handleSave(buildRelationFieldMigrations(pendingFieldChanges, choices));
    },
    [pendingFieldChanges, handleSave]
  );

  const handleCreateType = useCallback(async () => {
    try {
      const created = await createRelationSchemaMutation.mutateAsync({
        name: 'New relation type',
        in: EMPTY_ENDPOINT,
        out: EMPTY_ENDPOINT,
        fields: []
      });
      onSelectRelationSchema(created.id);
    } catch {
      // TODO: surface error
    }
  }, [createRelationSchemaMutation, onSelectRelationSchema]);

  const doDeleteType = useCallback(async () => {
    if (!selected) return;
    setConfirmDelete(false);
    try {
      await deleteRelationSchemaMutation.mutateAsync(selected.id);
      onSelectRelationSchema(firstRemainingRelationSchemaId(relationSchemas, selected.id));
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete');
    }
  }, [selected, deleteRelationSchemaMutation, onSelectRelationSchema, relationSchemas]);

  const updateField = (fieldId: string, patch: Partial<RelationField>) => {
    if (patch.id && patch.id !== fieldId) {
      const stableKey = fieldKeysRef.current.get(fieldId);
      if (stableKey) {
        fieldKeysRef.current.delete(fieldId);
        fieldKeysRef.current.set(patch.id, stableKey);
      }
    }
    setFields(current =>
      current.map(field => (field.id === fieldId ? ({ ...field, ...patch } as RelationField) : field))
    );
    setDirty(true);
  };

  const removeField = (fieldId: string) => {
    setFields(current => current.filter(field => field.id !== fieldId));
    setDirty(true);
  };

  const addField = (groupId?: string) => {
    const id = toFieldId('new_field');
    fieldKeysRef.current.set(id, crypto.randomUUID());
    setFields(current => [
      ...current,
      { id, name: 'new_field', type: 'text', ...(groupId && { groupId }) }
    ] as RelationField[]);
    setDirty(true);
  };

  const addValidationRule = () => {
    setValidationRules(current => [
      ...current,
      {
        id: `rule-${Date.now()}`,
        name: 'New rule',
        expression: 'true',
        message: 'Relation validation failed',
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
          link.groupId === groupId
            ? { groupId, ...(teamIds.length > 0 ? { teamIds } : {}) }
            : link
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

  const changeFieldType = (fieldId: string, newType: RelationFieldType) => {
    setFields(current =>
      current.map(field =>
        field.id === fieldId ? createRelationFieldForType(field, newType, enums[0]?.id) : field
      )
    );
    setDirty(true);
  };

  const saveGroup = (group: RelationSchemaGroup) => {
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
              titleTestId="relation-schema-editor-title"
              icon={
                <TypeBadge
                  color={color ?? resolveSchemaColor(selected, selectedIndex)}
                  name={selected.name}
                  icon={icon}
                  size={26}
                />
              }
              title={name}
              description={`${selected.relation_count} relations · version ${selected.version}`}
            />
            <Button variant="ghost" onClick={() => setShowHistory(current => !current)}>
              {showHistory ? 'Back to fields' : 'View history'}
            </Button>
          </div>
          {showHistory ? (
            <SchemaVersionHistorySubSection versions={versions} isLoading={versionsLoading} />
          ) : (
            <RelationEditorForm
              name={name}
              description={description}
              inEndpoint={inEndpoint}
              outEndpoint={outEndpoint}
              color={color}
              icon={icon}
              dirty={dirty}
              canEdit={canEdit}
              updatePending={updateRelationSchemaMutation.isPending}
              fields={fields}
              groups={groups}
              sharedFieldGroupLinks={sharedFieldGroupLinks}
              fieldKeys={fieldKeysRef.current}
              schemas={schemas}
              enums={enums}
              teams={teams}
              validationRules={validationRules}
              onNameChange={value => {
                setName(value);
                setDirty(true);
              }}
              onDescriptionChange={value => {
                setDescription(value);
                setDirty(true);
              }}
              onInEndpointChange={endpoint => {
                setInEndpoint(endpoint);
                setDirty(true);
              }}
              onOutEndpointChange={endpoint => {
                setOutEndpoint(endpoint);
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
          icon={<TbShare2 size={22} />}
          title="No relation type selected"
          subtitle="Select a relation type from the sidebar to edit it."
          action={
            canEdit && (
              <Button variant="primary" icon={<TbPlus size={12} />} onClick={handleCreateType}>
                New relation type
              </Button>
            )
          }
        />
      )}
      <RelationSchemaSettingsDialogs
        selected={selected}
        fieldGroups={fieldGroups}
        sharedFieldGroupLinks={sharedFieldGroupLinks}
        groups={groups}
        teams={teams}
        confirmDelete={confirmDelete}
        errorMessage={errorMessage}
        pendingFieldChanges={pendingFieldChanges}
        groupDialogOpen={groupDialogOpen}
        editingGroup={editingGroup}
        accessDialogGroupId={accessDialogGroupId}
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
      />
    </div>
  );
};
