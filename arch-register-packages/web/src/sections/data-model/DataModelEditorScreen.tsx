import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import styles from './DataModelEditorScreen.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TypeBadge } from '../../components/TypeBadge';
import { TbPlus, TbCode, TbGripVertical, TbTrash } from 'react-icons/tb';
import { resolveSchemaColor, FIELD_TYPES, SCHEMA_ICONS } from '../../api';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import type { EntitySchema, SchemaField, FieldType, WorkspaceEnum } from '../../api';
import { ICON_MAP } from '../../components/TypeBadge';
import { useCreateSchema, useUpdateSchema, useDeleteSchema } from '../../hooks/useSchemas';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { newid } from '@diagram-craft/utils/id';
import { EnumEditorScreen } from './EnumEditorScreen';
import { SchemaGraphView } from './components/SchemaGraphView';

export const DataModelEditorScreen = () => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { tab?: 'types' | 'enums' | 'graph'; schema?: string; enumId?: string };
  const selectedSchemaId = search.schema;
  const activeTab = search.tab ?? 'types';
  const { workspaceSlug, schemas, enums, permissions } = useWorkspaceContext();
  const canEdit = permissions.canEditSchemas;
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [color, setColor] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const createSchemaMutation = useCreateSchema(workspaceSlug);
  const updateSchemaMutation = useUpdateSchema(workspaceSlug);
  const deleteSchemaMutation = useDeleteSchema(workspaceSlug);

  const onSelectSchema = useCallback((id: string) => {
    navigate({
      to: '/$workspaceSlug/model',
      params: { workspaceSlug },
      search: { schema: id || undefined },
    });
  }, [navigate, workspaceSlug]);

  const selectedIndex = schemas.findIndex(s => s.id === selectedSchemaId);
  const selected = selectedIndex >= 0 ? schemas[selectedIndex] : null;

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setDescription(selected.description);
      setFields(selected.fields);
      setColor(selected.color);
      setIcon(selected.icon);
      setDirty(false);
    }
  }, [selected]);

  const handleSave = useCallback(async () => {
    if (!selected || !dirty) return;
    try {
      await updateSchemaMutation.mutateAsync({
        schemaId: selected.id,
        data: { name, description, fields, color, icon },
      });
      setDirty(false);
    } catch {
      // TODO: surface error
    }
  }, [selected, name, description, fields, color, icon, dirty, updateSchemaMutation]);

  const handleCreateType = useCallback(async () => {
    try {
      const created = await createSchemaMutation.mutateAsync({ name: 'New type', fields: [] });
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
      const msg = e instanceof Error ? e.message : 'Failed to delete';
      window.alert(msg);
    }
  }, [selected, deleteSchemaMutation, onSelectSchema, schemas]);

  const updateField = (fieldId: string, patch: Partial<SchemaField>) => {
    setFields(prev => prev.map(f => (f.id === fieldId ? { ...f, ...patch } as SchemaField : f)));
    setDirty(true);
  };

  const removeField = (fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    setDirty(true);
  };

  const addField = () => {
    const newField: SchemaField = {
      id: newid(),
      name: 'new_field',
      type: 'text',
    };
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
          case 'boolean':
            return { ...base, type: 'boolean' };
          case 'select':
            return { ...base, type: 'select', enumId: enums[0]?.id ?? '', options: [] };
          case 'reference':
            return { ...base, type: 'reference', schemaId: '', minCount: 0, maxCount: -1 };
          case 'containment':
            return { ...base, type: 'containment', schemaId: '', minCount: 0, maxCount: 1 };
        }
      }),
    );
    setDirty(true);
  };

  if (activeTab === 'enums') {
    return <EnumEditorScreen />;
  }

  if (activeTab === 'graph') {
    return <SchemaGraphView />;
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Data model</div>
          <div className={styles.title}>Schema</div>
          <div className={styles.sub}>
            Define the entity types that everything in this workspace conforms to.
          </div>
        </div>
        <div className={styles.actions}>
          {canEdit && (
            <Button variant="primary" icon={<TbPlus size={12} />} onClick={handleCreateType}>
              New entity type
            </Button>
          )}
        </div>
      </div>

      {selected ? (
        <div>
          <div className={styles.editor}>
            <div className={styles.editorHead}>
              <div className={styles.editorTitleRow}>
                <TypeBadge color={color ?? resolveSchemaColor(selected, selectedIndex)} name={selected.name} icon={icon} size={26} />
                <div>
                  <div className={styles.editorTitle}>{name}</div>
                  <div className="dim">{selected.entity_count} entities</div>
                </div>
              </div>
              <div className={styles.modeToggle}>
                <button
                  type="button"
                  className={mode === 'form' ? styles.modeActive : ''}
                  onClick={() => setMode('form')}
                >
                  Form
                </button>
                <button
                  type="button"
                  className={mode === 'json' ? styles.modeActive : ''}
                  onClick={() => setMode('json')}
                >
                  JSON
                </button>
              </div>
            </div>

            {mode === 'form' ? (
              <>
                {/* Name */}
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

                {/* Description */}
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

                {/* Color + Icon */}
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
                          onClick={() => { setColor(c); setDirty(true); }}
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
                            onClick={() => { setIcon(id); setDirty(true); }}
                          >
                            <Ic size={14} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Fields */}
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
                    {fields.map((f) => {
                      const hasOtherContainment = fields.some(other => other.id !== f.id && other.type === 'containment');
                      return (
                        <FieldRow
                          key={f.id}
                          field={f}
                          schemas={schemas}
                          enums={enums}
                          onUpdate={(patch) => updateField(f.id, patch)}
                          onChangeType={(t) => changeFieldType(f.id, t)}
                          onRemove={canEdit ? () => removeField(f.id) : undefined}
                          containmentDisabled={hasOtherContainment}
                          canEdit={canEdit}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.fieldsTable}>
                    <div style={{ padding: '16px', color: 'var(--cmp-fg-disabled)', textAlign: 'center', fontSize: 12 }}>
                      No fields defined yet. Click "Add field" to get started.
                    </div>
                  </div>
                )}

                {/* Save / Delete actions */}
                <div className={styles.formActions}>
                  {canEdit && (
                    <Button
                      variant="danger"
                      icon={<TbTrash size={12} />}
                      onClick={handleDeleteType}
                    >
                      Delete type
                    </Button>
                  )}
                  <div style={{ flex: 1 }} />
                  {canEdit && dirty && (
                    <Button
                      variant="primary"
                      onClick={handleSave}
                      disabled={updateSchemaMutation.isPending}
                    >
                      {updateSchemaMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <pre className={styles.json}>
                {JSON.stringify({ id: selected.id, name, fields }, null, 2)}
              </pre>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.empty}>
          <TbCode size={22} />
          <div className={styles.emptyTitle}>No type selected</div>
          <div>Select an entity type from the sidebar to edit its schema.</div>
        </div>
      )}

      <DeleteConfirmationDialog
        open={confirmDelete}
        title="Delete entity type?"
        message={selected ? <>The entity type <b>{selected.name}</b> will be permanently deleted.</> : ''}
        detail="This can't be undone."
        confirmLabel="Delete type"
        onConfirm={doDeleteType}
        onCancel={() => setConfirmDelete(false)}
      />
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
  canEdit,
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
  const optionsDisplay = () => {
    if (field.type === 'select') {
      return (
        <Select.Root
          value={field.enumId || undefined}
          disabled={!canEdit}
          onChange={value => onUpdate({ enumId: value ?? '' } as Partial<SchemaField>)}
          placeholder="Select enum..."
          style={{ width: '100%' }}
        >
          {enums.map(e => (
            <Select.Item key={e.id} value={e.id}>{e.name}</Select.Item>
          ))}
        </Select.Root>
      );
    }
    if (field.type === 'reference' || field.type === 'containment') {
      return (
        <Select.Root
          value={field.schemaId || undefined}
          disabled={!canEdit}
          onChange={value => onUpdate({ schemaId: value ?? '' } as Partial<SchemaField>)}
          placeholder="Select type..."
          style={{ width: '100%' }}
        >
          {schemas.map(s => (
            <Select.Item key={s.id} value={s.id}>{s.name}</Select.Item>
          ))}
        </Select.Root>
      );
    }
    return <span className="dim">&mdash;</span>;
  };

  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldHandle}>
        <TbGripVertical size={14} />
      </span>
      <span className={styles.fieldName}>{field.id}</span>
      <TextInput
        value={field.name}
        disabled={!canEdit}
        onChange={value => onUpdate({ name: value ?? '' })}
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
        onChange={value => onUpdate({ requirementLevel: (value ?? 'optional') as SchemaField['requirementLevel'] } as Partial<SchemaField>)}
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
