import { useState, useEffect, useCallback } from 'react';
import styles from './DataModelEditor.module.css';
import { TypeBadge } from '../components/TypeBadge';
import { Chip } from '../components/Chip';
import { TbPlus, TbCode, TbGripVertical, TbTrash } from 'react-icons/tb';
import { apiFetch, resolveSchemaColor, FIELD_TYPES, SCHEMA_COLORS, SCHEMA_ICONS } from '../api';
import type { EntitySchema, SchemaField, FieldType } from '../api';
import { ICON_MAP } from '../components/TypeBadge';

type DataModelEditorProps = {
  workspaceId: string;
  schemas: EntitySchema[];
  selectedSchemaId: string | null;
  onSelectSchema: (id: string) => void;
  onSchemaUpdated: () => void;
};

export const DataModelEditor = ({
  workspaceId,
  schemas,
  selectedSchemaId,
  onSelectSchema,
  onSchemaUpdated,
}: DataModelEditorProps) => {
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [name, setName] = useState('');
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [color, setColor] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedIndex = schemas.findIndex(s => s.id === selectedSchemaId);
  const selected = selectedIndex >= 0 ? schemas[selectedIndex] : null;

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setFields(selected.fields);
      setColor(selected.color);
      setIcon(selected.icon);
      setDirty(false);
    }
  }, [selected]);

  const handleSave = useCallback(async () => {
    if (!selected || !dirty) return;
    setSaving(true);
    try {
      await apiFetch(`/api/${workspaceId}/schemas/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, fields, color, icon }),
      });
      setDirty(false);
      onSchemaUpdated();
    } catch {
      // TODO: surface error
    } finally {
      setSaving(false);
    }
  }, [selected, name, fields, color, icon, dirty, workspaceId, onSchemaUpdated]);

  const handleCreateType = useCallback(async () => {
    try {
      const created = await apiFetch<EntitySchema>(`/api/${workspaceId}/schemas`, {
        method: 'POST',
        body: JSON.stringify({ name: 'New type', fields: [] }),
      });
      onSchemaUpdated();
      onSelectSchema(created.id);
    } catch {
      // TODO: surface error
    }
  }, [workspaceId, onSchemaUpdated, onSelectSchema]);

  const handleDeleteType = useCallback(async () => {
    if (!selected) return;
    const ok = window.confirm(`Delete "${selected.name}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await apiFetch(`/api/${workspaceId}/schemas/${selected.id}`, { method: 'DELETE' });
      onSchemaUpdated();
      onSelectSchema(schemas.find(s => s.id !== selected.id)?.id ?? '');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete';
      window.alert(msg);
    }
  }, [selected, workspaceId, onSchemaUpdated, onSelectSchema, schemas]);

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
      id: crypto.randomUUID().slice(0, 8),
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
            return { ...base, type: newType };
          case 'boolean':
            return { ...base, type: 'boolean' };
          case 'select':
            return { ...base, type: 'select', options: [] };
          case 'reference':
            return { ...base, type: 'reference', schemaId: '', minCount: 0, maxCount: -1 };
          case 'containment':
            return { ...base, type: 'containment', schemaId: '', minCount: 0, maxCount: 1 };
        }
      }),
    );
    setDirty(true);
  };

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
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleCreateType}>
            <TbPlus size={12} /> New entity type
          </button>
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
                    <input
                      className={styles.input}
                      value={name}
                      onChange={e => {
                        setName(e.target.value);
                        setDirty(true);
                      }}
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
                  <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={addField}>
                    <TbPlus size={11} /> Add field
                  </button>
                </div>

                {fields.length > 0 ? (
                  <div className={styles.fieldsTable}>
                    <div className={styles.fieldsTh}>
                      <span />
                      <span>Name</span>
                      <span>Label</span>
                      <span>Type</span>
                      <span>Options / Ref</span>
                      <span style={{ textAlign: 'center' }}>Req</span>
                      <span />
                    </div>
                    {fields.map((f) => {
                      const hasOtherContainment = fields.some(other => other.id !== f.id && other.type === 'containment');
                      return (
                        <FieldRow
                          key={f.id}
                          field={f}
                          schemas={schemas}
                          onUpdate={(patch) => updateField(f.id, patch)}
                          onChangeType={(t) => changeFieldType(f.id, t)}
                          onRemove={() => removeField(f.id)}
                          containmentDisabled={hasOtherContainment}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.fieldsTable}>
                    <div style={{ padding: '16px', color: 'var(--fg-3)', textAlign: 'center', fontSize: 12 }}>
                      No fields defined yet. Click "Add field" to get started.
                    </div>
                  </div>
                )}

                {/* Save / Delete actions */}
                <div className={styles.formActions}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnDanger}`}
                    onClick={handleDeleteType}
                  >
                    <TbTrash size={12} /> Delete type
                  </button>
                  <div style={{ flex: 1 }} />
                  {dirty && (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
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
    </div>
  );
};

const FieldRow = ({
  field,
  schemas,
  onUpdate,
  onChangeType,
  onRemove,
  containmentDisabled,
}: {
  field: SchemaField;
  schemas: EntitySchema[];
  onUpdate: (patch: Partial<SchemaField>) => void;
  onChangeType: (type: FieldType) => void;
  onRemove: () => void;
  containmentDisabled: boolean;
}) => {
  const optionsDisplay = () => {
    if (field.type === 'select') {
      if (field.options.length === 0) return <span className="dim">no options</span>;
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {field.options.map(o => (
            <Chip key={o.value} tone="ghost">{o.label}</Chip>
          ))}
        </div>
      );
    }
    if (field.type === 'reference' || field.type === 'containment') {
      return (
        <select
          className={styles.inlineSelect}
          value={field.schemaId}
          onChange={e => onUpdate({ schemaId: e.target.value } as Partial<SchemaField>)}
        >
          <option value="">Select type...</option>
          {schemas.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
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
      <input
        className={styles.inlineInput}
        value={field.name}
        onChange={e => onUpdate({ name: e.target.value })}
      />
      <select
        className={styles.inlineSelect}
        value={field.type}
        onChange={e => onChangeType(e.target.value as FieldType)}
      >
        {FIELD_TYPES.map(t => (
          <option key={t.value} value={t.value} disabled={t.value === 'containment' && containmentDisabled}>{t.label}</option>
        ))}
      </select>
      <span className={styles.fieldOptions}>{optionsDisplay()}</span>
      <span style={{ textAlign: 'center' }}>
        <input type="checkbox" className={styles.checkbox} />
      </span>
      <button type="button" className={styles.iconBtn} onClick={onRemove}>
        <TbTrash size={13} />
      </button>
    </div>
  );
};
