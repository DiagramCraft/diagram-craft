import { useState, useEffect, useCallback, useRef } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import styles from './SchemaSettingsScreen.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TypeBadge } from '../../components/TypeBadge';
import { TbPlus, TbShare2, TbTrash, TbDots, TbLock } from 'react-icons/tb';
import { FieldConfig } from '../../components/FieldConfig';
import { SchemaMultiSelect } from '../../components/SchemaMultiSelect';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import { Title } from '../../components/Title';
import {
  resolveSchemaColor,
  RELATION_FIELD_TYPES,
  SCHEMA_ICONS
} from '../../lib/schemaPresentation';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import type { RelationFieldType } from '../../lib/schemaPresentation';
import { ICON_MAP } from '../../components/TypeBadge';
import {
  useCreateRelationSchema,
  useUpdateRelationSchema,
  useDeleteRelationSchema,
  useRelationSchemaVersions,
  getRelationSchemaMigrationRequired
} from '../../hooks/useRelationSchemas';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ErrorDialog } from '@diagram-craft/app-components/ErrorDialog';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import {
  RelationEndpoint,
  RelationField,
  RelationSchemaGroup
} from '@arch-register/api-types/relationSchemaContract';
import type {
  EntitySchema,
  FieldMigrations,
  PendingFieldChange,
  SharedFieldGroupLink
} from '@arch-register/api-types/schemaContract';
import { EmptyState } from '../../components/EmptyState';
import { GroupDialog } from '../../components/GroupsEditor';
import { TeamAccessPicker } from '../../components/TeamAccessPicker';
import { toFieldId } from '../../utils/fieldId';
import { FieldMigrationDialog, FieldMigrationChoices } from '../../dialogs/FieldMigrationDialog';
import { SchemaVersionHistorySubSection } from './sub-sections/SchemaVersionHistorySubSection';
import { resolveGroupAccessControl } from '../../lib/fieldGroupAccess';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

const EMPTY_ENDPOINT: RelationEndpoint = { schemaIds: [] };

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

  const selectedIndex = relationSchemas.findIndex(s => s.id === selectedRelationSchemaId);
  const selected = selectedIndex >= 0 ? relationSchemas[selectedIndex] : null;

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setDescription(selected.description);
      setInEndpoint(selected.in);
      setOutEndpoint(selected.out);
      setFields(selected.fields);
      setGroups(selected.groups);
      setSharedFieldGroupLinks(selected.shared_field_group_links ?? []);
      setColor(selected.color);
      setIcon(selected.icon);
      setDirty(false);
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
            color,
            icon,
            fieldMigrations
          }
        });
        setDirty(false);
        setPendingFieldChanges(null);
      } catch (e: unknown) {
        const migrationRequired = getRelationSchemaMigrationRequired(e);
        if (migrationRequired) {
          setPendingFieldChanges(migrationRequired.pendingChanges);
          return;
        }
        setErrorMessage(e instanceof Error ? e.message : 'Failed to save relation type');
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
      color,
      icon,
      dirty,
      updateRelationSchemaMutation
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

  const handleDeleteType = useCallback(() => {
    if (!selected) return;
    setConfirmDelete(true);
  }, [selected]);

  const doDeleteType = useCallback(async () => {
    if (!selected) return;
    setConfirmDelete(false);
    try {
      await deleteRelationSchemaMutation.mutateAsync(selected.id);
      onSelectRelationSchema(relationSchemas.find(s => s.id !== selected.id)?.id ?? '');
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to delete');
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
    setFields(prev =>
      prev.map(f => (f.id === fieldId ? ({ ...f, ...patch } as RelationField) : f))
    );
    setDirty(true);
  };

  const removeField = (fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    setDirty(true);
  };

  const addField = (groupId?: string) => {
    const id = toFieldId('new_field');
    fieldKeysRef.current.set(id, crypto.randomUUID());
    const newField: RelationField = {
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

  const changeFieldType = (fieldId: string, newType: RelationFieldType) => {
    setFields(prev =>
      prev.map(f => {
        if (f.id !== fieldId) return f;
        const base = { id: f.id, name: f.name };
        switch (newType) {
          case 'text':
          case 'longtext':
          case 'date':
            return { ...base, type: newType };
          case 'number':
            return { ...base, type: 'number' };
          case 'boolean':
            return { ...base, type: 'boolean' };
          case 'select':
            return { ...base, type: 'select', enumId: enums[0]?.id ?? '' };
          case 'entityRelation':
            return {
              ...base,
              type: 'entityRelation',
              predicate: '',
              schemaId: '',
              minCount: 0,
              maxCount: -1
            };
        }
      })
    );
    setDirty(true);
  };

  const openNewGroup = () => {
    setEditingGroup(null);
    setGroupDialogOpen(true);
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
    setGroups(current => current.filter(g => g.id !== groupId));
    setFields(current =>
      current.map(f => (f.groupId === groupId ? { ...f, groupId: undefined } : f))
    );
    setDirty(true);
  };

  const groupIds = new Set(groups.map(g => g.id));
  const ungroupedFields = fields.filter(f => !f.groupId || !groupIds.has(f.groupId));
  const fieldsByGroup = new Map<string, RelationField[]>();
  for (const group of groups) fieldsByGroup.set(group.id, []);
  for (const f of fields) {
    if (f.groupId && groupIds.has(f.groupId)) fieldsByGroup.get(f.groupId)!.push(f);
  }

  const renderFieldRow = (f: RelationField) => {
    const inherited =
      f.groupId != null && sharedFieldGroupLinks.some(link => link.groupId === f.groupId);
    return (
      <RelationFieldRow
        key={fieldKeysRef.current.get(f.id) ?? f.id}
        field={f}
        schemas={schemas}
        enums={enums}
        groups={groups}
        onUpdate={patch => updateField(f.id, patch)}
        onChangeType={t => changeFieldType(f.id, t)}
        onRemove={canEdit && !inherited ? () => removeField(f.id) : undefined}
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
            <Button variant="ghost" onClick={() => setShowHistory(v => !v)}>
              {showHistory ? 'Back to fields' : 'View history'}
            </Button>
          </div>
          {showHistory ? (
            <SchemaVersionHistorySubSection versions={versions} isLoading={versionsLoading} />
          ) : (
            <div className={styles.editor}>
              <div className={styles.formRow}>
                <div>
                  <div className={styles.formLabel}>Name</div>
                  <TextInput
                    value={name}
                    disabled={!canEdit}
                    onChange={value => {
                      setName(value ?? '');
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
                    placeholder="What does this relation type represent?"
                    onChange={value => {
                      setDescription(value ?? '');
                      setDirty(true);
                    }}
                    rows={4}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div>
                  <div className={styles.formLabel}>In endpoint</div>
                  <Checkbox
                    label="Allow any entity type"
                    value={inEndpoint.schemaIds === 'any'}
                    disabled={!canEdit}
                    onChange={value => {
                      setInEndpoint({ schemaIds: value ? 'any' : [] });
                      setDirty(true);
                    }}
                  />
                  {inEndpoint.schemaIds !== 'any' && (
                    <SchemaMultiSelect
                      label=""
                      hint="Entity types allowed at the 'in' end of this relation."
                      schemas={schemas}
                      selectedIds={inEndpoint.schemaIds}
                      disabled={!canEdit}
                      onChange={schemaIds => {
                        setInEndpoint({ schemaIds });
                        setDirty(true);
                      }}
                    />
                  )}
                </div>
                <div>
                  <div className={styles.formLabel}>Out endpoint</div>
                  <Checkbox
                    label="Allow any entity type"
                    value={outEndpoint.schemaIds === 'any'}
                    disabled={!canEdit}
                    onChange={value => {
                      setOutEndpoint({ schemaIds: value ? 'any' : [] });
                      setDirty(true);
                    }}
                  />
                  {outEndpoint.schemaIds !== 'any' && (
                    <SchemaMultiSelect
                      label=""
                      hint="Entity types allowed at the 'out' end of this relation."
                      schemas={schemas}
                      selectedIds={outEndpoint.schemaIds}
                      disabled={!canEdit}
                      onChange={schemaIds => {
                        setOutEndpoint({ schemaIds });
                        setDirty(true);
                      }}
                    />
                  )}
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

              <div className={styles.fieldsHead}>
                <div className={styles.sectionLabel}>Fields</div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="ghost" icon={<TbPlus size={11} />} onClick={openNewGroup}>
                      Add group
                    </Button>
                    <Button variant="ghost" icon={<TbPlus size={11} />} onClick={() => addField()}>
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
                    disabled={updateRelationSchemaMutation.isPending}
                  >
                    {updateRelationSchemaMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                )}
              </div>
            </div>
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

      <DeleteConfirmationDialog
        open={confirmDelete}
        title="Delete relation type?"
        message={
          selected ? (
            <>
              The relation type <b>{selected.name}</b> will be permanently deleted.
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
        subjectLabel="relation type"
        itemNoun="relation"
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
    </div>
  );
};

const NO_GROUP = '__no_group__';

export const RelationFieldRow = ({
  field,
  schemas,
  enums,
  groups,
  onUpdate,
  onChangeType,
  onRemove,
  canEdit
}: {
  field: RelationField;
  schemas: EntitySchema[];
  enums: { id: string; name: string }[];
  groups: RelationSchemaGroup[];
  onUpdate: (patch: Partial<RelationField>) => void;
  onChangeType: (type: RelationFieldType) => void;
  onRemove?: () => void;
  canEdit: boolean;
}) => {
  const [idUserEdited, setIdUserEdited] = useState(() => field.id !== toFieldId(field.name));

  const optionsDisplay = () => {
    if (field.type === 'select') {
      return (
        <FormElement label="Enum">
          <Select.Root
            value={field.enumId ?? undefined}
            disabled={!canEdit}
            onChange={value => onUpdate({ enumId: value ?? '' } as Partial<RelationField>)}
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
                  onUpdate({ min: undefined } as Partial<RelationField>);
                  return;
                }
                const next = Number(raw);
                if (!Number.isNaN(next)) {
                  onUpdate({ min: Math.trunc(next) } as Partial<RelationField>);
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
                  onUpdate({ max: undefined } as Partial<RelationField>);
                  return;
                }
                const next = Number(raw);
                if (!Number.isNaN(next)) {
                  onUpdate({ max: Math.trunc(next) } as Partial<RelationField>);
                }
              }}
              placeholder="Unbounded"
            />
          </FormElement>
        </>
      );
    }
    if (field.type === 'entityRelation') {
      return (
        <>
          <FormElement label="Target schema">
            <Select.Root
              value={field.schemaId ?? undefined}
              disabled={!canEdit}
              onChange={value => onUpdate({ schemaId: value ?? '' } as Partial<RelationField>)}
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
                } as Partial<RelationField>)
              }
              placeholder="e.g., carries, references"
            />
          </FormElement>
          <FormElement label="Min">
            <TextInput
              value={String(field.minCount)}
              disabled={!canEdit}
              onChange={value => {
                const next = Number(value ?? 0);
                onUpdate({
                  minCount: Number.isNaN(next) ? 0 : Math.max(0, next)
                } as Partial<RelationField>);
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
                  onUpdate({ maxCount: -1 } as Partial<RelationField>);
                  return;
                }
                const next = Number(raw);
                onUpdate({
                  maxCount: Number.isNaN(next) ? -1 : Math.max(0, next)
                } as Partial<RelationField>);
              }}
              placeholder="Unbounded"
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
            if (value) onChangeType(value as RelationFieldType);
          }}
          style={{ width: '100%' }}
        >
          {RELATION_FIELD_TYPES.map(t => (
            <Select.Item key={t.value} value={t.value}>
              {t.label}
            </Select.Item>
          ))}
        </Select.Root>
      </FieldConfig.Cell>
      <FieldConfig.Cell label="Completeness" flexBasis={120}>
        <Select.Root
          value={field.requirementLevel ?? 'optional'}
          disabled={!canEdit}
          onChange={value => {
            onUpdate({
              requirementLevel: (value ?? 'optional') as RelationField['requirementLevel']
            } as Partial<RelationField>);
          }}
          style={{ width: '100%' }}
        >
          <Select.Item value="optional">Optional</Select.Item>
          <Select.Item value="expected">Expected</Select.Item>
          <Select.Item value="required">Required</Select.Item>
        </Select.Root>
      </FieldConfig.Cell>
    </FieldConfig>
  );
};
