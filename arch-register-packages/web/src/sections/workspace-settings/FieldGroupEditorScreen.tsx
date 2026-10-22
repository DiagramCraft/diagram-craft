import { useCallback } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { TbPlus } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Title } from '../../components/Title';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { FieldConfigList } from '../../components/FieldConfigList';
import { EditorActionsMenu, EditorSaveButtons } from './EditorActionsMenu';
import { useFieldGroupDraft } from './useFieldGroupDraft';
import { SchemaFieldRow } from './SchemaFieldRow';
import { CategorySelect } from './CategorySelect';
import styles from './SchemaSettingsScreen.module.css';

const FIELDS_LIST_ID = 'shared-fieldgroup-fields';

export const NEW_FIELD_GROUP_ID = 'new';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

export const FieldGroupEditorScreen = () => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const { workspaceSlug, fieldGroups = [], permissions, categories } = useWorkspaceContext();
  const selected = fieldGroups.find(group => group.id === search.fieldGroupId) ?? null;
  const isNew = search.fieldGroupId === NEW_FIELD_GROUP_ID;
  const canEdit = permissions.canEditSchemas;

  const selectGroup = useCallback(
    (id: string | undefined) => {
      navigate({
        to: '/$workspaceSlug/settings/schemas',
        params: { workspaceSlug },
        search: { tab: 'fieldgroups', fieldGroupId: id }
      });
    },
    [navigate, workspaceSlug]
  );

  const draft = useFieldGroupDraft({ workspaceSlug, selected, isNew, onSelect: selectGroup });
  const editing = Boolean(selected || isNew);

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
          eyebrow="Shared field group"
          title={editing ? draft.name || 'New field group' : 'Shared fieldgroups'}
          description={
            editing
              ? `${draft.fields.length} fields`
              : 'Reusable field definitions included by multiple entity types.'
          }
          buttons={
            canEdit && editing ? (
              <EditorSaveButtons
                canSave={draft.dirty && draft.name.trim() !== ''}
                dirty={draft.dirty}
                pending={draft.isSaving}
                onSave={() => void draft.save()}
                onCancel={draft.revert}
              />
            ) : undefined
          }
          menu={
            canEdit && selected ? (
              <EditorActionsMenu
                deleteLabel="Delete fieldgroup"
                onDelete={() => void draft.remove()}
              />
            ) : undefined
          }
        />
      </div>
      {editing ? (
        <div className={styles.editor}>
          {draft.error && <div role="alert">{draft.error}</div>}
          <div className={styles.formRow}>
            <div>
              <div className={styles.formLabel}>Name</div>
              <TextInput
                value={draft.name}
                readOnly={!canEdit}
                onChange={v => draft.setName(v ?? '')}
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div>
              <div className={styles.formLabel}>Category</div>
              <CategorySelect
                value={draft.categoryId}
                categories={categories}
                disabled={!canEdit}
                onChange={draft.setCategoryId}
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div>
              <div className={styles.formLabel}>Description</div>
              <TextArea
                value={draft.description}
                readOnly={!canEdit}
                onChange={v => draft.setDescription(v ?? '')}
                rows={3}
              />
            </div>
          </div>
          <div className={styles.fieldsHead}>
            <div className={styles.sectionLabel}>Fields</div>
            {canEdit && (
              <Button variant="ghost" icon={<TbPlus size={11} />} onClick={draft.addField}>
                Add field
              </Button>
            )}
          </div>
          <FieldConfigList
            items={draft.fields}
            getId={field => field.id}
            listId={FIELDS_LIST_ID}
            onReorder={draft.reorderFields}
            renderItem={(field, _index, drag) => (
              <SchemaFieldRow
                field={field}
                onUpdate={patch => draft.updateField(field.id, patch)}
                onChangeType={type => draft.changeType(field.id, type)}
                onRemove={canEdit ? () => draft.removeField(field.id) : undefined}
                containmentDisabled={draft.fields.some(
                  item => item.id !== field.id && item.type === 'containment'
                )}
                canEdit={canEdit}
                dragHandleRef={drag.ref}
              />
            )}
          />
        </div>
      ) : (
        <div className={styles.fieldsEmpty}>Select a fieldgroup or create a new one.</div>
      )}
    </div>
  );
};
