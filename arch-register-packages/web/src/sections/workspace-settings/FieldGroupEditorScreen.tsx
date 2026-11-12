import { useState } from 'react';
import { TbHistory } from 'react-icons/tb';
import { DraftPill } from './DraftPill';
import { SnapshotVersionHistoryDialog } from './sub-sections/SnapshotVersionHistoryDialog';
import { useCallback } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Title } from '../../components/Title';
import { Page } from '../../components/Page';
import { Panel } from '../../components/Panel';
import { Stack } from '../../components/Stack';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { ListEditor } from '../../components/ListEditor';
import { EditorActionsMenu, EditorSaveButtons } from './EditorActionsMenu';
import { useFieldGroupDraft } from './useFieldGroupDraft';
import { useDraftCategories, useDraftOverlay } from './useDraftOverlay';
import { blankFieldGroup } from './schemaDraftOverlay';
import { SchemaFieldRow } from './SchemaFieldRow';
import { CategorySelect } from './CategorySelect';
import styles from './SchemaSettingsScreen.module.css';

export const NEW_FIELD_GROUP_ID = 'new';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

export const FieldGroupEditorScreen = () => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const { workspaceSlug, fieldGroups: liveFieldGroups = [], permissions } = useWorkspaceContext();
  const categories = useDraftCategories();
  const fieldGroups = useDraftOverlay('field_group', liveFieldGroups, id => blankFieldGroup(id));
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
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <Page>
      <Title
        breadcrumb={[
          {
            label: 'Home',
            onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
          },
          { label: 'Settings' }
        ]}
        eyebrow="Shared field group"
        chips={<DraftPill kind="field_group" id={selected?.id} />}
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
              extraItems={[
                {
                  label: 'Version history',
                  icon: <TbHistory size={14} />,
                  onClick: () => setHistoryOpen(true)
                }
              ]}
              draftItem={{ kind: 'field_group', id: selected.id }}
              onDelete={() => void draft.remove()}
            />
          ) : undefined
        }
      />

      {editing ? (
        <Panel>
          <Stack>
            {draft.error && <div role="alert">{draft.error}</div>}

            <FormElement label="Name">
              <TextInput
                value={draft.name}
                readOnly={!canEdit}
                onChange={v => draft.setName(v ?? '')}
              />
            </FormElement>

            <FormElement label={'Category'}>
              <CategorySelect
                value={draft.categoryId}
                categories={categories}
                disabled={!canEdit}
                onChange={draft.setCategoryId}
              />
            </FormElement>

            <FormElement label={'Description'}>
              <TextArea
                value={draft.description}
                readOnly={!canEdit}
                onChange={v => draft.setDescription(v ?? '')}
                rows={3}
              />
            </FormElement>

            <ListEditor
              label="Fields"
              items={draft.fields}
              getId={field => field.id}
              addLabel="Add field"
              layout="bare"
              reorder="drag"
              disabled={!canEdit}
              operations
              onAdd={draft.addField}
              onMove={draft.reorderFields}
              renderItem={(field, { dragRef }) => (
                <SchemaFieldRow
                  field={field}
                  onUpdate={patch => draft.updateField(field.id, patch)}
                  onChangeType={type => draft.changeType(field.id, type)}
                  onRemove={canEdit ? () => draft.removeField(field.id) : undefined}
                  containmentDisabled={draft.fields.some(
                    item => item.id !== field.id && item.type === 'containment'
                  )}
                  canEdit={canEdit}
                  dragHandleRef={dragRef}
                />
              )}
            />
          </Stack>
        </Panel>
      ) : (
        <div className={styles.fieldsEmpty}>Select a fieldgroup or create a new one.</div>
      )}
      {selected && (
        <SnapshotVersionHistoryDialog
          open={historyOpen}
          kind="field_group"
          itemId={selected.id}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </Page>
  );
};
