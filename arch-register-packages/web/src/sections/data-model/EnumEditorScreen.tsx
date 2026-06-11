import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import styles from './DataModelEditorScreen.module.css';
import { TbPlus, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useCreateEnum, useUpdateEnum, useDeleteEnum } from '../../hooks/useEnums';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';

export const EnumEditorScreen = () => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { tab?: string; enumId?: string };
  const selectedEnumId = search.enumId ?? null;
  const { workspaceSlug, enums, permissions } = useWorkspaceContext();
  const canEdit = permissions.canEditSchemas;

  const [name, setName] = useState('');
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const createEnumMutation = useCreateEnum(workspaceSlug);
  const updateEnumMutation = useUpdateEnum(workspaceSlug);
  const deleteEnumMutation = useDeleteEnum(workspaceSlug);

  const selected = enums.find(e => e.id === selectedEnumId) ?? null;

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setOptions(selected.options);
      setDirty(false);
    }
  }, [selected]);

  const handleCreateEnum = useCallback(async () => {
    try {
      const created = await createEnumMutation.mutateAsync({ name: 'new_enum', options: [] });
      navigate({
        to: '/$workspaceSlug/model',
        params: { workspaceSlug },
        search: { tab: 'enums', enumId: created.id },
      });
    } catch {
      // error handled by mutation
    }
  }, [createEnumMutation, navigate, workspaceSlug]);

  const handleSave = useCallback(async () => {
    if (!selected || !dirty) return;
    try {
      await updateEnumMutation.mutateAsync({
        enumId: selected.id,
        data: { name, options },
      });
      setDirty(false);
    } catch {
      // error handled by mutation
    }
  }, [selected, dirty, updateEnumMutation, name, options]);

  const doDelete = useCallback(async () => {
    if (!selected) return;
    try {
      await deleteEnumMutation.mutateAsync(selected.id);
      navigate({
        to: '/$workspaceSlug/model',
        params: { workspaceSlug },
        search: { tab: 'enums' },
      });
    } catch {
      // error handled by mutation
    }
  }, [selected, deleteEnumMutation, navigate, workspaceSlug]);

  const addOption = () => {
    setOptions(prev => [...prev, { value: '', label: '' }]);
    setDirty(true);
  };

  const updateOption = (index: number, patch: Partial<{ value: string; label: string }>) => {
    setOptions(prev => prev.map((o, i) => i === index ? { ...o, ...patch } : o));
    setDirty(true);
  };

  const removeOption = (index: number) => {
    setOptions(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Data model</div>
          <div className={styles.title}>Enums</div>
          <div className={styles.sub}>
            Define reusable option sets that select fields can reference.
          </div>
        </div>
        <div className={styles.actions}>
          {canEdit && (
            <Button variant="primary" icon={<TbPlus size={12} />} onClick={handleCreateEnum}>New enum</Button>
          )}
        </div>
      </div>

      {selected ? (
        <div>
          <div className={styles.editor}>
            <div className={styles.editorHead}>
              <div className={styles.editorTitleRow}>
                <div>
                  <div className={styles.editorTitle}>{name}</div>
                  <div className="dim">{selected.options.length} options</div>
                </div>
              </div>
            </div>

            <div className={styles.formRow}>
              <div>
                <div className={styles.formLabel}>Name</div>
                <TextInput
                  value={name}
                  readOnly={!canEdit}
                  onChange={value => {
                    setName(value ?? '');
                    setDirty(true);
                  }}
                />
              </div>
            </div>

            <div className={styles.fieldsHead}>
              <div className={styles.sectionLabel}>Options</div>
              {canEdit && (
                <Button variant="ghost" icon={<TbPlus size={11} />} onClick={addOption}>Add option</Button>
              )}
            </div>

            {options.length > 0 ? (
              <div className={styles.fieldsTable}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 10, padding: '8px 10px', fontSize: 11, color: 'var(--cmp-fg-disabled)', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'var(--panel-bg)', borderBottom: '1px solid var(--panel-border)' }}>
                  <span>Value</span>
                  <span>Label</span>
                  <span />
                </div>
                {options.map((opt, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 10, padding: '8px 10px', fontSize: 12, borderBottom: i < options.length - 1 ? '1px solid var(--panel-border)' : 'none' }}>
                    <TextInput
                      value={opt.value}
                      readOnly={!canEdit}
                      placeholder="value"
                      onChange={value => updateOption(i, { value: value ?? '' })}
                    />
                    <TextInput
                      value={opt.label}
                      readOnly={!canEdit}
                      placeholder="label"
                      onChange={value => updateOption(i, { label: value ?? '' })}
                    />
                    {canEdit && (
                      <button type="button" className={styles.iconBtn} onClick={() => removeOption(i)}>
                        <TbTrash size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.fieldsTable}>
                <div style={{ padding: '16px', color: 'var(--cmp-fg-disabled)', textAlign: 'center', fontSize: 12 }}>
                  No options defined yet. Click "Add option" to get started.
                </div>
              </div>
            )}

            <div className={styles.formActions}>
              {canEdit && (
                <Button variant="danger" icon={<TbTrash size={12} />} onClick={() => setConfirmDelete(true)}>Delete enum</Button>
              )}
              <div style={{ flex: 1 }} />
              {canEdit && dirty && (
                <Button variant="primary" onClick={handleSave} disabled={updateEnumMutation.isPending}>
                  {updateEnumMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No enum selected</div>
          <div>Select an enum from the sidebar or create a new one.</div>
        </div>
      )}

      <DeleteConfirmationDialog
        open={confirmDelete}
        title="Delete enum?"
        message={selected ? <>The enum <b>{selected.name}</b> will be permanently deleted.</> : ''}
        detail="This can't be undone. The delete will fail if any schema field still references this enum."
        confirmLabel="Delete enum"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};
