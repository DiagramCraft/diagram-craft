import { useState, useEffect, useCallback, useRef } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import styles from './SchemaSettingsScreen.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TypeBadge } from '../../components/TypeBadge';
import { TbPlus, TbCode, TbEdit, TbTrash, TbDots, TbLock } from 'react-icons/tb';
import { FieldConfig } from '../../components/FieldConfig';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import { Title } from '../../components/Title';
import { resolveSchemaColor, FIELD_TYPES, SCHEMA_ICONS } from '../../lib/schemaPresentation';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import type { FieldType } from '../../lib/schemaPresentation';
import { ICON_MAP } from '../../components/TypeBadge';
import {
  useCreateSchema,
  useUpdateSchema,
  useDeleteSchema,
  useSchemaVersions,
  getSchemaMigrationRequired
} from '../../hooks/useSchemas';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ErrorDialog } from '@diagram-craft/app-components/ErrorDialog';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { EnumEditorScreen } from './EnumEditorScreen';
import {
  EntitySchema,
  EntityTemplate,
  FieldMigrations,
  PendingFieldChange,
  SchemaField,
  SchemaGroup,
  SharedFieldGroupLink
} from '@arch-register/api-types/schemaContract';
import { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import { EmptyState } from '../../components/EmptyState';
import { GroupDialog } from '../../components/GroupsEditor';
import { TeamAccessPicker } from '../../components/TeamAccessPicker';
import { toFieldId } from '../../utils/fieldId';
import { EntityTemplateDialog } from '../../dialogs/EntityTemplateDialog';
import { DerivedExpressionTestDialog } from '../../components/DerivedExpressionTestDialog';
import { FieldMigrationDialog, FieldMigrationChoices } from '../../dialogs/FieldMigrationDialog';
import { SchemaVersionHistorySubSection } from './sub-sections/SchemaVersionHistorySubSection';
import { FieldGroupEditorScreen } from './FieldGroupEditorScreen';
import { RelationSchemaSettingsScreen } from './RelationSchemaSettingsScreen';
import { resolveGroupAccessControl } from '../../lib/fieldGroupAccess';

const deriveKeyPrefix = (value: string) =>
  value
    .replace(/[^a-z]/gi, '')
    .toUpperCase()
    .slice(0, 5);

const NOT_EXTERNAL = '__not_external__';

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
  const [schemaPanelTab, setSchemaPanelTab] = useState<'fields' | 'templates'>('fields');
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SchemaGroup | null>(null);
  const fieldKeysRef = useRef<Map<string, string>>(new Map());

  const createSchemaMutation = useCreateSchema(workspaceSlug);
  const updateSchemaMutation = useUpdateSchema(workspaceSlug);
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

  const selectedIndex = schemas.findIndex(s => s.id === selectedSchemaId);
  const selected = selectedIndex >= 0 ? schemas[selectedIndex] : null;

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setKeyPrefix(selected.key_prefix);
      setDescription(selected.description);
      setFields(selected.fields);
      setTemplates(selected.templates);
      setGroups(selected.groups);
      setSharedFieldGroupLinks(selected.shared_field_group_links ?? []);
      setColor(selected.color);
      setIcon(selected.icon);
      setDirty(false);
      setTemplateDialogOpen(false);
      setShowHistory(false);
      setPendingFieldChanges(null);
      setGroupDialogOpen(false);
      setEditingGroup(null);
      fieldKeysRef.current.clear();
    }
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
              color,
              icon,
              fieldMigrations
            }
          });
        }
        setDirty(false);
        setPendingFieldChanges(null);
      } catch (e: unknown) {
        const migrationRequired = getSchemaMigrationRequired(e);
        if (migrationRequired) {
          setPendingFieldChanges(migrationRequired.pendingChanges);
          return;
        }
        setErrorMessage(e instanceof Error ? e.message : 'Failed to save entity type');
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
      color,
      icon,
      dirty,
      updateSchemaMutation
    ]
  );

  const confirmFieldMigrations = useCallback(
    (choices: FieldMigrationChoices) => {
      if (!pendingFieldChanges) return;
      const fieldMigrations: FieldMigrations = {};
      for (const change of pendingFieldChanges) {
        const action = choices[change.fieldId] ?? 'remove';
        fieldMigrations[change.fieldId] =
          action === 'rename' ? { action, renameTo: change.renamedToId } : { action };
      }
      void handleSave(fieldMigrations);
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

  const handleDeleteType = useCallback(() => {
    if (!selected) return;
    setConfirmDelete(true);
  }, [selected]);

  const doDeleteType = useCallback(async () => {
    if (!selected) return;
    setConfirmDelete(false);
    try {
      await deleteSchemaMutation.mutateAsync(selected.id);
      onSelectSchema(schemas.find(s => s.id !== selected.id)?.id ?? '');
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [selected, deleteSchemaMutation, onSelectSchema, schemas]);

  const updateField = (fieldId: string, patch: Partial<SchemaField>) => {
    if (patch.id && patch.id !== fieldId) {
      const stableKey = fieldKeysRef.current.get(fieldId);
      if (stableKey) {
        fieldKeysRef.current.delete(fieldId);
        fieldKeysRef.current.set(patch.id, stableKey);
      }
      setTemplates(prev =>
        prev.map(template => {
          if (!(fieldId in template.values.fields)) return template;
          const nextFields = { ...template.values.fields };
          nextFields[patch.id!] = nextFields[fieldId]!;
          delete nextFields[fieldId];
          return { ...template, values: { ...template.values, fields: nextFields } };
        })
      );
    }
    setFields(prev => prev.map(f => (f.id === fieldId ? ({ ...f, ...patch } as SchemaField) : f)));
    setDirty(true);
  };

  const removeField = (fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    setTemplates(prev =>
      prev.map(template => {
        const nextFields = { ...template.values.fields };
        delete nextFields[fieldId];
        return { ...template, values: { ...template.values, fields: nextFields } };
      })
    );
    setDirty(true);
  };

  const addField = (groupId?: string) => {
    const id = toFieldId('new_field');
    fieldKeysRef.current.set(id, crypto.randomUUID());
    const newField: SchemaField = {
      id,
      name: 'new_field',
      type: 'text',
      ...(groupId && { groupId })
    };
    setFields(prev => [...prev, newField]);
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

  const setSharedFieldGroupTeamIds = (groupId: string, teamIds: string[]) => {
    setSharedFieldGroupLinks(current =>
      current.map(link =>
        link.groupId === groupId ? { groupId, ...(teamIds.length > 0 ? { teamIds } : {}) } : link
      )
    );
    setDirty(true);
  };

  const setLocalGroupTeamIds = (groupId: string, teamIds: string[]) => {
    setGroups(current =>
      current.map(item => {
        if (item.id !== groupId) return item;
        const { accessControl: _accessControl, ...rest } = item;
        return teamIds.length > 0 ? { ...rest, accessControl: { teamIds } } : rest;
      })
    );
    setDirty(true);
  };

  const setGroupAccess = (groupId: string, teamIds: string[]) => {
    if (sharedFieldGroupLinks.some(link => link.groupId === groupId)) {
      setSharedFieldGroupTeamIds(groupId, teamIds);
    } else {
      setLocalGroupTeamIds(groupId, teamIds);
    }
  };

  const changeFieldType = (fieldId: string, newType: FieldType) => {
    setFields(prev =>
      prev.map(f => {
        if (f.id !== fieldId) return f;
        const base = { id: f.id, name: f.name };
        switch (newType) {
          case 'text':
          case 'longtext':
          case 'date':
          case 'currency':
            return { ...base, type: newType };
          case 'number':
            return { ...base, type: 'number' };
          case 'boolean':
            return { ...base, type: 'boolean' };
          case 'select':
            return { ...base, type: 'select', enumId: enums[0]?.id ?? '', options: [] };
          case 'reference':
            return {
              ...base,
              type: 'reference',
              predicate: '',
              schemaId: '',
              minCount: 0,
              maxCount: -1
            };
          case 'containment':
            return {
              ...base,
              type: 'containment',
              predicate: '',
              schemaId: '',
              minCount: 0,
              maxCount: 1
            };
          case 'derived': {
            const inputField = prev.find(other => other.id !== fieldId && other.type !== 'derived');
            return {
              ...base,
              type: 'derived',
              requirementLevel: 'optional' as const,
              expression: inputField ? `entity.${inputField.id}` : '""',
              resultType: 'text' as const
            };
          }
          case 'typedRelation':
            return { ...base, type: 'typedRelation', relationSchemaId: '', direction: 'out' };
        }
      })
    );
    setTemplates(prev =>
      prev.map(template => {
        const nextFields = { ...template.values.fields };
        delete nextFields[fieldId];
        return { ...template, values: { ...template.values, fields: nextFields } };
      })
    );
    setDirty(true);
  };

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateDialogOpen(true);
  };

  const saveTemplate = (template: EntityTemplate) => {
    setTemplates(current => {
      const index = current.findIndex(item => item.id === template.id);
      if (index === -1) return [...current, template];
      return current.map(item => (item.id === template.id ? template : item));
    });
    setDirty(true);
    setTemplateDialogOpen(false);
  };

  const openNewGroup = () => {
    setEditingGroup(null);
    setGroupDialogOpen(true);
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
    setGroups(current => current.filter(g => g.id !== groupId));
    setFields(current =>
      current.map(f => (f.groupId === groupId ? { ...f, groupId: undefined } : f))
    );
    setDirty(true);
  };

  if (activeTab === 'enums') {
    return <EnumEditorScreen />;
  }
  if (activeTab === 'fieldgroups') {
    return <FieldGroupEditorScreen />;
  }
  if (activeTab === 'relation-types') {
    return <RelationSchemaSettingsScreen />;
  }

  const groupIds = new Set(groups.map(g => g.id));
  const ungroupedFields = fields.filter(f => !f.groupId || !groupIds.has(f.groupId));
  const fieldsByGroup = new Map<string, SchemaField[]>();
  for (const group of groups) fieldsByGroup.set(group.id, []);
  for (const f of fields) {
    if (f.groupId && groupIds.has(f.groupId)) fieldsByGroup.get(f.groupId)!.push(f);
  }

  const renderFieldRow = (f: SchemaField) => {
    const inherited =
      f.groupId != null && sharedFieldGroupLinks.some(link => link.groupId === f.groupId);
    const hasOtherContainment = fields.some(
      other => other.id !== f.id && other.type === 'containment'
    );
    return (
      <FieldRow
        key={fieldKeysRef.current.get(f.id) ?? f.id}
        field={f}
        schemas={schemas}
        relationSchemas={relationSchemas}
        enums={enums}
        groups={groups}
        onUpdate={patch => updateField(f.id, patch)}
        onChangeType={t => changeFieldType(f.id, t)}
        onRemove={canEdit && !inherited ? () => removeField(f.id) : undefined}
        containmentDisabled={hasOtherContainment}
        canEdit={canEdit && !inherited}
      />
    );
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
            <Button variant="ghost" onClick={() => setShowHistory(v => !v)}>
              {showHistory ? 'Back to fields' : 'View history'}
            </Button>
          </div>
          {showHistory ? (
            <SchemaVersionHistorySubSection
              versions={schemaVersions}
              isLoading={schemaVersionsLoading}
            />
          ) : (
            <div className={styles.editor}>
              <div className={styles.formRow}>
                <div>
                  <div className={styles.formLabel}>Name</div>
                  <TextInput
                    value={name}
                    disabled={!canEdit}
                    onChange={value => {
                      const nextName = value ?? '';
                      setName(nextName);
                      if (!dirty || keyPrefix === deriveKeyPrefix(name)) {
                        setKeyPrefix(deriveKeyPrefix(nextName));
                      }
                      setDirty(true);
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div>
                  <div className={styles.formLabel}>Key Prefix</div>
                  <TextInput
                    value={keyPrefix}
                    disabled={!canEdit}
                    onChange={value => {
                      setKeyPrefix((value ?? '').toUpperCase());
                      setDirty(true);
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div>
                  <div className={styles.formLabel}>Description</div>
                  <TextArea
                    value={description}
                    disabled={!canEdit}
                    placeholder="What does this entity type represent?"
                    onChange={value => {
                      setDescription(value ?? '');
                      setDirty(true);
                    }}
                    rows={4}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className={styles.appearanceRow}>
                <div>
                  <div className={styles.formLabel}>Color</div>
                  <div className={styles.colorSwatches}>
                    {SCHEMA_COLORS.map(c => (
                      <button
                        type="button"
                        key={c}
                        className={`${styles.swatch} ${color === c ? styles.swatchActive : ''}`}
                        style={{ background: c }}
                        disabled={!canEdit}
                        onClick={() => {
                          setColor(c);
                          setDirty(true);
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <div className={styles.formLabel}>Icon</div>
                  <div className={styles.iconPicker}>
                    {SCHEMA_ICONS.map(id => {
                      const Ic = ICON_MAP[id];
                      return (
                        <button
                          type="button"
                          key={id}
                          className={`${styles.iconOption} ${icon === id ? styles.iconOptionActive : ''}`}
                          title={id}
                          disabled={!canEdit}
                          onClick={() => {
                            setIcon(id);
                            setDirty(true);
                          }}
                        >
                          <Ic size={14} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <Tabs.Root
                value={schemaPanelTab}
                onValueChange={value => setSchemaPanelTab(value as typeof schemaPanelTab)}
              >
                <Tabs.List aria-label="Schema editor sections">
                  <Tabs.Trigger value="fields">Fields</Tabs.Trigger>
                  <Tabs.Trigger value="templates">Templates</Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="fields" style={{ height: 'auto' }}>
                  <div className={styles.fieldsHead}>
                    <div className={styles.sectionLabel}>Fields</div>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button variant="ghost" icon={<TbPlus size={11} />} onClick={openNewGroup}>
                          Add group
                        </Button>
                        <Button
                          variant="ghost"
                          icon={<TbPlus size={11} />}
                          onClick={() => addField()}
                        >
                          Add field
                        </Button>
                      </div>
                    )}
                  </div>

                  {fields.length > 0 || groups.length > 0 ? (
                    <div className={styles.fieldsTable}>
                      {ungroupedFields.map(f => renderFieldRow(f))}
                      {groups.map(group => {
                        const link = sharedFieldGroupLinks.find(item => item.groupId === group.id);
                        const inherited = link !== undefined;
                        const groupFields = fieldsByGroup.get(group.id) ?? [];
                        const teamIds =
                          resolveGroupAccessControl(group, sharedFieldGroupLinks)?.teamIds ?? [];
                        return (
                          <div className={styles.groupSection} key={group.id}>
                            <div className={styles.groupHeader}>
                              <div>
                                <div className={styles.groupName}>
                                  {group.name}
                                  {teamIds.length > 0 && (
                                    <span className={styles.restrictedBadge}>
                                      <TbLock size={10} />
                                      Restricted
                                    </span>
                                  )}
                                </div>
                                {group.description && (
                                  <div className={styles.groupDescription}>{group.description}</div>
                                )}
                                {teamIds.length > 0 && (
                                  <div className={styles.restrictedTeams}>
                                    Restricted to{' '}
                                    {teamIds
                                      .map(
                                        teamId =>
                                          teams.find(team => team.id === teamId)?.name ??
                                          'Unavailable team'
                                      )
                                      .join(', ')}
                                  </div>
                                )}
                              </div>
                              {canEdit && (
                                <div className={styles.groupActions}>
                                  {!inherited && (
                                    <Button
                                      variant="ghost"
                                      icon={<TbPlus size={11} />}
                                      onClick={() => addField(group.id)}
                                    >
                                      Add field
                                    </Button>
                                  )}
                                  <MenuButton.Root>
                                    <MenuButton.Trigger
                                      element={
                                        <button type="button" className={styles.iconBtn}>
                                          <TbDots size={13} />
                                        </button>
                                      }
                                    />
                                    <MenuButton.Menu>
                                      <Menu.Item
                                        disabled={inherited}
                                        onClick={() => {
                                          setEditingGroup(group);
                                          setGroupDialogOpen(true);
                                        }}
                                      >
                                        Edit
                                      </Menu.Item>
                                      <Menu.Item onClick={() => setAccessDialogGroupId(group.id)}>
                                        Change access
                                      </Menu.Item>
                                      <Menu.Separator />
                                      <Menu.Item
                                        type="danger"
                                        onClick={() =>
                                          inherited
                                            ? removeSharedFieldGroup(group.id)
                                            : removeGroup(group.id)
                                        }
                                      >
                                        Delete
                                      </Menu.Item>
                                    </MenuButton.Menu>
                                  </MenuButton.Root>
                                </div>
                              )}
                            </div>
                            {groupFields.length > 0 ? (
                              groupFields.map(field => renderFieldRow(field))
                            ) : (
                              <div className={styles.groupEmpty}>No fields in this group.</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.fieldsEmpty}>
                      No fields defined yet. Click "Add field" to get started.
                    </div>
                  )}
                </Tabs.Content>

                <Tabs.Content value="templates" style={{ height: 'auto' }}>
                  <div className={styles.fieldsHead}>
                    <div className={styles.sectionLabel}>Entity templates</div>
                    {canEdit && (
                      <Button variant="ghost" icon={<TbPlus size={11} />} onClick={openNewTemplate}>
                        Add template
                      </Button>
                    )}
                  </div>
                  <div className={styles.templateList}>
                    {templates.length === 0 ? (
                      <div className={styles.templateEmpty}>No templates defined.</div>
                    ) : (
                      templates.map(template => (
                        <div className={styles.templateRow} key={template.id}>
                          <div>
                            <div className={styles.templateName}>{template.name}</div>
                            <div className={styles.templateSummary}>
                              {Object.keys(template.values.fields).length} field defaults
                            </div>
                          </div>
                          {canEdit && (
                            <div className={styles.templateActions}>
                              <Button
                                variant="ghost"
                                icon={<TbEdit size={12} />}
                                onClick={() => {
                                  setEditingTemplate(template);
                                  setTemplateDialogOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                icon={<TbTrash size={12} />}
                                onClick={() => {
                                  setTemplates(current =>
                                    current.filter(item => item.id !== template.id)
                                  );
                                  setDirty(true);
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </Tabs.Content>
              </Tabs.Root>

              <div className={styles.formActions}>
                {canEdit && (
                  <Button variant="danger" icon={<TbTrash size={12} />} onClick={handleDeleteType}>
                    Delete type
                  </Button>
                )}
                <div style={{ flex: 1 }} />
                {canEdit && dirty && (
                  <Button
                    variant="primary"
                    onClick={() => handleSave()}
                    disabled={updateSchemaMutation.isPending}
                  >
                    {updateSchemaMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                )}
              </div>
            </div>
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

      <DeleteConfirmationDialog
        open={confirmDelete}
        title="Delete entity type?"
        message={
          selected ? (
            <>
              The entity type <b>{selected.name}</b> will be permanently deleted.
            </>
          ) : (
            ''
          )
        }
        detail="This can't be undone."
        confirmLabel="Delete type"
        onConfirm={doDeleteType}
        onCancel={() => setConfirmDelete(false)}
      />

      <ErrorDialog
        open={errorMessage !== null}
        title="Something went wrong"
        message={errorMessage}
        onClose={() => setErrorMessage(null)}
      />
      <FieldMigrationDialog
        open={pendingFieldChanges !== null}
        pendingChanges={pendingFieldChanges ?? []}
        onCancel={() => setPendingFieldChanges(null)}
        onConfirm={confirmFieldMigrations}
      />
      <GroupDialog
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        onSave={saveGroup}
        group={editingGroup}
        groups={groups}
        sharedGroups={fieldGroups.filter(
          group => !sharedFieldGroupLinks.some(link => link.groupId === group.id)
        )}
        onAddSharedGroup={addSharedFieldGroup}
      />
      <Dialog
        open={accessDialogGroupId !== null}
        onClose={() => setAccessDialogGroupId(null)}
        title="Field group access"
        buttons={[{ label: 'Done', type: 'default', onClick: () => setAccessDialogGroupId(null) }]}
      >
        {accessDialogGroupId && (
          <TeamAccessPicker
            teams={teams}
            teamIds={
              sharedFieldGroupLinks.find(link => link.groupId === accessDialogGroupId)?.teamIds ??
              groups.find(group => group.id === accessDialogGroupId)?.accessControl?.teamIds ??
              []
            }
            onChange={teamIds => setGroupAccess(accessDialogGroupId, teamIds)}
          />
        )}
      </Dialog>
      {selected && (
        <EntityTemplateDialog
          open={templateDialogOpen}
          onClose={() => setTemplateDialogOpen(false)}
          onSave={saveTemplate}
          workspaceId={workspaceSlug}
          schema={{ ...selected, fields, templates } as EntitySchema}
          template={editingTemplate}
          templates={templates}
          teams={teams}
          lifecycleStates={lifecycleStates}
        />
      )}
    </div>
  );
};

const NO_GROUP = '__no_group__';

export const FieldRow = ({
  field,
  schemas,
  relationSchemas,
  enums,
  groups,
  onUpdate,
  onChangeType,
  onRemove,
  containmentDisabled,
  canEdit
}: {
  field: SchemaField;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  enums: WorkspaceEnum[];
  groups: SchemaGroup[];
  onUpdate: (patch: Partial<SchemaField>) => void;
  onChangeType: (type: FieldType) => void;
  onRemove?: () => void;
  containmentDisabled: boolean;
  canEdit: boolean;
}) => {
  const [idUserEdited, setIdUserEdited] = useState(() => field.id !== toFieldId(field.name));
  const [expressionTestOpen, setExpressionTestOpen] = useState(false);

  const optionsDisplay = () => {
    if (field.type === 'select') {
      return (
        <FormElement label="Enum">
          <Select.Root
            value={field.enumId ?? undefined}
            disabled={!canEdit}
            onChange={value => onUpdate({ enumId: value ?? '' } as Partial<SchemaField>)}
            placeholder="Select enum..."
          >
            {enums.map(e => (
              <Select.Item key={e.id} value={e.id}>
                {e.name}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>
      );
    }
    if (field.type === 'reference' || field.type === 'containment') {
      return (
        <>
          <FormElement
            label={field.type === 'reference' ? 'Reference target' : 'Containment target'}
          >
            <Select.Root
              value={field.schemaId ?? undefined}
              disabled={!canEdit}
              onChange={value => onUpdate({ schemaId: value ?? '' } as Partial<SchemaField>)}
              placeholder="Select type..."
            >
              {schemas.map(s => (
                <Select.Item key={s.id} value={s.id}>
                  {s.name}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
          <FormElement label="Predicate">
            <TextInput
              value={field.predicate ?? ''}
              disabled={!canEdit}
              onChange={value =>
                onUpdate({
                  predicate: value?.trim() == null || value.trim() === '' ? undefined : value.trim()
                } as Partial<SchemaField>)
              }
              placeholder="e.g., belongs to, depends on"
            />
          </FormElement>
          {field.type === 'reference' && (
            <>
              <FormElement label="Min">
                <TextInput
                  value={String(field.minCount)}
                  disabled={!canEdit}
                  onChange={value => {
                    const next = Number(value ?? 0);
                    onUpdate({
                      minCount: Number.isNaN(next) ? 0 : Math.max(0, next)
                    } as Partial<SchemaField>);
                  }}
                />
              </FormElement>
              <FormElement label="Max">
                <TextInput
                  value={field.maxCount === -1 ? '' : String(field.maxCount)}
                  disabled={!canEdit}
                  onChange={value => {
                    const raw = value ?? '';
                    if (raw.trim() === '') {
                      onUpdate({ maxCount: -1 } as Partial<SchemaField>);
                      return;
                    }
                    const next = Number(raw);
                    onUpdate({
                      maxCount: Number.isNaN(next) ? -1 : Math.max(0, next)
                    } as Partial<SchemaField>);
                  }}
                  placeholder="Unbounded"
                />
              </FormElement>
            </>
          )}
        </>
      );
    }
    if (field.type === 'typedRelation') {
      return (
        <>
          <FormElement label="Relation type">
            <Select.Root
              value={field.relationSchemaId || undefined}
              disabled={!canEdit}
              onChange={value =>
                onUpdate({ relationSchemaId: value ?? '' } as Partial<SchemaField>)
              }
              placeholder="Select a relation type..."
            >
              {relationSchemas.map(rs => (
                <Select.Item key={rs.id} value={rs.id}>
                  {rs.name}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
          <FormElement label="Direction">
            <Select.Root
              value={field.direction}
              disabled={!canEdit}
              onChange={value =>
                onUpdate({ direction: (value ?? 'out') as 'in' | 'out' } as Partial<SchemaField>)
              }
            >
              <Select.Item value="out">Out (this entity is the "out" endpoint)</Select.Item>
              <Select.Item value="in">In (this entity is the "in" endpoint)</Select.Item>
            </Select.Root>
          </FormElement>
        </>
      );
    }
    if (field.type === 'number') {
      return (
        <>
          <FormElement label="Min">
            <TextInput
              value={field.min === undefined ? '' : String(field.min)}
              disabled={!canEdit}
              onChange={value => {
                const raw = value ?? '';
                if (raw.trim() === '') {
                  onUpdate({ min: undefined } as Partial<SchemaField>);
                  return;
                }
                const next = Number(raw);
                if (!Number.isNaN(next)) {
                  onUpdate({ min: Math.trunc(next) } as Partial<SchemaField>);
                }
              }}
              placeholder="Unbounded"
            />
          </FormElement>
          <FormElement label="Max">
            <TextInput
              value={field.max === undefined ? '' : String(field.max)}
              disabled={!canEdit}
              onChange={value => {
                const raw = value ?? '';
                if (raw.trim() === '') {
                  onUpdate({ max: undefined } as Partial<SchemaField>);
                  return;
                }
                const next = Number(raw);
                if (!Number.isNaN(next)) {
                  onUpdate({ max: Math.trunc(next) } as Partial<SchemaField>);
                }
              }}
              placeholder="Unbounded"
            />
          </FormElement>
        </>
      );
    }
    if (field.type === 'derived') {
      return (
        <>
          <FormElement label="Result type">
            <Select.Root
              value={field.resultType}
              disabled={!canEdit}
              onChange={value =>
                onUpdate({
                  resultType: (value ?? 'text') as Extract<
                    SchemaField,
                    { type: 'derived' }
                  >['resultType']
                } as Partial<SchemaField>)
              }
            >
              <Select.Item value="text">Text</Select.Item>
              <Select.Item value="number">Number</Select.Item>
              <Select.Item value="currency">Currency</Select.Item>
              <Select.Item value="select">Select</Select.Item>
              <Select.Item value="boolean">Boolean</Select.Item>
              <Select.Item value="rating">Rating</Select.Item>
            </Select.Root>
          </FormElement>
          {field.resultType === 'select' && (
            <FormElement label="Enum">
              <Select.Root
                value={field.enumId ?? undefined}
                disabled={!canEdit}
                onChange={value => onUpdate({ enumId: value ?? '' } as Partial<SchemaField>)}
                placeholder="Select enum..."
              >
                {enums.map(e => (
                  <Select.Item key={e.id} value={e.id}>
                    {e.name}
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
          )}
          <FormElement label="Expression">
            <TextArea
              value={field.expression}
              disabled={!canEdit}
              onChange={value => onUpdate({ expression: value ?? '' } as Partial<SchemaField>)}
              rows={2}
              placeholder="entity.input_field"
            />
          </FormElement>
        </>
      );
    }
    return undefined;
  };

  const menu = canEdit ? (
    <MenuButton.Root>
      <MenuButton.Trigger
        element={
          <button type="button" className={styles.iconBtn}>
            <TbDots size={13} />
          </button>
        }
      />
      <MenuButton.Menu>
        <Menu.SubMenu label="Move to group">
          <Menu.RadioGroup value={field.groupId ?? NO_GROUP}>
            <Menu.RadioItem value={NO_GROUP} onClick={() => onUpdate({ groupId: undefined })}>
              No group
            </Menu.RadioItem>
            {groups.map(group => (
              <Menu.RadioItem
                key={group.id}
                value={group.id}
                onClick={() => onUpdate({ groupId: group.id })}
              >
                {group.name}
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.SubMenu>
        {field.type === 'derived' && (
          <Menu.Item onClick={() => setExpressionTestOpen(true)}>Test expression</Menu.Item>
        )}
        {onRemove && (
          <>
            <Menu.Separator />
            <Menu.Item type="danger" onClick={onRemove}>
              Delete field
            </Menu.Item>
          </>
        )}
      </MenuButton.Menu>
    </MenuButton.Root>
  ) : undefined;

  return (
    <>
      <FieldConfig dragHandle options={optionsDisplay()} menu={menu}>
        <FieldConfig.Cell label="Id" mono flexBasis={160}>
          <TextInput
            value={field.id}
            disabled={!canEdit}
            onChange={value => {
              setIdUserEdited(true);
              onUpdate({ id: value ?? '' });
            }}
            style={{ width: '100%' }}
          />
        </FieldConfig.Cell>
        <FieldConfig.Cell label="Label" flexBasis={160}>
          <TextInput
            value={field.name}
            disabled={!canEdit}
            onChange={value => {
              const name = value ?? '';
              if (!idUserEdited) {
                onUpdate({ name, id: toFieldId(name) });
              } else {
                onUpdate({ name });
              }
            }}
            style={{ width: '100%' }}
          />
        </FieldConfig.Cell>
        <FieldConfig.Cell label="Type" flexBasis={140}>
          <Select.Root
            value={field.type}
            disabled={!canEdit}
            onChange={value => {
              if (value) onChangeType(value as FieldType);
            }}
            style={{ width: '100%' }}
          >
            {FIELD_TYPES.map(t => (
              <Select.Item
                key={t.value}
                value={t.value}
                disabled={t.value === 'containment' && containmentDisabled}
              >
                {t.label}
              </Select.Item>
            ))}
          </Select.Root>
        </FieldConfig.Cell>
        <FieldConfig.Cell label="Completeness" flexBasis={120}>
          <Select.Root
            value={field.requirementLevel ?? 'optional'}
            disabled={!canEdit || field.type === 'derived'}
            onChange={value => {
              const requirementLevel = (value ?? 'optional') as SchemaField['requirementLevel'];
              onUpdate({
                requirementLevel,
                ...(field.type === 'containment'
                  ? { minCount: requirementLevel === 'required' ? 1 : 0 }
                  : {})
              } as Partial<SchemaField>);
            }}
            style={{ width: '100%' }}
          >
            <Select.Item value="optional">Optional</Select.Item>
            <Select.Item value="expected">Expected</Select.Item>
            <Select.Item value="required">Required</Select.Item>
          </Select.Root>
        </FieldConfig.Cell>
        {field.type !== 'derived' && (
          <FieldConfig.Cell label="External" flexBasis={150}>
            <div style={{ display: 'grid', gap: 4 }}>
              <Select.Root
                value={field.external_kind ?? NOT_EXTERNAL}
                disabled={!canEdit}
                onChange={value =>
                  onUpdate(
                    value === NOT_EXTERNAL || !value
                      ? { external_kind: undefined, refresh_mode: undefined }
                      : { external_kind: value as SchemaField['external_kind'] }
                  )
                }
                style={{ width: '100%' }}
              >
                <Select.Item value={NOT_EXTERNAL}>Not external</Select.Item>
                <Select.Item value="ai">AI</Select.Item>
                <Select.Item value="integration">Integration</Select.Item>
                <Select.Item value="automation">Automation</Select.Item>
              </Select.Root>
              {field.external_kind && (
                <Select.Root
                  value={field.refresh_mode ?? 'on_change'}
                  disabled={!canEdit}
                  onChange={value =>
                    onUpdate({
                      refresh_mode: (value ?? 'on_change') as SchemaField['refresh_mode']
                    } as Partial<SchemaField>)
                  }
                  style={{ width: '100%' }}
                >
                  <Select.Item value="on_change">On change</Select.Item>
                  <Select.Item value="scheduled">Scheduled</Select.Item>
                </Select.Root>
              )}
            </div>
          </FieldConfig.Cell>
        )}
      </FieldConfig>
      {field.type === 'derived' && (
        <DerivedExpressionTestDialog
          open={expressionTestOpen}
          field={{ ...field, label: field.name }}
          expression={field.expression}
          onClose={() => setExpressionTestOpen(false)}
          onSave={expression => {
            onUpdate({ expression });
            setExpressionTestOpen(false);
          }}
        />
      )}
    </>
  );
};
