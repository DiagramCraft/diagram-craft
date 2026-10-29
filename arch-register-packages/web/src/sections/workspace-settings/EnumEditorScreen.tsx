import { getRouteApi } from '@tanstack/react-router';
import styles from './SchemaSettingsScreen.module.css';
import { EditorActionsMenu, EditorSaveButtons } from './EditorActionsMenu';
import { TbPlus, TbDots } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import { FieldConfig } from '../../components/FieldConfig';
import { FieldConfigList } from '../../components/FieldConfigList';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { CategorySelect } from './CategorySelect';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ErrorDialog } from '@diagram-craft/app-components/ErrorDialog';
import { EmptyState } from '../../components/EmptyState';
import { Title } from '../../components/Title';
import { useEnumDraft } from './useEnumDraft';

const OPTIONS_LIST_ID = 'enum-options';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

export const EnumEditorScreen = () => {
  const navigate = routeApi.useNavigate();
  const { workspaceSlug, permissions, categories } = useWorkspaceContext();
  const canEdit = permissions.canEditSchemas;
  const {
    selected,
    isNew,
    name,
    categoryId,
    options,
    dirty,
    confirmDelete,
    setConfirmDelete,
    errorMessage,
    setErrorMessage,
    isSaving,
    setName,
    setCategoryId,
    addOption,
    updateOption,
    removeOption,
    reorderOptions,
    revert,
    save,
    remove
  } = useEnumDraft();

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
          eyebrow="Enum"
          buttons={
            canEdit && (selected || isNew) ? (
              <EditorSaveButtons
                canSave={dirty && name.trim() !== ''}
                dirty={dirty}
                onCancel={revert}
                pending={isSaving}
                onSave={() => void save()}
              />
            ) : undefined
          }
          menu={
            canEdit && selected ? (
              <EditorActionsMenu
                deleteLabel="Delete enum"
                onDelete={() => setConfirmDelete(true)}
              />
            ) : undefined
          }
          titleTestId={selected || isNew ? 'enum-editor-title' : undefined}
          title={selected || isNew ? name || 'New enum' : 'Enums'}
          description={
            selected || isNew
              ? `${options.length} options`
              : 'Define reusable option sets that select fields can reference.'
          }
        />
      </div>

      {selected || isNew ? (
        <div>
          <div className={styles.editor}>
            <div className={styles.formRow}>
              <div>
                <div className={styles.formLabel}>Name</div>
                <TextInput
                  value={name}
                  readOnly={!canEdit}
                  onChange={value => {
                    setName(value ?? '');
                  }}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div>
                <div className={styles.formLabel}>Category</div>
                <CategorySelect
                  value={categoryId}
                  categories={categories}
                  disabled={!canEdit}
                  onChange={value => {
                    setCategoryId(value);
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
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
      <ErrorDialog
        open={errorMessage !== null}
        title="Something went wrong"
        message={errorMessage}
        onClose={() => setErrorMessage(null)}
      />
    </div>
  );
};
