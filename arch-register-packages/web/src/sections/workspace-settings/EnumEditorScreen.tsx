import { useState, useEffect, useCallback } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import styles from './SchemaSettingsScreen.module.css';
import { TbPlus, TbTrash, TbChevronUp, TbChevronDown } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useCreateEnum, useUpdateEnum, useDeleteEnum } from '../../hooks/useEnums';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { EmptyState } from '../../components/EmptyState';
import { Title } from '../../components/Title';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

export const EnumEditorScreen = () => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
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
        to: '/$workspaceSlug/settings/schemas',
        params: { workspaceSlug },
        search: { tab: 'enums', enumId: created.id }
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
        data: { name, options }
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
        to: '/$workspaceSlug/settings/schemas',
        params: { workspaceSlug },
        search: { tab: 'enums' }
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
    setOptions(prev => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
    setDirty(true);
  };

  const removeOption = (index: number) => {
    setOptions(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const moveOption = (index: number, direction: -1 | 1) => {
    setOptions(prev => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
    setDirty(true);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <Title
          breadcrumb={[
            {
              label: 'Home',
              onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
            },
            { label: 'Settings' }
          ]}
          eyebrow="Data model"
          title="Enums"
          description="Define reusable option sets that select fields can reference."
          buttons={
            canEdit && (
              <Button variant="primary" icon={<TbPlus size={12} />} onClick={handleCreateEnum}>
                New enum
              </Button>
            )
          }
        />
      </div>

      {selected ? (
        <div>
          <div className={styles.editor}>
            <div className={styles.editorHead}>
              <Title
                titleTestId="enum-editor-title"
                title={name}
                description={`${selected.options.length} options`}
              />
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
                <Button variant="ghost" icon={<TbPlus size={11} />} onClick={addOption}>
                  Add option
                </Button>
              )}
            </div>

            {options.length > 0 ? (
              <div className={styles.fieldsTable}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '52px 1fr 1fr 28px',
                    gap: 10,
                    padding: '8px 10px',
                    fontSize: 11,
                    color: 'var(--cmp-fg-disabled)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    background: 'var(--panel-bg)',
                    borderBottom: '1px solid var(--panel-border)'
                  }}
                >
                  <span />
                  <span>Value</span>
                  <span>Label</span>
                  <span />
                </div>
                {options.map((opt, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '52px 1fr 1fr 28px',
                      gap: 10,
                      padding: '8px 10px',
                      fontSize: 12,
                      alignItems: 'center',
                      borderBottom:
                        i < options.length - 1 ? '1px solid var(--panel-border)' : 'none'
                    }}
                  >
                    {canEdit ? (
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          disabled={i === 0}
                          onClick={() => moveOption(i, -1)}
                          aria-label="Move option up"
                        >
                          <TbChevronUp size={13} />
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          disabled={i === options.length - 1}
                          onClick={() => moveOption(i, 1)}
                          aria-label="Move option down"
                        >
                          <TbChevronDown size={13} />
                        </button>
                      </div>
                    ) : (
                      <span />
                    )}
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
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => removeOption(i)}
                      >
                        <TbTrash size={13} />
                      </button>
                    )}
                  </div>
                ))}
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
                  No options defined yet. Click "Add option" to get started.
                </div>
              </div>
            )}

            <div className={styles.formActions}>
              {canEdit && (
                <Button
                  variant="danger"
                  icon={<TbTrash size={12} />}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete enum
                </Button>
              )}
              <div style={{ flex: 1 }} />
              {canEdit && dirty && (
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={updateEnumMutation.isPending}
                >
                  {updateEnumMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No enum selected"
          subtitle="Select an enum from the sidebar or create a new one."
        />
      )}

      <DeleteConfirmationDialog
        open={confirmDelete}
        title="Delete enum?"
        message={
          selected ? (
            <>
              The enum <b>{selected.name}</b> will be permanently deleted.
            </>
          ) : (
            ''
          )
        }
        detail="This can't be undone. The delete will fail if any schema field still references this enum."
        confirmLabel="Delete enum"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};
