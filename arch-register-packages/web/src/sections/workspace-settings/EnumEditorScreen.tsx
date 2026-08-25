import { useState, useEffect, useCallback } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import styles from './SchemaSettingsScreen.module.css';
import { TbPlus, TbTrash, TbDots } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import type { WorkspaceEnumOption } from '@arch-register/api-types/enumContract';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import { FieldConfig } from '../../components/FieldConfig';
import { FieldConfigList } from '../../components/FieldConfigList';
import { moveInArray } from '../../utils/arrayReorder';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useCreateEnum, useUpdateEnum, useDeleteEnum } from '../../hooks/useEnums';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { EmptyState } from '../../components/EmptyState';
import { Title } from '../../components/Title';

const OPTIONS_LIST_ID = 'enum-options';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

type EditableOption = WorkspaceEnumOption & {
  originalValue?: string;
  pendingRemoval?: boolean;
};

const toEditableOption = (option: WorkspaceEnumOption): EditableOption => ({
  ...option,
  originalValue: option.value
});

const newEditableOption = (): EditableOption => ({
  value: '',
  label: '',
  description: null,
  retired: false,
  restricted: false
});

export const EnumEditorScreen = () => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const selectedEnumId = search.enumId ?? null;
  const { workspaceSlug, enums, permissions } = useWorkspaceContext();
  const canEdit = permissions.canEditSchemas;

  const [name, setName] = useState('');
  const [options, setOptions] = useState<EditableOption[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const createEnumMutation = useCreateEnum(workspaceSlug);
  const updateEnumMutation = useUpdateEnum(workspaceSlug);
  const deleteEnumMutation = useDeleteEnum(workspaceSlug);

  const selected = enums.find(e => e.id === selectedEnumId) ?? null;

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setOptions(selected.options.map(toEditableOption));
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
    const parsedOptions: WorkspaceEnumOption[] = options
      .filter(option => !option.pendingRemoval)
      .map(
        ({ originalValue: _originalValue, pendingRemoval: _pendingRemoval, ...option }) => option
      );
    try {
      await updateEnumMutation.mutateAsync({
        enumId: selected.id,
        data: { name, options: parsedOptions }
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
    setOptions(prev => [...prev, newEditableOption()]);
    setDirty(true);
  };

  const updateOption = (index: number, patch: Partial<EditableOption>) => {
    setOptions(prev => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
    setDirty(true);
  };

  const removeOption = (index: number) => {
    const option = options[index];
    if (option?.originalValue !== undefined) {
      updateOption(index, { retired: true, pendingRemoval: true });
      return;
    }
    setOptions(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const reorderOptions = (fromIndex: number, toIndex: number) => {
    setOptions(prev => moveInArray(prev, fromIndex, toIndex));
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
                <FieldConfigList
                  items={options}
                  getId={opt => opt.originalValue ?? `new-${options.indexOf(opt)}`}
                  listId={OPTIONS_LIST_ID}
                  onReorder={reorderOptions}
                  renderItem={(opt, i, drag) => (
                    <FieldConfig
                      dragHandleRef={drag.ref}
                      menu={
                        canEdit ? (
                          <MenuButton.Root>
                            <MenuButton.Trigger
                              element={
                                <button type="button" className={styles.iconBtn}>
                                  <TbDots size={13} />
                                </button>
                              }
                            />
                            <MenuButton.Menu>
                              <Menu.Item type="danger" onClick={() => removeOption(i)}>
                                Remove option
                              </Menu.Item>
                            </MenuButton.Menu>
                          </MenuButton.Root>
                        ) : undefined
                      }
                      options={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <Checkbox
                              value={opt.restricted}
                              disabled={!canEdit}
                              label="Restricted / sensitive"
                              onChange={value => updateOption(i, { restricted: value ?? false })}
                            />
                          </div>
                          {opt.retired && (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <Checkbox
                                value={opt.retired}
                                disabled={!canEdit}
                                label="Retired"
                                onChange={value => {
                                  const retired = value ?? false;
                                  updateOption(i, {
                                    retired,
                                    ...(retired ? {} : { pendingRemoval: false })
                                  });
                                }}
                              />
                            </div>
                          )}
                        </div>
                      }
                    >
                      <FieldConfig.Cell label="Value" mono flexBasis={180}>
                        <TextInput
                          value={opt.value}
                          readOnly={!canEdit || opt.originalValue !== undefined}
                          placeholder="value"
                          style={{ width: '100%' }}
                          onChange={value => updateOption(i, { value: value ?? '' })}
                        />
                      </FieldConfig.Cell>
                      <FieldConfig.Cell label="Label" flexBasis={200}>
                        <TextInput
                          value={opt.label}
                          readOnly={!canEdit}
                          placeholder="label"
                          style={{ width: '100%' }}
                          onChange={value => updateOption(i, { label: value ?? '' })}
                        />
                      </FieldConfig.Cell>
                      <FieldConfig.Cell label="Description" flexBasis={260}>
                        <TextInput
                          value={opt.description ?? ''}
                          readOnly={!canEdit}
                          placeholder="optional description"
                          style={{ width: '100%' }}
                          onChange={value => updateOption(i, { description: value ?? null })}
                        />
                      </FieldConfig.Cell>
                    </FieldConfig>
                  )}
                />
              </div>
            ) : (
              <div className={styles.fieldsEmpty}>
                No options defined yet. Click "Add option" to get started.
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
