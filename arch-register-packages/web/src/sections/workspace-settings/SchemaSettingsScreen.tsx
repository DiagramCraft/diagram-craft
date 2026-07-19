import { useState, useEffect, useCallback, useRef } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import styles from './SchemaSettingsScreen.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TypeBadge } from '../../components/TypeBadge';
import { TbPlus, TbCode, TbEdit, TbGripVertical, TbTrash } from 'react-icons/tb';
import { Title } from '../../components/Title';
import { resolveSchemaColor, FIELD_TYPES, SCHEMA_ICONS } from '../../lib/schemaPresentation';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import type { FieldType } from '../../lib/schemaPresentation';
import { ICON_MAP } from '../../components/TypeBadge';
import {
  useCreateSchema,
  useUpdateSchema,
  useDeleteSchema,
  getSchemaMigrationRequired
} from '../../hooks/useSchemas';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ErrorDialog } from '@diagram-craft/app-components/ErrorDialog';
import { EnumEditorScreen } from './EnumEditorScreen';
import {
  EntitySchema,
  EntityTemplate,
  FieldMigrations,
  PendingFieldChange,
  SchemaField
} from '@arch-register/api-types/schemaContract';
import { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import { EmptyState } from '../../components/EmptyState';
import { EntityTemplateDialog } from '../../dialogs/EntityTemplateDialog';
import { FieldMigrationDialog, FieldMigrationChoices } from '../../dialogs/FieldMigrationDialog';
import { SchemaVersionHistorySubSection } from './sub-sections/SchemaVersionHistorySubSection';

const toFieldId = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

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
  const { workspaceSlug, schemas, enums, permissions, teams, lifecycleStates } =
    useWorkspaceContext();
  const canEdit = permissions.canEditSchemas;
  const [name, setName] = useState('');
  const [keyPrefix, setKeyPrefix] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [templates, setTemplates] = useState<EntityTemplate[]>([]);
  const [color, setColor] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(null);
  const [entityApprovalPolicy, setEntityApprovalPolicy] = useState<'required' | 'disabled'>(
    'disabled'
  );
  const [deprecationPolicy, setDeprecationPolicy] = useState<'required' | 'disabled'>('disabled');
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EntityTemplate | null>(null);
  const [pendingFieldChanges, setPendingFieldChanges] = useState<PendingFieldChange[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const fieldKeysRef = useRef<Map<string, string>>(new Map());

  const createSchemaMutation = useCreateSchema(workspaceSlug);
  const updateSchemaMutation = useUpdateSchema(workspaceSlug);
  const deleteSchemaMutation = useDeleteSchema(workspaceSlug);

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
      setColor(selected.color);
      setIcon(selected.icon);
      setEntityApprovalPolicy(selected.entity_approval_policy ?? 'disabled');
      setDeprecationPolicy(selected.deprecation_policy ?? 'disabled');
      setDirty(false);
      setTemplateDialogOpen(false);
      setShowHistory(false);
      setPendingFieldChanges(null);
      fieldKeysRef.current.clear();
    }
  }, [selected]);

  const handleSave = useCallback(
    async (fieldMigrations?: FieldMigrations) => {
      if (!selected || !dirty) return;
      try {
        await updateSchemaMutation.mutateAsync({
          schemaId: selected.id,
          data: {
            name,
            key_prefix: keyPrefix,
            description,
            fields,
            templates,
            color,
            icon,
            entity_approval_policy: entityApprovalPolicy,
            deprecation_policy: deprecationPolicy,
            fieldMigrations
          }
        });
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
      color,
      icon,
      dirty,
      updateSchemaMutation,
      entityApprovalPolicy,
      deprecationPolicy
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

  const addField = () => {
    const id = toFieldId('new_field');
    fieldKeysRef.current.set(id, crypto.randomUUID());
    const newField: SchemaField = { id, name: 'new_field', type: 'text' };
    setFields(prev => [...prev, newField]);
    setDirty(true);
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

  if (activeTab === 'enums') {
    return <EnumEditorScreen />;
  }

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
            <SchemaVersionHistorySubSection workspaceId={workspaceSlug} schemaId={selected.id} />
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

              <div className={styles.formRow}>
                <div style={{ width: '100%' }}>
                  <div className={styles.formLabel}>Workflows</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div className={styles.formLabel}>Propose entity change</div>
                      <Select.Root
                        value={entityApprovalPolicy}
                        disabled={!canEdit}
                        onChange={value => {
                          if (value === 'required' || value === 'disabled') {
                            setEntityApprovalPolicy(value);
                            setDirty(true);
                          }
                        }}
                        style={{ width: '100%' }}
                      >
                        <Select.Item value="disabled">Disabled</Select.Item>
                        <Select.Item value="required">Required for entity edits</Select.Item>
                      </Select.Root>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className={styles.formLabel}>Entity deprecation</div>
                      <Select.Root
                        value={deprecationPolicy}
                        disabled={!canEdit}
                        onChange={value => {
                          if (value === 'required' || value === 'disabled') {
                            setDeprecationPolicy(value);
                            setDirty(true);
                          }
                        }}
                        style={{ width: '100%' }}
                      >
                        <Select.Item value="disabled">Disabled</Select.Item>
                        <Select.Item value="required">Enabled for this schema</Select.Item>
                      </Select.Root>
                    </div>
                  </div>
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
                  <Button variant="ghost" icon={<TbPlus size={11} />} onClick={addField}>
                    Add field
                  </Button>
                )}
              </div>

              {fields.length > 0 ? (
                <div className={styles.fieldsTable}>
                  <div className={styles.fieldsTh}>
                    <span />
                    <span>Name</span>
                    <span>Label</span>
                    <span>Type</span>
                    <span>Options / Ref</span>
                    <span>Completeness</span>
                    <span />
                  </div>
                  {fields.map(f => {
                    const hasOtherContainment = fields.some(
                      other => other.id !== f.id && other.type === 'containment'
                    );
                    return (
                      <FieldRow
                        key={fieldKeysRef.current.get(f.id) ?? f.id}
                        field={f}
                        schemas={schemas}
                        enums={enums}
                        onUpdate={patch => updateField(f.id, patch)}
                        onChangeType={t => changeFieldType(f.id, t)}
                        onRemove={canEdit ? () => removeField(f.id) : undefined}
                        containmentDisabled={hasOtherContainment}
                        canEdit={canEdit}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className={styles.fieldsTable}>
                  <div
                    style={{
                      padding: '16px',
                      color: 'var(--cmp-fg-disabled)',
                      textAlign: 'center',
                      fontSize: 12
                    }}
                  >
                    No fields defined yet. Click "Add field" to get started.
                  </div>
                </div>
              )}

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

const FieldRow = ({
  field,
  schemas,
  enums,
  onUpdate,
  onChangeType,
  onRemove,
  containmentDisabled,
  canEdit
}: {
  field: SchemaField;
  schemas: EntitySchema[];
  enums: WorkspaceEnum[];
  onUpdate: (patch: Partial<SchemaField>) => void;
  onChangeType: (type: FieldType) => void;
  onRemove?: () => void;
  containmentDisabled: boolean;
  canEdit: boolean;
}) => {
  const [idUserEdited, setIdUserEdited] = useState(() => field.id !== toFieldId(field.name));

  const optionsDisplay = () => {
    if (field.type === 'select') {
      return (
        <Select.Root
          value={field.enumId ?? undefined}
          disabled={!canEdit}
          onChange={value => onUpdate({ enumId: value ?? '' } as Partial<SchemaField>)}
          placeholder="Select enum..."
          style={{ width: '100%' }}
        >
          {enums.map(e => (
            <Select.Item key={e.id} value={e.id}>
              {e.name}
            </Select.Item>
          ))}
        </Select.Root>
      );
    }
    if (field.type === 'reference' || field.type === 'containment') {
      return (
        <div style={{ display: 'grid', gap: 8 }}>
          <Select.Root
            value={field.schemaId ?? undefined}
            disabled={!canEdit}
            onChange={value => onUpdate({ schemaId: value ?? '' } as Partial<SchemaField>)}
            placeholder="Select type..."
            style={{ width: '100%' }}
          >
            {schemas.map(s => (
              <Select.Item key={s.id} value={s.id}>
                {s.name}
              </Select.Item>
            ))}
          </Select.Root>
          <div style={{ display: 'grid', gap: 4 }}>
            <span className="dim" style={{ fontSize: 11 }}>
              Predicate
            </span>
            <TextInput
              value={field.predicate ?? ''}
              disabled={!canEdit}
              onChange={value =>
                onUpdate({
                  predicate: value?.trim() == null || value.trim() === '' ? undefined : value.trim()
                } as Partial<SchemaField>)
              }
              style={{ width: '100%' }}
              placeholder="e.g., belongs to, depends on"
            />
          </div>
          {field.type === 'reference' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <span className="dim" style={{ fontSize: 11 }}>
                  Min
                </span>
                <TextInput
                  value={String(field.minCount)}
                  disabled={!canEdit}
                  onChange={value => {
                    const next = Number(value ?? 0);
                    onUpdate({
                      minCount: Number.isNaN(next) ? 0 : Math.max(0, next)
                    } as Partial<SchemaField>);
                  }}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <span className="dim" style={{ fontSize: 11 }}>
                  Max
                </span>
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
                  style={{ width: '100%' }}
                  placeholder="Unbounded"
                />
              </div>
            </div>
          ) : null}
        </div>
      );
    }
    if (field.type === 'number') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <span className="dim" style={{ fontSize: 11 }}>
              Min
            </span>
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
              style={{ width: '100%' }}
              placeholder="Unbounded"
            />
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <span className="dim" style={{ fontSize: 11 }}>
              Max
            </span>
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
              style={{ width: '100%' }}
              placeholder="Unbounded"
            />
          </div>
        </div>
      );
    }
    return <span className="dim">&mdash;</span>;
  };

  return (
    <div className={styles.fieldRow} style={{ alignItems: 'flex-start' }}>
      <span className={styles.fieldHandle}>
        <TbGripVertical size={14} />
      </span>
      <TextInput
        value={field.id}
        disabled={!canEdit}
        onChange={value => {
          setIdUserEdited(true);
          onUpdate({ id: value ?? '' });
        }}
        style={{ width: '100%', fontFamily: 'monospace' }}
      />
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
      <span className={styles.fieldOptions}>{optionsDisplay()}</span>
      <Select.Root
        value={field.requirementLevel ?? 'optional'}
        disabled={!canEdit}
        onChange={value =>
          onUpdate({
            requirementLevel: (value ?? 'optional') as SchemaField['requirementLevel']
          } as Partial<SchemaField>)
        }
        style={{ width: '100%' }}
      >
        <Select.Item value="optional">Optional</Select.Item>
        <Select.Item value="expected">Expected</Select.Item>
        <Select.Item value="required">Required</Select.Item>
      </Select.Root>
      {onRemove && (
        <button type="button" className={styles.iconBtn} onClick={onRemove}>
          <TbTrash size={13} />
        </button>
      )}
    </div>
  );
};
